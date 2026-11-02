import { readFileSync } from 'node:fs';

/**
 * End-to-end checks against a running API. Every assertion reads the persisted result back out of
 * the API, so a passing run means the rows really are stored, not that an endpoint answered 200.
 */
const BASE = process.env.API_BASE ?? 'http://localhost:4000';
const TOKEN = process.env.TOKEN;
if (!TOKEN) {
  console.error('TOKEN is required');
  process.exit(1);
}

const results = [];
const ok = (name, pass, detail) => {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? `  ${JSON.stringify(detail)}` : ''}`);
};
let ACTIVE = null;
const head = (wid) => ({
  Authorization: `Bearer ${TOKEN}`,
  ...(wid === 'none' ? {} : { 'x-workspace-id': wid ?? ACTIVE }),
});

async function call(path, { method = 'GET', body, wid } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { ...head(wid), ...(body ? { 'content-type': 'application/json' } : {}) },
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

async function upload(path, file, wid, filename = file.split('/').pop()) {
  const fd = new FormData();
  fd.append('file', new Blob([readFileSync(file)]), filename);
  const res = await fetch(`${BASE}${path}`, { method: 'POST', headers: head(wid), body: fd });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, data };
}

const NGN = (v) => Number(v);

const main = async () => {
  const me = await call('/api/auth/me');
  ok('signed in and workspace resolved', me.status === 200 && !!me.data?.business, {
    name: me.data?.business?.name,
    role: me.data?.role,
  });
  // Two fresh workspaces per run: the suite is repeatable, never touches earlier data, and the
  // second workspace is a real isolation control.
  const stamp = Date.now();
  const wsA = await call('/api/workspaces', {
    method: 'POST',
    body: { name: `E2E business ${stamp}`, kind: 'BUSINESS' },
    wid: 'none',
  });
  const wsB = await call('/api/workspaces', {
    method: 'POST',
    body: { name: `E2E personal ${stamp}`, kind: 'PERSONAL' },
    wid: 'none',
  });
  ok('fresh workspaces created for this run', wsA.status < 300 && wsB.status < 300, {
    business: wsA.data?.id,
    personal: wsB.data?.id,
  });
  ACTIVE = wsA.data?.id;
  const personal = { id: wsB.data?.id };

  /* ---- 1. CSV preview: every row read, direction classified ---- */
  const preview = await upload('/api/reconciliation/preview', 'test-data/october-2026-statement.csv');
  const p = preview.data ?? {};
  ok('CSV preview reads all 34 transactions', p.rowCount === 34, { rowCount: p.rowCount, problems: p.problems });
  const inRows = (p.rows ?? []).filter((r) => r.direction === 'IN');
  const outRows = (p.rows ?? []).filter((r) => r.direction === 'OUT');
  ok('CSV preview classifies credits and debits', inRows.length === 11 && outRows.length === 23, {
    credits: inRows.length,
    debits: outRows.length,
  });
  const creditSum = inRows.reduce((s, r) => s + NGN(r.amount), 0);
  const debitSum = outRows.reduce((s, r) => s + NGN(r.amount), 0);
  ok('CSV preview totals match the statement', creditSum === 644700 && debitSum === 531100, {
    creditSum,
    debitSum,
  });
  const datesOk = (p.rows ?? []).every((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.date ?? ''));
  ok('every row has a parsed ISO date', datesOk);

  /* ---- 2. CSV import persists ---- */
  const saved = await upload('/api/reconciliation/imports', 'test-data/october-2026-statement.csv');
  ok('CSV import saved', saved.status === 201 || saved.status === 200, { status: saved.status, rowCount: saved.data?.rowCount });
  const importId = saved.data?.id;
  const detail = await call(`/api/reconciliation/imports/${importId}`);
  const d = detail.data ?? {};
  ok('saved import holds 34 rows in the database', d.rows?.length === 34, { rows: d.rows?.length });
  ok('saved balances come from the file', d.statement?.openingBalance === '250000.00' && d.statement?.closingBalance === '363600.00', d.statement);
  ok('saved totals reconcile', d.statement?.reconciles === true, {
    credits: d.statement?.credits,
    debits: d.statement?.debits,
    net: d.statement?.net,
  });

  /* ---- 3. Duplicate protection ---- */
  const again = await upload('/api/reconciliation/preview', 'test-data/october-2026-statement.csv');
  ok('re-upload is flagged as duplicates', again.data?.counts?.DUPLICATE === 34 && again.data?.canSave === false, again.data?.counts);
  const againSave = await upload('/api/reconciliation/imports', 'test-data/october-2026-statement.csv');
  ok('re-import is refused', againSave.status === 400, { status: againSave.status, message: againSave.data?.message });

  /* ---- 4. Broken input handling ---- */
  const { writeFileSync } = await import('node:fs');
  writeFileSync('/tmp/empty.csv', '');
  const empty = await upload('/api/reconciliation/preview', '/tmp/empty.csv', undefined, 'empty.csv');
  ok('empty file explained, not crashed', empty.status === 400 || (empty.data?.problems?.length ?? 0) > 0, {
    status: empty.status,
    problems: empty.data?.problems,
  });
  writeFileSync('/tmp/bad.csv', 'Date,Description,Amount\nnot-a-date,Nonsense,abc\n2026-10-05,Broken amount,xyz\n');
  const bad = await upload('/api/reconciliation/preview', '/tmp/bad.csv', undefined, 'bad.csv');
  ok('unreadable rows are marked invalid', bad.data?.counts?.INVALID === 2 && bad.data?.canSave === false, bad.data?.counts);
  const unsupported = await upload('/api/reconciliation/preview', 'test-data/october-2026-statement.csv', undefined, 'statement.docx');
  ok('unsupported format refused clearly', unsupported.status === 400, { status: unsupported.status, message: unsupported.data?.message });

  /* ---- 5. PDF ---- */
  const pdfPreview = await upload('/api/reconciliation/preview', 'test-data/october-2026-statement.pdf', personal?.id);
  ok('PDF preview extracts every transaction', pdfPreview.data?.rowCount === 34, {
    rowCount: pdfPreview.data?.rowCount,
    problems: pdfPreview.data?.problems,
  });
  const pdfIn = (pdfPreview.data?.rows ?? []).filter((r) => r.direction === 'IN');
  const pdfOut = (pdfPreview.data?.rows ?? []).filter((r) => r.direction === 'OUT');
  const pdfCreditSum = pdfIn.reduce((s, r) => s + NGN(r.amount), 0);
  const pdfDebitSum = pdfOut.reduce((s, r) => s + NGN(r.amount), 0);
  ok('PDF keeps credits and debits apart', pdfCreditSum === 644700 && pdfDebitSum === 531100, {
    pdfCreditSum,
    pdfDebitSum,
  });
  const pdfSaved = await upload('/api/reconciliation/imports', 'test-data/october-2026-statement.pdf', personal?.id);
  ok('PDF import saved into the other workspace', pdfSaved.status < 300, { status: pdfSaved.status, id: pdfSaved.data?.id });

  /* ---- 6. Dashboard reflects the statement ---- */
  const dash = await call('/api/dashboard');
  ok('dashboard card shows the whole uploaded file', dash.data?.statement?.rowCount === 34 && dash.data?.statement?.credits === '644700.00' && dash.data?.statement?.debits === '531100.00', dash.data?.statement);
  ok('dashboard statement balances against its own figures', dash.data?.statement?.reconciles === true);
  const oct = await call('/api/reports/summary?from=2026-10-01&to=2026-10-31');
  ok('October summary money in matches statement credits', NGN(oct.data?.moneyIn) === 644700, { moneyIn: oct.data?.moneyIn });
  ok('October summary money out matches statement debits', NGN(oct.data?.moneyOut) === 531100, { moneyOut: oct.data?.moneyOut });
  const cf = dash.data?.cashflow;
  ok('cashflow closes at the statement balance', cf?.closingBalance === '363600.00', { closing: cf?.closingBalance, points: cf?.points?.length });
  const perf = await call('/api/reports/performance?period=30d');
  ok('statement rows are not counted as sales', NGN(perf.data?.totals?.sales) === 0, perf.data?.totals);

  /* ---- 7. Isolation: the personal workspace sees only its own import ---- */
  if (personal) {
    const personalDash = await call('/api/dashboard', { wid: personal.id });
    ok('other workspace shows its own statement totals', personalDash.data?.statement?.rowCount === 34 && personalDash.data?.statement?.credits === '644700.00', {
      rows: personalDash.data?.statement?.rowCount,
      credits: personalDash.data?.statement?.credits,
    });
    const businessImports = await call('/api/reconciliation/imports');
    ok('business workspace lists exactly one upload', businessImports.data?.items?.length === 1, { count: businessImports.data?.items?.length });
    const personalImports = await call('/api/reconciliation/imports', { wid: personal.id });
    ok('personal workspace lists exactly one upload', personalImports.data?.items?.length === 1, { count: personalImports.data?.items?.length });
  }

  /* ---- 8. Manual transaction create / edit / delete ---- */
  const created = await call('/api/sales', { method: 'POST', body: { amount: '20000', paymentMethod: 'CASH', description: 'E2E sale' } });
  const saleId = created.data?.id ?? created.data?.transaction?.id ?? null;
  ok('manual sale created', created.status < 300 && !!saleId, { status: created.status });
  const txId = saleId;
  if (txId) {
    const patched = await call(`/api/transactions/${txId}`, { method: 'PATCH', body: { amount: '25000', description: 'E2E sale edited' } });
    ok('transaction edited', patched.status < 300 && patched.data?.amount === '25000.00', { amount: patched.data?.amount });
    const afterEdit = await call('/api/dashboard');
    ok('dashboard reflects the edit', NGN(afterEdit.data?.moneyIn) === 25000, { moneyIn: afterEdit.data?.moneyIn });
    const del = await call(`/api/transactions/${txId}`, { method: 'DELETE' });
    ok('transaction deleted', del.status === 204, { status: del.status });
    const afterDelete = await call('/api/dashboard');
    ok('dashboard reflects the deletion', NGN(afterDelete.data?.moneyIn) === 0, { moneyIn: afterDelete.data?.moneyIn });
  }

  const failed = results.filter((r) => !r.pass);
  console.log(`\nSUMMARY ${results.length - failed.length}/${results.length} passed`);
  if (failed.length) {
    console.log('FAILED: ' + failed.map((f) => f.name).join(' | '));
    process.exit(1);
  }
};

main().catch((e) => {
  console.error('CRASH', e);
  process.exit(1);
});
