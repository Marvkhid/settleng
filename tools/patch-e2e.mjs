import { readFileSync, writeFileSync } from 'node:fs';

const file = 'tools/e2e-reminders.mjs';
let s = readFileSync(file, 'utf8');
let bad = 0;
const edit = (a, b) => {
  if (!s.includes(a)) {
    console.error('MISSING: ' + a.split('\n')[0].slice(0, 80));
    bad++;
    return;
  }
  s = s.replace(a, b);
};

// 1. unique customer names per workspace (Ngozi already appeared in workspace C's consolidated email)
edit("const ngoziD = await makeDebt('Ngozi', '2300', A_TOKEN, wsD);", "const ifeoma = await makeDebt('Ifeoma', '2300', A_TOKEN, wsD);");
edit('for (const id of [yemi, uche, segun, ngoziD, kemi])', 'for (const id of [yemi, uche, segun, ifeoma, kemi])');
edit("await call(`/api/debts/${ngoziD}`, { method: 'PATCH', body: { override: 'WRITTEN_OFF' } });", "await call(`/api/debts/${ifeoma}`, { method: 'PATCH', body: { override: 'WRITTEN_OFF' } });");
edit("!/Yemi|Uche|Segun|Ngozi/.test(dMail.text ?? '')", "!/Yemi|Uche|Segun|Ifeoma/.test(dMail.text ?? '')");
edit("ok('written-off debt is not emailed', (await mailsNamed('Ngozi')).length === 0);", "ok('written-off debt is not emailed', (await mailsNamed('Ifeoma')).length === 0);");

// 2. a single-debt email has no "Total outstanding" line: assert the remainder itself
edit(
  "  ok('partial payment shows the reduced total', /Total outstanding: ₦3,000\\b/.test(partial.text ?? ''), (partial.text ?? '').match(/Total outstanding: [^\\n]+/)?.[0]);",
  "  ok('partial payment body chases only the remainder', /still owes you ₦3,000\\b/.test(partial.text ?? '') && !/6,000/.test(partial.text ?? ''), (partial.text ?? '').match(/still owes you [^\\n]+/)?.[0]);",
);

// 3. keep the workspace C debt ids so they can be parked before the retry phase
edit(
  "  for (let i = 0; i < names.length; i++) {\n    const id = await makeDebt(names[i], principals[i], A_TOKEN, wsC);",
  "  const cDebts = [];\n  for (let i = 0; i < names.length; i++) {\n    const id = await makeDebt(names[i], principals[i], A_TOKEN, wsC);\n    cDebts.push(id);",
);

// 4. the scheduler is global: park every other reminder so the injected 500 hits the Retry send
edit(
  "  /* ---- provider failure, visible failure, retry without duplicates ---- */",
  `  /* ---- provider failure, visible failure, retry without duplicates ---- */
  // The dispatch endpoint serves every tenant, so park this run's other reminders first: the
  // injected provider failure must hit the debt under test, not whichever email happens to be first.
  for (const id of cDebts) await call(\`/api/debts/\${id}/reminder\`, { method: 'DELETE', wid: wsC });
  for (const id of [kemi, scratch]) await call(\`/api/debts/\${id}/reminder\`, { method: 'DELETE', wid: wsD });`,
);

writeFileSync(file, s);
console.log(bad === 0 ? 'PATCH_OK' : 'PATCH_FAIL=' + bad);
