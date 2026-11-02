import { readFileSync, writeFileSync } from 'node:fs';

const file = 'tools/e2e-import.mjs';
let src = readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

const pairs = [
  [
    `const head = (wid) => ({
  Authorization: \`Bearer \${TOKEN}\`,
  ...(wid ? { 'x-workspace-id': wid } : {}),
});`,
    `let ACTIVE = null;
const head = (wid) => ({
  Authorization: \`Bearer \${TOKEN}\`,
  ...(wid === 'none' ? {} : { 'x-workspace-id': wid ?? ACTIVE }),
});`,
  ],
  [
    `  const businessId = me.data?.business?.id;
  const personal = (me.data?.workspaces ?? []).find((w) => w.kind === 'PERSONAL');`,
    `  // Two fresh workspaces per run: the suite is repeatable, never touches earlier data, and the
  // second workspace is a real isolation control.
  const stamp = Date.now();
  const wsA = await call('/api/workspaces', {
    method: 'POST',
    body: { name: \`E2E business \${stamp}\`, kind: 'BUSINESS' },
    wid: 'none',
  });
  const wsB = await call('/api/workspaces', {
    method: 'POST',
    body: { name: \`E2E personal \${stamp}\`, kind: 'PERSONAL' },
    wid: 'none',
  });
  ok('fresh workspaces created for this run', wsA.status < 300 && wsB.status < 300, {
    business: wsA.data?.id,
    personal: wsB.data?.id,
  });
  ACTIVE = wsA.data?.id;
  const personal = { id: wsB.data?.id };`,
  ],
  [
    `  ok('manual sale created', created.status < 300 && created.data?.id, { status: created.status });
  const txId = created.data?.id;`,
    `  const saleId = created.data?.id ?? created.data?.transaction?.id ?? null;
  ok('manual sale created', created.status < 300 && !!saleId, { status: created.status });
  const txId = saleId;`,
  ],
];

let bad = 0;
for (const [from, to] of pairs) {
  if (!src.includes(from)) {
    console.error('MISSING: ' + from.split('\n')[0].slice(0, 70));
    bad++;
    continue;
  }
  src = src.replace(from, to);
}
writeFileSync(file, src);
console.log(bad ? 'RUNID_FAIL_' + bad : 'RUNID_OK');
