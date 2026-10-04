import { Prisma } from '../generated/prisma/client';
import { applySeed } from './apply-seed';
import { buildSeedData } from './seed-data';

interface Call {
  model: string;
  op: string;
  arg: { data?: unknown; where?: unknown };
}

function fakeTx() {
  const calls: Call[] = [];
  const models = [
    'transaction',
    'importedTransaction',
    'reconciliationImport',
    'invoicePayment',
    'invoiceItem',
    'invoice',
    'customer',
    'auditEvent',
    'business',
  ];
  const tx: Record<
    string,
    Record<string, (arg: Call['arg']) => Promise<unknown>>
  > = {};
  for (const m of models) {
    tx[m] = new Proxy(
      {},
      {
        get: (_t, op: string) => (arg: Call['arg']) => {
          calls.push({ model: m, op, arg });
          return Promise.resolve({});
        },
      },
    );
  }
  return { tx: tx as unknown as Prisma.TransactionClient, calls };
}

const rowCount = (calls: Call[], model: string) =>
  (
    calls.find((c) => c.op === 'createMany' && c.model === model)!.arg
      .data as unknown[]
  ).length;

describe('applySeed', () => {
  const today = '2026-10-04';

  it('clears children before parents, then recreates parents before children', async () => {
    const { tx, calls } = fakeTx();
    await applySeed(tx, today);
    const order = calls.map((c) => `${c.op}:${c.model}`);
    const idx = (s: string) => order.indexOf(s);
    expect(idx('deleteMany:transaction')).toBeLessThan(
      idx('deleteMany:invoicePayment'),
    );
    expect(idx('deleteMany:transaction')).toBeLessThan(
      idx('deleteMany:importedTransaction'),
    );
    expect(idx('deleteMany:invoice')).toBeLessThan(idx('deleteMany:customer'));
    expect(idx('createMany:customer')).toBeLessThan(idx('createMany:invoice'));
    expect(idx('createMany:invoice')).toBeLessThan(
      idx('createMany:invoicePayment'),
    );
    expect(idx('createMany:invoicePayment')).toBeLessThan(
      idx('createMany:transaction'),
    );
    expect(idx('createMany:reconciliationImport')).toBeLessThan(
      idx('createMany:importedTransaction'),
    );
    const lastDelete = Math.max(
      ...order.map((o, i) => (o.startsWith('deleteMany') ? i : -1)),
    );
    const firstCreate = order.findIndex((o) => o.startsWith('createMany'));
    expect(lastDelete).toBeLessThan(firstCreate);
  });

  it('creates exactly the rows in the seed dataset', async () => {
    const { tx, calls } = fakeTx();
    const counts = await applySeed(tx, today);
    const data = buildSeedData(today);
    expect(rowCount(calls, 'customer')).toBe(data.customers.length);
    expect(rowCount(calls, 'invoice')).toBe(data.invoices.length);
    expect(rowCount(calls, 'transaction')).toBe(data.transactions.length);
    expect(counts.invoices).toBe(25);
  });

  it('scopes every delete to the demo business', async () => {
    const { tx, calls } = fakeTx();
    await applySeed(tx, today);
    for (const c of calls.filter((x) => x.op === 'deleteMany')) {
      expect(JSON.stringify(c.arg)).toContain('demo-business');
    }
  });

  it('is repeatable: running twice issues identical statements (no accumulating data)', async () => {
    const a = fakeTx();
    const b = fakeTx();
    await applySeed(a.tx, today);
    await applySeed(b.tx, today);
    expect(JSON.stringify(a.calls)).toBe(JSON.stringify(b.calls));
  });

  it('records an audit event for a reset', async () => {
    const { tx, calls } = fakeTx();
    await applySeed(tx, today, { audit: 'reset' });
    const ev = calls.find(
      (c) => c.model === 'auditEvent' && c.op === 'create',
    )!;
    expect((ev.arg.data as { action: string }).action).toBe('DEMO_RESET');
  });
});
