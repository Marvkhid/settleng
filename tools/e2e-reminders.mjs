/**
 * Smart Debt Reminders — end-to-end lifecycle + cross-tenant isolation suite.
 *
 * Self-provisioning: creates two independent Supabase accounts, signs each in for its own access
 * token, and bootstraps a profile + workspace for each. No browser session is reused, so the
 * isolation checks prove two separately authenticated users cannot read or mutate each other's
 * debts, reminders or delivery history.
 *
 * The scheduler is global (one cron serves every tenant), so assertions target the specific email
 * for a customer/workspace rather than a global email count.
 *
 * Email is captured by tools/email-sink.mjs (a real HTTP server), never a live inbox.
 * Run: node tools/e2e-reminders.mjs
 */
import { readFileSync } from 'node:fs';

const BASE = process.env.API_BASE ?? 'http://localhost:4000';
const SINK = process.env.SINK ?? 'http://127.0.0.1:4100';
const CRON = process.env.CRON_SECRET ?? 'test-cron-secret';
const PASSWORD = 'SettleTest!2026';

function envFile(path) {
  const out = {};
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line.trim());
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
}

const apiEnv = envFile('api/.env');
const webEnv = envFile('web/.env.local');
const SUPABASE_URL = (apiEnv.SUPABASE_URL ?? '').replace(/\/$/, '');
const SERVICE_KEY = apiEnv.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = webEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY) {
  console.error('SUPABASE_URL / SERVICE_ROLE_KEY / ANON_KEY required');
  process.exit(1);
}

const results = [];
const ok = (name, pass, detail) => {
  results.push({ name, pass });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  ' + JSON.stringify(detail) : ''}`);
};

let ACTIVE = null;
let A_TOKEN = null;
let B_TOKEN = null;

async function call(path, { method = 'GET', body, wid, token, headers } = {}) {
  const h = { Authorization: `Bearer ${token ?? A_TOKEN}` };
  const w = wid === 'none' ? null : wid ?? ACTIVE;
  if (w) h['x-workspace-id'] = w;
  if (body) h['content-type'] = 'application/json';
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { ...h, ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, data };
}

const sink = async () => (await (await fetch(`${SINK}/__log`)).json()).messages;
const resetSink = () => fetch(`${SINK}/__reset`, { method: 'POST' });
const failNext = (times) =>
  fetch(`${SINK}/__fail`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ times }),
  });
const mailsNamed = async (name) => (await sink()).filter((m) => (m.text ?? '').includes(name));

const at = (hours) => new Date(Date.now() + hours * 3600_000).toISOString();
const dispatch = (hours = 26) =>
  call(`/api/internal/debt-reminders/dispatch?at=${encodeURIComponent(at(hours))}`, {
    method: 'POST',
    wid: 'none',
    token: 'public',
    headers: { 'x-cron-secret': CRON },
  });

/* ---------------------------------------------------------------- accounts */

async function ensureAccount(email, fullName) {
  const created = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    }),
  });
  if (created.status >= 300 && created.status !== 409 && created.status !== 422) {
    throw new Error(`create user ${email}: ${created.status} ${await created.text()}`);
  }
  const login = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  const session = await login.json();
  if (!session.access_token)
    throw new Error(`sign in ${email}: ${login.status} ${JSON.stringify(session)}`);
  return session.access_token;
}

/** Real onboarding: creates the profile (so greetings use the stored name) and a workspace. */
async function bootstrap(token, fullName, businessName) {
  const r = await call('/api/auth/bootstrap', {
    method: 'POST',
    token,
    wid: 'none',
    body: { fullName, businessName, kind: 'BUSINESS' },
  });
  if (r.status >= 300 || !r.data?.business?.id)
    throw new Error(`bootstrap ${businessName}: ${r.status} ${JSON.stringify(r.data)}`);
  return r.data.business.id;
}

async function newWorkspace(token, name) {
  const r = await call('/api/workspaces', { method: 'POST', body: { name, kind: 'BUSINESS' }, wid: 'none', token });
  if (r.status >= 300 || !r.data?.id) throw new Error(`workspace ${name}: ${r.status} ${JSON.stringify(r.data)}`);
  return r.data.id;
}

async function makeDebt(name, principal, token, wid) {
  const r = await call('/api/debts', {
    method: 'POST',
    token,
    wid,
    body: {
      counterpartyName: name,
      principal,
      description: `E2E ${name}`,
      direction: 'OWED_TO_ME',
      incurredOn: '2026-09-01',
    },
  });
  if (r.status >= 300) throw new Error(`debt ${name}: ${r.status} ${JSON.stringify(r.data)}`);
  return r.data.id;
}

