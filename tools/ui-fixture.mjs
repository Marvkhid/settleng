/**
 * Provisions a stable demo account for browser testing of the reminders UI.
 * Prints only the email and workspace id (password is the shared test password).
 */
import { readFileSync } from 'node:fs';

const BASE = process.env.API_BASE ?? 'http://localhost:4000';
const PASSWORD = 'SettleTest!2026';
const EMAIL = process.env.UI_EMAIL ?? 'settle.ui.demo@settleng.test';

const env = {};
for (const line of readFileSync('api/.env', 'utf8').split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line.trim());
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const WEB = {};
for (const line of readFileSync('web/.env.local', 'utf8').split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line.trim());
  if (m) WEB[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const URL_ = env.SUPABASE_URL.replace(/\/$/, '');

const created = await fetch(`${URL_}/auth/v1/admin/users`, {
  method: 'POST',
  headers: {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    'content-type': 'application/json',
  },
  body: JSON.stringify({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: 'Buffy Tester' },
  }),
});
if (created.status >= 300 && created.status !== 409 && created.status !== 422)
  throw new Error(`create: ${created.status} ${await created.text()}`);

const login = await fetch(`${URL_}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: { apikey: WEB.NEXT_PUBLIC_SUPABASE_ANON_KEY, 'content-type': 'application/json' },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
}).then((r) => r.json());
if (!login.access_token) throw new Error('sign in failed: ' + JSON.stringify(login));

let ACTIVE = null;
async function call(path, { method = 'GET', body } = {}) {
  const h = { Authorization: `Bearer ${login.access_token}` };
  if (ACTIVE) h['x-workspace-id'] = ACTIVE;
  if (body) h['content-type'] = 'application/json';
  const res = await fetch(`${BASE}${path}`, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, data };
}

const boot = await call('/api/auth/bootstrap', {
  method: 'POST',
  body: { fullName: 'Buffy Tester', businessName: 'Buffy Test Stores', kind: 'BUSINESS' },
});
ACTIVE = boot.data?.business?.id ?? null;
if (!ACTIVE) throw new Error('bootstrap failed: ' + JSON.stringify(boot));

const existing = await call('/api/debts');
const have = new Set((existing.data?.items ?? []).map((d) => d.counterpartyName));

async function debt(name, principal) {
  if (have.has(name)) return (existing.data.items.find((d) => d.counterpartyName === name)).id;
  const r = await call('/api/debts', {
    method: 'POST',
    body: {
      counterpartyName: name,
      principal,
      description: `UI fixture ${name}`,
      direction: 'OWED_TO_ME',
      incurredOn: '2026-09-12',
    },
  });
  if (r.status >= 300) throw new Error(`debt ${name}: ${r.status} ${JSON.stringify(r.data)}`);
  return r.data.id;
}

const fum = await debt('Fumilayo', '6000');
const tunde = await debt('Tunde', '12000');
const chika = await debt('Chika', '3500');

await call(`/api/debts/${fum}/reminder`, {
  method: 'PUT',
  body: { enabled: true, frequency: 'THREE_TIMES_DAILY', times: ['08:00', '13:00', '18:00'], timezone: 'Africa/Lagos' },
});
await call(`/api/debts/${tunde}/reminder`, {
  method: 'PUT',
  body: { enabled: true, frequency: 'TWICE_DAILY', times: ['09:00', '17:00'], timezone: 'Africa/Lagos' },
});
// A paused one so the dashboard shows every state.
await call(`/api/debts/${chika}/reminder/pause`, { method: 'POST', body: { paused: true } });

console.log(JSON.stringify({ email: EMAIL, workspace: ACTIVE, debts: { fum, tunde, chika } }, null, 2));