const enable = (debtId, times, token, wid, extra = {}) =>
  call(`/api/debts/${debtId}/reminder`, {
    method: 'PUT',
    token,
    wid,
    body: {
      enabled: true,
      frequency:
        times.length === 3 ? 'THREE_TIMES_DAILY' : times.length === 2 ? 'TWICE_DAILY' : times.length === 1 ? 'ONCE_DAILY' : 'CUSTOM',
      times,
      timezone: 'Africa/Lagos',
      ...extra,
    },
  });

/* ------------------------------------------------------------------ suite */

async function main() {
  const stamp = Date.now();
  const emailA = `settle.rem.a.${stamp}@settleng.test`;
  const emailB = `settle.rem.b.${stamp}@settleng.test`;
  A_TOKEN = await ensureAccount(emailA, 'Ada Reminder');
  B_TOKEN = await ensureAccount(emailB, 'Bode Outsider');
  ok('two independently authenticated accounts', !!A_TOKEN && !!B_TOKEN && A_TOKEN !== B_TOKEN);

  const wsA = await bootstrap(A_TOKEN, 'Ada Reminder', `Rem A ${stamp}`);
  ACTIVE = wsA;
  const wsB = await bootstrap(B_TOKEN, 'Bode Outsider', `Rem B ${stamp}`);
  ok('each account has its own workspace', !!wsA && !!wsB && wsA !== wsB);
  ACTIVE = wsA;

  const meA = await call('/api/auth/me');
  ok('account A token carries its owner email', meA.data?.email === emailA, { email: meA.data?.email });
  ok('account A profile name is stored', meA.data?.fullName === 'Ada Reminder', { fullName: meA.data?.fullName });

  await resetSink();

  /* ---- scheduler security ---- */
  const wrong = await call('/api/internal/debt-reminders/dispatch', {
    method: 'POST',
    wid: 'none',
    token: 'public',
    headers: { 'x-cron-secret': 'definitely-wrong' },
  });
  ok('scheduler rejects a wrong secret', wrong.status === 403, { status: wrong.status });
  const missing = await call('/api/internal/debt-reminders/dispatch', { method: 'POST', wid: 'none', token: 'public' });
  ok('scheduler rejects a missing secret', missing.status === 403, { status: missing.status });
  const anon = await fetch(`${BASE}/api/debt-reminders`);
  ok('reminders require a session', anon.status === 401, { status: anon.status });

  /* ---- cross-account isolation ---- */
  const fum = await makeDebt('Fumilayo', '6000', A_TOKEN, wsA);
  await enable(fum, ['08:00', '13:00', '18:00'], A_TOKEN, wsA);

  const foreignRead = await call(`/api/debts/${fum}/reminder`, { token: B_TOKEN, wid: wsB });
  ok('B cannot read A reminder by guessing the debt id', foreignRead.status === 404, { status: foreignRead.status });
  const foreignWrite = await call(`/api/debts/${fum}/reminder`, {
    method: 'PUT',
    token: B_TOKEN,
    wid: wsB,
    body: { enabled: false, frequency: 'ONCE_DAILY', times: ['08:00'], timezone: 'Africa/Lagos' },
  });
  ok('B cannot modify A reminder', foreignWrite.status === 404, { status: foreignWrite.status });
  const foreignPause = await call(`/api/debts/${fum}/reminder/pause`, {
    method: 'POST',
    token: B_TOKEN,
    wid: wsB,
    body: { paused: true },
  });
  ok('B cannot pause A reminder', foreignPause.status === 404, { status: foreignPause.status });
  const foreignDelete = await call(`/api/debts/${fum}/reminder`, { method: 'DELETE', token: B_TOKEN, wid: wsB });
  ok('B cannot delete A reminder', foreignDelete.status === 404, { status: foreignDelete.status });
  const spoofRead = await call(`/api/debts/${fum}/reminder`, { token: B_TOKEN, wid: wsA });
  ok('B cannot read A reminder by spoofing the workspace header', spoofRead.status === 404, { status: spoofRead.status });
  const spoofDelete = await call(`/api/debts/${fum}/reminder`, { method: 'DELETE', token: B_TOKEN, wid: wsA });
  ok('B cannot delete A reminder by spoofing the workspace header', spoofDelete.status === 404, { status: spoofDelete.status });

  const bOverview = await call('/api/debt-reminders', { token: B_TOKEN, wid: wsB });
  ok('B overview is empty', Array.isArray(bOverview.data?.items) && bOverview.data.items.length === 0, bOverview.data?.items?.map((i) => i.name));
  ok('B sees no delivery history', Array.isArray(bOverview.data?.history) && bOverview.data.history.length === 0);
  const bDebts = await call('/api/debts', { token: B_TOKEN, wid: wsB });
  const bList = bDebts.data?.items ?? bDebts.data?.debts ?? [];
  ok('B debt list excludes A debts', !JSON.stringify(bList).includes('Fumilayo'), { count: bList.length });
  const bCustomers = await call('/api/customers', { token: B_TOKEN, wid: wsB });
  ok('B customer list excludes A customers', !JSON.stringify(bCustomers.data ?? {}).includes('Fumilayo'));

  const aOverview = await call('/api/debt-reminders');
  ok('A overview still contains only A reminder', aOverview.data?.items?.length === 1 && aOverview.data.items[0].name === 'Fumilayo', aOverview.data?.items?.map((i) => i.name));
  const stillThere = await call(`/api/debts/${fum}/reminder`);
  ok('A reminder survived every foreign attempt', stillThere.status === 200 && stillThere.data?.reminder?.enabled === true, stillThere.data?.reminder);
  const bBefore = (await sink()).length;

  /* ---- single debt, personalised email ---- */
  await dispatch(26);
  const fumMail = (await mailsNamed('Fumilayo')).at(-1) ?? {};
  ok('single debt sends exactly one email', (await mailsNamed('Fumilayo')).length === 1);
  ok('subject names the amount and the customer', /₦6,000\b/.test(fumMail.subject ?? '') && /Fumilayo/.test(fumMail.subject ?? ''), fumMail.subject);
  ok('greeting uses the stored owner name', /Good (morning|afternoon|evening), Ada\./.test(fumMail.text ?? ''), (fumMail.text ?? '').slice(0, 46));
  ok('email shows the real balance', /₦6,000\b/.test(fumMail.text ?? ''), (fumMail.text ?? '').match(/₦[\d,.]+/g));
  ok('email links to the debt', new RegExp(`/debts/${fum}`).test(fumMail.html ?? ''));
  ok('email is only addressed to the owner', Array.isArray(fumMail.to) && fumMail.to.length === 1 && fumMail.to[0] === emailA, fumMail.to);
  ok('the debtor is never emailed', !JSON.stringify(fumMail).toLowerCase().includes('@fumilayo'));
  ok('sending to A never reached B', (await sink()).slice(bBefore).every((m) => !(m.to ?? []).includes(emailB)));

  /* ---- consolidated email: fresh workspace, genuinely due window ---- */
  const wsC = await newWorkspace(A_TOKEN, `Rem C ${stamp}`);
  ACTIVE = wsC;
  const names = ['Tunde', 'Chika', 'Musa', 'Ngozi', 'Halima'];
  const principals = ['12000', '3500', '8000', '4500', '6000'];
  const cDebts = [];
  for (let i = 0; i < names.length; i++) {
    const id = await makeDebt(names[i], principals[i], A_TOKEN, wsC);
    cDebts.push(id);
    const r = await enable(id, ['08:00', '13:00', '18:00'], A_TOKEN, wsC);
    if (r.status >= 300) throw new Error(`enable ${names[i]}: ${r.status} ${JSON.stringify(r.data)}`);
  }
  const cons = await dispatch(26);
  const consSent = (cons.data?.results ?? []).filter((r) => r.status === 'SENT' && r.debtCount === 5);
  const halima = (await mailsNamed('Halima')).at(-1) ?? {};
  ok('one consolidated email for five debts', consSent.length === 1 && (await mailsNamed('Halima')).length === 1, cons.data?.results);
  ok('consolidated subject counts the debts', /5 outstanding payments/.test(halima.subject ?? ''), halima.subject);
  ok('consolidated body lists every customer', names.every((n) => (halima.text ?? '').includes(n)), halima.subject);
  ok('consolidated total is correct', /Total outstanding: ₦34,000\b/.test(halima.text ?? ''), (halima.text ?? '').match(/Total outstanding: [^\n]+/)?.[0]);
  ok('consolidated email is addressed only to its owner', Array.isArray(halima.to) && halima.to.length === 1 && halima.to[0] === emailA, halima.to);

  const dup = await dispatch(26);
  ok('duplicate dispatch sends nothing', (dup.data?.results ?? []).filter((r) => r.status === 'SENT').length === 0, dup.data);
  ok('no duplicate consolidated email', (await mailsNamed('Halima')).length === 1);

  /* ---- partial payment chases only the remainder ---- */
  ACTIVE = wsA;
  await call(`/api/debts/${fum}/repayments`, { method: 'POST', body: { amount: '3000', method: 'CASH', paidOn: '2026-10-01' } });
  await dispatch(50);
  const partial = (await mailsNamed('Fumilayo')).at(-1) ?? {};
  ok('partial payment produced one more email', (await mailsNamed('Fumilayo')).length === 2, { count: (await mailsNamed('Fumilayo')).length });
  ok('partial payment email asks about the remainder', /₦3,000\b/.test(partial.subject ?? '') && !/6,000/.test(partial.text ?? ''), partial.subject);
  ok('partial payment body chases only the remainder', /still owes you ₦3,000\b/.test(partial.text ?? '') && !/6,000/.test(partial.text ?? ''), (partial.text ?? '').match(/still owes you [^\n]+/)?.[0]);

  /* ---- full repayment cancels future reminders ---- */
  await call(`/api/debts/${fum}/repayments`, { method: 'POST', body: { amount: '3000', method: 'CASH', paidOn: '2026-10-02' } });
  await dispatch(74);
  const cfgAfterPaid = await call(`/api/debts/${fum}/reminder`);
  ok('paid debt sends no further email', (await mailsNamed('Fumilayo')).length === 2, { count: (await mailsNamed('Fumilayo')).length });
  ok('paid debt reminder is switched off', cfgAfterPaid.data?.reminder?.enabled === false && cfgAfterPaid.data.reminder.nextRunAt === null, cfgAfterPaid.data?.reminder);
  ok('paid debt records why it stopped', cfgAfterPaid.data?.reminder?.lastError === 'debt_settled', cfgAfterPaid.data?.reminder?.lastError);
  ok('reminders cannot be enabled on a settled debt', (await enable(fum, ['08:00'], A_TOKEN, wsA)).status === 400);

  /* ---- pause / disable / delete / write-off, one active survivor ---- */
  const wsD = await newWorkspace(A_TOKEN, `Rem D ${stamp}`);
  ACTIVE = wsD;
  const yemi = await makeDebt('Yemi', '2000', A_TOKEN, wsD);
  const uche = await makeDebt('Uche', '2100', A_TOKEN, wsD);
  const segun = await makeDebt('Segun', '2200', A_TOKEN, wsD);
  const ifeoma = await makeDebt('Ifeoma', '2300', A_TOKEN, wsD);
  const kemi = await makeDebt('Kemi', '2400', A_TOKEN, wsD);
  for (const id of [yemi, uche, segun, ifeoma, kemi]) await enable(id, ['08:00'], A_TOKEN, wsD);
  await call(`/api/debts/${yemi}/reminder/pause`, { method: 'POST', body: { paused: true } });
  await call(`/api/debts/${uche}/reminder`, { method: 'DELETE' });
  await call(`/api/debts/${segun}`, { method: 'DELETE' });
  await call(`/api/debts/${ifeoma}`, { method: 'PATCH', body: { override: 'WRITTEN_OFF' } });
  ok('pause is stored', (await call(`/api/debts/${yemi}/reminder`)).data?.reminder?.paused === true);
  ok('deleted debt has no reminder', (await call(`/api/debts/${segun}/reminder`)).status === 404);

  await dispatch(32);
  const dMail = (await mailsNamed('Kemi')).at(-1) ?? {};
  ok('active debt in the same workspace is still emailed', (await mailsNamed('Kemi')).length === 1, { count: (await mailsNamed('Kemi')).length });
  ok('the active email lists only the surviving debt', !/Yemi|Uche|Segun|Ifeoma/.test(dMail.text ?? ''), dMail.subject);
  ok('paused debt is not emailed', (await mailsNamed('Yemi')).length === 0);
  ok('disabled debt is not emailed', (await mailsNamed('Uche')).length === 0);
  ok('deleted debt is not emailed', (await mailsNamed('Segun')).length === 0);
  ok('written-off debt is not emailed', (await mailsNamed('Ifeoma')).length === 0);

  /* ---- timezone + validation ---- */
  const scratch = await makeDebt('Timezone', '1000', A_TOKEN, wsD);
  const lagos = await enable(scratch, ['08:00'], A_TOKEN, wsD);
  const lagosHour = lagos.data?.nextRunAt ? new Date(lagos.data.nextRunAt).getUTCHours() : null;
  const london = await call(`/api/debts/${scratch}/reminder`, {
    method: 'PUT',
    body: { enabled: true, frequency: 'ONCE_DAILY', times: ['08:00'], timezone: 'Europe/London' },
  });
  const londonHour = london.data?.nextRunAt ? new Date(london.data.nextRunAt).getUTCHours() : null;
  ok('08:00 Lagos is 07:00 UTC', lagosHour === 7, { lagosHour });
  ok('a different timezone schedules a different instant', londonHour !== null && londonHour !== lagosHour, { lagosHour, londonHour });
  const quiet = await call(`/api/debts/${scratch}/reminder`, {
    method: 'PUT',
    body: { enabled: true, frequency: 'ONCE_DAILY', times: ['02:00'], timezone: 'Africa/Lagos' },
  });
  ok('overnight times are refused', quiet.status === 400, { status: quiet.status, message: quiet.data?.message });
  const dupe = await call(`/api/debts/${scratch}/reminder`, {
    method: 'PUT',
    body: { enabled: true, frequency: 'TWICE_DAILY', times: ['08:00', '08:00'], timezone: 'Africa/Lagos' },
  });
  ok('duplicate times are refused', dupe.status === 400, { status: dupe.status, message: dupe.data?.message });

  /* ---- provider failure, visible failure, retry without duplicates ---- */
  // The dispatch endpoint serves every tenant, so park this run's other reminders first: the
  // injected provider failure must hit the debt under test, not whichever email happens to be first.
  for (const id of cDebts) await call(`/api/debts/${id}/reminder`, { method: 'DELETE', wid: wsC });
  for (const id of [kemi, scratch]) await call(`/api/debts/${id}/reminder`, { method: 'DELETE', wid: wsD });
  const wsE = await newWorkspace(A_TOKEN, `Rem E ${stamp}`);
  ACTIVE = wsE;
  const retryDebt = await makeDebt('Retry', '4500', A_TOKEN, wsE);
  await enable(retryDebt, ['08:00'], A_TOKEN, wsE);
  await failNext(1);
  await dispatch(98);
  const hist = (await call('/api/debt-reminders')).data?.history ?? [];
  const failedRow = hist.find((h) => (h.subject ?? '').includes('Retry'));
  ok('failed send is recorded as FAILED', failedRow?.status === 'FAILED', failedRow);
  ok('failed send never reached the provider', (await mailsNamed('Retry')).length === 0);
  await dispatch(120);
  const hist2 = (await call('/api/debt-reminders')).data?.history ?? [];
  ok('retry succeeds and is recorded as SENT', hist2.some((h) => (h.subject ?? '').includes('Retry') && h.status === 'SENT'), hist2.find((h) => (h.subject ?? '').includes('Retry')));
  ok('retry produced exactly one email', (await mailsNamed('Retry')).length === 1);
  await dispatch(120);
  ok('a repeated retry cannot duplicate the email', (await mailsNamed('Retry')).length === 1);

  /* ---- multi-workspace scoping for one user ---- */
  const aOnly = await call('/api/debt-reminders', { token: A_TOKEN, wid: wsA });
  const cOnly = await call('/api/debt-reminders', { token: A_TOKEN, wid: wsC });
  const dOnly = await call('/api/debt-reminders', { token: A_TOKEN, wid: wsD });
  const namesOf = (r) => (r.data?.items ?? []).map((i) => i.name);
  ok('workspace A overview shows only workspace A', JSON.stringify(namesOf(aOnly)) === '["Fumilayo"]', namesOf(aOnly));
  ok('workspace C overview shows only workspace C', namesOf(cOnly).sort().join() === [...names].sort().join(), namesOf(cOnly));
  ok('workspace D overview excludes workspace C debts', !namesOf(dOnly).some((n) => names.includes(n)), namesOf(dOnly));
  ok('C overview has its own delivery history only', (cOnly.data?.history ?? []).every((h) => (h.subject ?? '').includes('outstanding')), (cOnly.data?.history ?? []).length);

  const failedTests = results.filter((r) => !r.pass);
  console.log(`\nSUMMARY ${results.length - failedTests.length}/${results.length} passed`);
  if (failedTests.length) {
    console.log('FAILED: ' + failedTests.map((f) => f.name).join(' | '));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('CRASH', e);
  process.exit(1);
});
