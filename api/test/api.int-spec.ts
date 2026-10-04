/* eslint-disable @typescript-eslint/no-unsafe-return */
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import Decimal from 'decimal.js';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { addDaysIso, todayInLagos } from '../src/common/dates';
import { PrismaService } from '../src/prisma/prisma.service';
import { applySeed } from '../src/seed/apply-seed';

/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call */
let app: INestApplication;
let prisma: PrismaService;
const TODAY = todayInLagos();
const http = () => request(app.getHttpServer() as App);
const get = async (url: string) => (await http().get(`/api${url}`)).body;
const post = (url: string, body: object = {}) =>
  http().post(`/api${url}`).send(body);
const csvFile = (
  rows: string[],
  header = 'Date,Description,Amount,Direction,Reference',
) => Buffer.from([header, ...rows].join('\n'));

beforeAll(async () => {
  const mod = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  app = mod.createNestApplication();
  configureApp(app, ['http://localhost:3000']);
  await app.init();
  prisma = app.get(PrismaService);
});
afterAll(async () => {
  await app.close();
});
beforeEach(async () => {
  await prisma.$transaction((tx) => applySeed(tx, TODAY), { timeout: 60000 });
});

const firstInvoice = async (status: string) =>
  (await get(`/invoices?status=${status}&pageSize=100`)).items[0];
const dashboard = () => get('/dashboard');
const newCustomer = async (
  name = `Test Customer ${Math.random().toString(36).slice(2, 7)}`,
) => (await post('/customers', { name })).body;
const newInvoice = async (
  customerId: string,
  amount: string,
  over: object = {},
) =>
  (
    await post('/invoices', {
      customerId,
      issueDate: addDaysIso(TODAY, -2),
      dueDate: addDaysIso(TODAY, 10),
      items: [{ description: 'Goods', quantity: '1', unitPrice: amount }],
      ...over,
    })
  ).body;

describe('seed, reset and persistence', () => {
  it('loads the sample business and every status the demo needs', async () => {
    const all = (await get('/invoices?pageSize=100')).items;
    expect(all).toHaveLength(25);
    for (const s of ['DRAFT', 'UNPAID', 'PARTIALLY_PAID', 'PAID', 'OVERDUE'])
      expect(all.map((i: any) => i.status)).toContain(s);
    expect((await get('/demo/workspace')).business.name).toBe(
      'Adeola Mini Mart',
    );
  });

  it('reset restores the original data and removes demo changes; it is audited', async () => {
    const before = await prisma.transaction.count();
    await post('/sales', { amount: '1234', paymentMethod: 'CASH' }).expect(201);
    await post('/expenses', { amount: '500', category: 'Stock' }).expect(201);
    expect(await prisma.transaction.count()).toBe(before + 2);
    await post('/demo/reset').expect(200);
    expect(await prisma.transaction.count()).toBe(before);
    const audit = (await get('/audit')).items.map((a: any) => a.action);
    expect(audit).toContain('DEMO_RESET');
  });

  it('reset is refused when DEMO_MODE is not true', async () => {
    process.env.DEMO_MODE = 'false';
    try {
      await post('/demo/reset').expect(403);
    } finally {
      process.env.DEMO_MODE = 'true';
    }
  });

  it('reset is rate limited', async () => {
    process.env.THROTTLE_DISABLED = 'false';
    try {
      const codes: number[] = [];
      for (let i = 0; i < 5; i++)
        codes.push((await post('/demo/reset')).status);
      expect(codes).toContain(429);
    } finally {
      process.env.THROTTLE_DISABLED = 'true';
    }
  });

  it('data survives a "refresh": a new request sees the saved record', async () => {
    const { body } = await post('/sales', {
      amount: '777',
      paymentMethod: 'POS',
      description: 'Persist me',
    }).expect(201);
    const found = await get(`/transactions/${body.transaction.id}`);
    expect(found.description).toBe('Persist me');
  });
});

describe('errors', () => {
  it('uses one friendly shape for 404s and validation errors', async () => {
    for (const url of [
      '/invoices/nope',
      '/customers/nope',
      '/transactions/nope',
      '/reconciliation/imports/nope',
    ]) {
      const r = await http().get(`/api${url}`).expect(404);
      expect(r.body).toMatchObject({ statusCode: 404, error: 'NOT_FOUND' });
      expect(typeof r.body.message).toBe('string');
    }
    const bad = await post('/sales', {
      amount: '12.345',
      paymentMethod: 'BITCOIN',
      extra: 1,
    }).expect(400);
    expect(bad.body.statusCode).toBe(400);
    expect(Array.isArray(bad.body.details)).toBe(true);
  });
});

describe('dashboard and reports share one source of truth', () => {
  it('dashboard equals the reports summary for today and independent SQL', async () => {
    const d = await dashboard();
    const s = await get(`/reports/summary?from=${TODAY}&to=${TODAY}`);
    expect(d.salesToday).toBe(s.sales.total);
    expect(d.expensesToday).toBe(s.expenses.total);
    expect(d.moneyIn).toBe(s.moneyIn);
    expect(d.moneyOut).toBe(s.moneyOut);
    expect(d.customersOwing).toEqual(s.customersOwing);

    const [sql] = await prisma.$queryRaw<
      { income: string; expense: string; manual: string }[]
    >`
      SELECT COALESCE(SUM(amount) FILTER (WHERE type='INCOME'),0)::text AS income,
             COALESCE(SUM(amount) FILTER (WHERE type='EXPENSE'),0)::text AS expense,
             COALESCE(SUM(amount) FILTER (WHERE type='INCOME' AND source='MANUAL'),0)::text AS manual
      FROM "Transaction" WHERE date = ${new Date(`${TODAY}T00:00:00Z`)}`;
    expect(d.moneyIn).toBe(new Decimal(sql.income).toFixed(2));
    expect(d.moneyOut).toBe(new Decimal(sql.expense).toFixed(2));
    expect(new Decimal(d.salesToday).gte(new Decimal(sql.manual))).toBe(true);
  });

  it('customers owing equals the sum of every customer balance and of every open invoice', async () => {
    const d = await dashboard();
    const customers = (await get('/customers?pageSize=100')).items;
    const sumCustomers = customers.reduce(
      (s: Decimal, c: any) => s.plus(c.amountOwing),
      new Decimal(0),
    );
    const invoices = (await get('/invoices?pageSize=100')).items.filter(
      (i: any) => !['DRAFT', 'VOID'].includes(i.status),
    );
    const sumInvoices = invoices.reduce(
      (s: Decimal, i: any) => s.plus(i.balance),
      new Decimal(0),
    );
    expect(sumCustomers.toFixed(2)).toBe(d.customersOwing.total);
    expect(sumInvoices.toFixed(2)).toBe(d.customersOwing.total);
    for (const c of customers)
      expect(new Decimal(c.totalBought).minus(c.totalPaid).toFixed(2)).toBe(
        c.amountOwing,
      );
  });

  it('chart today point equals sales today; ranges have the right number of days', async () => {
    const d = await dashboard();
    const last = d.chart.points.at(-1);
    expect(last.date).toBe(TODAY);
    expect(last.sales).toBe(d.salesToday);
    expect(last.expenses).toBe(d.expensesToday);
    for (const [p, n] of [
      ['7d', 7],
      ['30d', 30],
      ['90d', 90],
    ] as const)
      expect(
        (await get(`/reports/timeseries?period=${p}`)).points,
      ).toHaveLength(n);
    await http().get('/api/reports/timeseries?period=5y').expect(400);
  });

  it('category breakdown adds up to the totals', async () => {
    const s = await get(
      `/reports/summary?from=${addDaysIso(TODAY, -59)}&to=${TODAY}`,
    );
    const sum = (xs: any[]) =>
      xs.reduce((a, x) => a.plus(x.total), new Decimal(0)).toFixed(2);
    expect(sum(s.expensesByCategory)).toBe(s.moneyOut);
    expect(sum(s.incomeByCategory)).toBe(s.moneyIn);
    expect(new Decimal(s.moneyIn).minus(s.moneyOut).toFixed(2)).toBe(
      s.netRecordedMovement,
    );
    expect(s.overdueInvoices.count).toBeGreaterThan(0);
  });

  it('rejects bad ranges', async () => {
    await http()
      .get(`/api/reports/summary?from=${TODAY}&to=${addDaysIso(TODAY, -3)}`)
      .expect(400);
    await http()
      .get(`/api/reports/summary?from=2020-01-01&to=${TODAY}`)
      .expect(400);
    await http().get('/api/reports/summary?from=2026-02-30').expect(400);
  });
});

describe('sales and expenses (simple actions)', () => {
  it('a cash sale needs no invoice and moves sales and money in by exactly that amount', async () => {
    const a = await dashboard();
    const r = await post('/sales', {
      amount: '3000',
      paymentMethod: 'CASH',
    }).expect(201);
    expect(r.body.kind).toBe('transaction');
    expect(r.body.transaction).toMatchObject({
      type: 'INCOME',
      source: 'MANUAL',
      amount: '3000.00',
      sign: '+',
    });
    const b = await dashboard();
    expect(new Decimal(b.salesToday).minus(a.salesToday).toString()).toBe(
      '3000',
    );
    expect(new Decimal(b.moneyIn).minus(a.moneyIn).toString()).toBe('3000');
    expect(b.recentActivity[0].amount).toBe('3000.00');
  });

  it('an expense moves expenses and money out, not sales', async () => {
    const a = await dashboard();
    await post('/expenses', {
      amount: '8000',
      category: 'Stock',
      description: 'Bought stock',
    }).expect(201);
    const b = await dashboard();
    expect(new Decimal(b.expensesToday).minus(a.expensesToday).toString()).toBe(
      '8000',
    );
    expect(new Decimal(b.moneyOut).minus(a.moneyOut).toString()).toBe('8000');
    expect(b.salesToday).toBe(a.salesToday);
  });

  it('a credit sale becomes a customer debt: sales up, money in unchanged, customer owes it', async () => {
    const c = await newCustomer();
    await post('/sales', { amount: '5000', paymentMethod: 'CREDIT' }).expect(
      400,
    ); // needs a customer
    const a = await dashboard();
    const r = await post('/sales', {
      amount: '5000',
      paymentMethod: 'CREDIT',
      customerId: c.id,
      description: 'Rice on credit',
    }).expect(201);
    expect(r.body.kind).toBe('credit_invoice');
    expect(r.body.invoice).toMatchObject({
      status: 'UNPAID',
      total: '5000.00',
      balance: '5000.00',
    });
    const b = await dashboard();
    expect(new Decimal(b.salesToday).minus(a.salesToday).toString()).toBe(
      '5000',
    );
    expect(b.moneyIn).toBe(a.moneyIn);
    expect((await get(`/customers/${c.id}`)).amountOwing).toBe('5000.00');
  });

  it('validates amounts, categories and dates with friendly errors', async () => {
    await post('/sales', { amount: '0', paymentMethod: 'CASH' }).expect(400);
    await post('/sales', {
      amount: '100',
      paymentMethod: 'CASH',
      date: addDaysIso(TODAY, 3),
    }).expect(400);
    await post('/sales', {
      amount: '100',
      paymentMethod: 'CASH',
      customerId: 'ghost',
    }).expect(404);
    await post('/expenses', { amount: '100', category: '' }).expect(400);
    await post('/expenses', { amount: '-5', category: 'Stock' }).expect(400);
  });
});

describe('customers', () => {
  it('creates, validates, searches and edits', async () => {
    await post('/customers', { name: '' }).expect(400);
    await post('/customers', { name: 'X', email: 'not-an-email' }).expect(400);
    const c = await newCustomer('Zainab Textiles');
    expect(
      (await get('/customers?search=zainab')).items.map((x: any) => x.id),
    ).toContain(c.id);
    const e = await http()
      .patch(`/api/customers/${c.id}`)
      .send({ phone: '08011112222' })
      .expect(200);
    expect(e.body.phone).toBe('08011112222');
  });

  it('never destroys history: customers with debt cannot be archived; settled ones can, and history stays', async () => {
    const c = await newCustomer();
    const inv = await newInvoice(c.id, '10000');
    await post(`/customers/${c.id}/archive`).expect(409);
    await post(`/invoices/${inv.id}/payments`, {
      amount: '10000',
      method: 'CASH',
    }).expect(201);
    await post(`/customers/${c.id}/archive`).expect(200);
    expect(
      (await get('/customers?pageSize=100')).items.map((x: any) => x.id),
    ).not.toContain(c.id);
    expect(
      (await get('/customers?includeArchived=true&pageSize=100')).items.map(
        (x: any) => x.id,
      ),
    ).toContain(c.id);
    const detail = await get(`/customers/${c.id}`);
    expect(detail.invoices).toHaveLength(1);
    expect(detail.payments).toHaveLength(1);
    expect(detail.totalBought).toBe('10000.00');
    await post('/invoices', {
      customerId: c.id,
      issueDate: TODAY,
      dueDate: TODAY,
      items: [{ description: 'x', quantity: '1', unitPrice: '1' }],
    }).expect(400);
    await post(`/customers/${c.id}/restore`).expect(200);
  });
});

describe('invoices', () => {
  it('totals are exact decimals calculated on the server; the browser cannot supply status or total', async () => {
    const c = await newCustomer();
    const r = await post('/invoices', {
      customerId: c.id,
      issueDate: TODAY,
      dueDate: addDaysIso(TODAY, 7),
      status: 'PAID',
      total: '1',
      items: [{ description: 'A', quantity: '3', unitPrice: '0.10' }],
    });
    expect(r.status).toBe(400); // status/total are not accepted fields
    const ok = await post('/invoices', {
      customerId: c.id,
      issueDate: TODAY,
      dueDate: addDaysIso(TODAY, 7),
      items: [
        { description: 'A', quantity: '3', unitPrice: '0.10' },
        { description: 'B', quantity: '2', unitPrice: '1500.10' },
      ],
    }).expect(201);
    expect(ok.body.total).toBe('3000.50');
    expect(ok.body.status).toBe('UNPAID');
    expect(ok.body.invoiceNumber).toMatch(/^AMM-\d{4}$/);
    const reread = await get(`/invoices/${ok.body.id}`);
    expect(reread.total).toBe('3000.50');
  });

  it('validates dates, items and customers', async () => {
    const c = await newCustomer();
    const base = {
      customerId: c.id,
      issueDate: TODAY,
      dueDate: TODAY,
      items: [{ description: 'A', quantity: '1', unitPrice: '10' }],
    };
    await post('/invoices', { ...base, dueDate: addDaysIso(TODAY, -1) }).expect(
      400,
    );
    await post('/invoices', { ...base, items: [] }).expect(400);
    await post('/invoices', {
      ...base,
      items: [{ description: 'A', quantity: '0', unitPrice: '10' }],
    }).expect(400);
    await post('/invoices', { ...base, issueDate: '2026-02-30' }).expect(400);
    await post('/invoices', { ...base, customerId: 'ghost' }).expect(404);
  });

  it('invoice numbers are unique within the business', async () => {
    const c = await newCustomer();
    await newInvoice(c.id, '100', { invoiceNumber: 'TEST-1' });
    await post('/invoices', {
      customerId: c.id,
      invoiceNumber: 'TEST-1',
      issueDate: TODAY,
      dueDate: TODAY,
      items: [{ description: 'A', quantity: '1', unitPrice: '1' }],
    }).expect(409);
  });

  it('status is derived from payments and dates', async () => {
    const c = await newCustomer();
    const past = await newInvoice(c.id, '2000', {
      issueDate: addDaysIso(TODAY, -30),
      dueDate: addDaysIso(TODAY, -5),
    });
    expect(past.status).toBe('OVERDUE');
    await post(`/invoices/${past.id}/payments`, {
      amount: '500',
      method: 'CASH',
    }).expect(201);
    expect((await get(`/invoices/${past.id}`)).status).toBe('OVERDUE');
    await post(`/invoices/${past.id}/payments`, {
      amount: '1500',
      method: 'CASH',
    }).expect(201);
    expect((await get(`/invoices/${past.id}`)).status).toBe('PAID');
    expect(
      (await get('/invoices?status=OVERDUE&pageSize=100')).items.every(
        (i: any) => i.status === 'OVERDUE',
      ),
    ).toBe(true);
  });

  it('drafts: no payments until issued; only drafts can be deleted', async () => {
    const c = await newCustomer();
    const d = await newInvoice(c.id, '900', { saveAsDraft: true });
    expect(d.status).toBe('DRAFT');
    await post(`/invoices/${d.id}/payments`, {
      amount: '100',
      method: 'CASH',
    }).expect(400);
    expect(
      (await post(`/invoices/${d.id}/issue`).expect(200)).body.status,
    ).toBe('UNPAID');
    await post(`/invoices/${d.id}/issue`).expect(409);
    await http().delete(`/api/invoices/${d.id}`).expect(400);
    const d2 = await newInvoice(c.id, '50', { saveAsDraft: true });
    await http().delete(`/api/invoices/${d2.id}`).expect(204);
    await http().get(`/api/invoices/${d2.id}`).expect(404);
  });

  it('edits recalculate, but cannot drop the total below what was already paid; void rules protect payments', async () => {
    const c = await newCustomer();
    const inv = await newInvoice(c.id, '1000');
    await post(`/invoices/${inv.id}/payments`, {
      amount: '600',
      method: 'CASH',
    }).expect(201);
    const up = await http()
      .patch(`/api/invoices/${inv.id}`)
      .send({
        items: [
          { description: 'More goods', quantity: '2', unitPrice: '1000' },
        ],
      })
      .expect(200);
    expect(up.body).toMatchObject({
      total: '2000.00',
      amountPaid: '600.00',
      balance: '1400.00',
      status: 'PARTIALLY_PAID',
    });
    await http()
      .patch(`/api/invoices/${inv.id}`)
      .send({
        items: [{ description: 'Tiny', quantity: '1', unitPrice: '100' }],
      })
      .expect(400);
    const other = await newCustomer();
    await http()
      .patch(`/api/invoices/${inv.id}`)
      .send({ customerId: other.id })
      .expect(400);
    await post(`/invoices/${inv.id}/void`).expect(400);

    const clean = await newInvoice(c.id, '300');
    expect(
      (await post(`/invoices/${clean.id}/void`).expect(200)).body.status,
    ).toBe('VOID');
    await http()
      .patch(`/api/invoices/${clean.id}`)
      .send({ dueDate: TODAY })
      .expect(400);
    await post(`/invoices/${clean.id}/payments`, {
      amount: '10',
      method: 'CASH',
    }).expect(400);
    expect((await get(`/customers/${c.id}`)).amountOwing).toBe('1400.00'); // void invoice does not count
  });
});

describe('payments', () => {
  it('partial then full payments keep history, move the balance and create linked money-in records', async () => {
    const c = await newCustomer();
    const inv = await newInvoice(c.id, '10000.50');
    const p1 = (
      await post(`/invoices/${inv.id}/payments`, {
        amount: '4000.25',
        method: 'BANK_TRANSFER',
        reference: 'R-1',
      }).expect(201)
    ).body;
    expect(p1).toMatchObject({
      status: 'PARTIALLY_PAID',
      amountPaid: '4000.25',
      balance: '6000.25',
    });
    const p2 = (
      await post(`/invoices/${inv.id}/payments`, {
        amount: '6000.25',
        method: 'CASH',
        reference: 'R-2',
      }).expect(201)
    ).body;
    expect(p2).toMatchObject({ status: 'PAID', balance: '0.00' });
    expect(p2.payments).toHaveLength(2);
    const txns = await prisma.transaction.findMany({
      where: { invoicePayment: { invoiceId: inv.id } },
    });
    expect(txns).toHaveLength(2);
    expect(
      txns.every(
        (t) =>
          t.type === 'INCOME' &&
          t.source === 'INVOICE_PAYMENT' &&
          t.customerId === c.id,
      ),
    ).toBe(true);
    const listed = (await get(`/transactions?customerId=${c.id}`)).items;
    expect(listed.every((t: any) => t.invoice?.id === inv.id)).toBe(true);
  });

  it('rejects overpayment, paying a settled invoice, zero, and future dates', async () => {
    const c = await newCustomer();
    const inv = await newInvoice(c.id, '1000');
    await post(`/invoices/${inv.id}/payments`, {
      amount: '1000.01',
      method: 'CASH',
    }).expect(400);
    await post(`/invoices/${inv.id}/payments`, {
      amount: '0',
      method: 'CASH',
    }).expect(400);
    await post(`/invoices/${inv.id}/payments`, {
      amount: '10',
      method: 'CASH',
      paymentDate: addDaysIso(TODAY, 2),
    }).expect(400);
    await post(`/invoices/${inv.id}/payments`, {
      amount: '10',
      method: 'CASH',
      paymentDate: addDaysIso(TODAY, -30),
    }).expect(400); // before issue date
    await post(`/invoices/${inv.id}/payments`, {
      amount: '10',
      method: 'CREDIT',
    }).expect(400);
    await post(`/invoices/${inv.id}/payments`, {
      amount: '1000',
      method: 'CASH',
    }).expect(201);
    await post(`/invoices/${inv.id}/payments`, {
      amount: '1',
      method: 'CASH',
    }).expect(409);
  });

  it('prevents duplicate payments: same reference, and a double-click with no reference', async () => {
    const c = await newCustomer();
    const inv = await newInvoice(c.id, '9000');
    await post(`/invoices/${inv.id}/payments`, {
      amount: '1000',
      method: 'CASH',
      reference: 'DUP',
    }).expect(201);
    await post(`/invoices/${inv.id}/payments`, {
      amount: '1000',
      method: 'CASH',
      reference: 'DUP',
    }).expect(409);
    await post(`/invoices/${inv.id}/payments`, {
      amount: '500',
      method: 'CASH',
    }).expect(201);
    await post(`/invoices/${inv.id}/payments`, {
      amount: '500',
      method: 'CASH',
    }).expect(409);
    expect(
      await prisma.invoicePayment.count({ where: { invoiceId: inv.id } }),
    ).toBe(2);
    expect(
      await prisma.transaction.count({
        where: { invoicePayment: { invoiceId: inv.id } },
      }),
    ).toBe(2);
  });

  it('two simultaneous payments cannot both spend the same remaining balance', async () => {
    const c = await newCustomer();
    const inv = await newInvoice(c.id, '7000');
    const results = await Promise.all([
      post(`/invoices/${inv.id}/payments`, {
        amount: '7000',
        method: 'CASH',
        reference: 'A',
      }),
      post(`/invoices/${inv.id}/payments`, {
        amount: '7000',
        method: 'BANK_TRANSFER',
        reference: 'B',
      }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    const after = await get(`/invoices/${inv.id}`);
    expect(after.amountPaid).toBe('7000.00');
    expect(after.payments).toHaveLength(1);
  });

  it('"Customer paid me" spreads across open invoices, oldest due first, atomically', async () => {
    const c = await newCustomer();
    const first = await newInvoice(c.id, '3000', {
      issueDate: addDaysIso(TODAY, -20),
      dueDate: addDaysIso(TODAY, -10),
    });
    const second = await newInvoice(c.id, '5000', {
      issueDate: addDaysIso(TODAY, -5),
      dueDate: addDaysIso(TODAY, 20),
    });
    await post(`/customers/${c.id}/payments`, {
      amount: '9000',
      method: 'CASH',
    }).expect(400); // more than owed (8000)
    expect(
      await prisma.invoicePayment.count({
        where: { invoice: { customerId: c.id } },
      }),
    ).toBe(0);
    const r = await post(`/customers/${c.id}/payments`, {
      amount: '3500',
      method: 'CASH',
      reference: 'CASH-1',
    }).expect(201);
    expect(r.body.applied).toEqual([
      { invoiceNumber: first.invoiceNumber, amount: '3000.00' },
      { invoiceNumber: second.invoiceNumber, amount: '500.00' },
    ]);
    expect((await get(`/invoices/${first.id}`)).status).toBe('PAID');
    expect((await get(`/invoices/${second.id}`)).balance).toBe('4500.00');
    expect((await get(`/customers/${c.id}`)).amountOwing).toBe('4500.00');
    const none = await newCustomer();
    await post(`/customers/${none.id}/payments`, {
      amount: '1',
      method: 'CASH',
    }).expect(409);
  });
});

describe('transactions', () => {
  it('filters, searches and paginates', async () => {
    const dbExpenses = await prisma.transaction.count({
      where: { type: 'EXPENSE' },
    });
    const exp = await get('/transactions?type=EXPENSE&pageSize=100');
    expect(exp.total).toBe(dbExpenses);
    expect(
      exp.items.every((t: any) => t.type === 'EXPENSE' && t.sign === '-'),
    ).toBe(true);
    const page = await get('/transactions?pageSize=10&page=2');
    expect(page.items).toHaveLength(10);
    expect(page.totalPages).toBeGreaterThan(1);
    expect(
      (
        await get('/transactions?source=INVOICE_PAYMENT&pageSize=100')
      ).items.every((t: any) => t.source === 'INVOICE_PAYMENT' && t.invoice),
    ).toBe(true);
    const ranged = await get(
      `/transactions?from=${addDaysIso(TODAY, -3)}&to=${TODAY}&pageSize=100`,
    );
    expect(
      ranged.items.every(
        (t: any) => t.date >= addDaysIso(TODAY, -3) && t.date <= TODAY,
      ),
    ).toBe(true);
    await post('/expenses', {
      amount: '100',
      category: 'Stock',
      description: 'findable-needle',
    });
    expect(
      (await get('/transactions?search=FINDABLE-needle')).items,
    ).toHaveLength(1);
    await http().get('/api/transactions?pageSize=1000').expect(400);
  });

  it('manual records can be edited and deleted; payment-linked records cannot', async () => {
    const t = (
      await post('/expenses', { amount: '2000', category: 'Transport' }).expect(
        201,
      )
    ).body;
    const edited = await http()
      .patch(`/api/transactions/${t.id}`)
      .send({ amount: '2500', category: 'Stock' })
      .expect(200);
    expect(edited.body).toMatchObject({ amount: '2500.00', category: 'Stock' });
    await http().delete(`/api/transactions/${t.id}`).expect(204);
    await http().get(`/api/transactions/${t.id}`).expect(404);
    const linked = (await get('/transactions?source=INVOICE_PAYMENT')).items[0];
    await http()
      .patch(`/api/transactions/${linked.id}`)
      .send({ amount: '1' })
      .expect(400);
    await http().delete(`/api/transactions/${linked.id}`).expect(400);
    const audit = (await get('/audit?limit=100')).items.map(
      (a: any) => a.action,
    );
    expect(audit).toEqual(
      expect.arrayContaining(['TRANSACTION_EDITED', 'TRANSACTION_DELETED']),
    );
  });

  it('lists categories for filters', async () => {
    const cats = await get('/transactions/categories');
    expect(cats.expense).toEqual(
      expect.arrayContaining(['Stock', 'Transport']),
    );
    expect(cats.income).toContain('Sales');
  });
});

describe('CSV export', () => {
  it('exports with a download header and neutralises spreadsheet formulas', async () => {
    await post('/expenses', {
      amount: '100',
      category: 'Other',
      description: '=HYPERLINK("http://evil","x")',
    }).expect(201);
    const r = await http()
      .get(`/api/reports/export?type=transactions&from=${TODAY}&to=${TODAY}`)
      .expect(200);
    expect(r.headers['content-type']).toContain('text/csv');
    expect(r.headers['content-disposition']).toContain('attachment');
    expect(r.text).toContain(`"'=HYPERLINK(""http://evil"",""x"")"`);
    expect(r.text.split('\r\n')[0]).toBe(
      'Date,Type,Amount (NGN),Category,Description,Customer,Payment method,Reference,Source',
    );
    for (const type of ['invoices', 'customers-owing'])
      await http().get(`/api/reports/export?type=${type}`).expect(200);
    await http().get('/api/reports/export?type=secrets').expect(400);
  });

  it('exported totals match the report for the same range', async () => {
    const from = addDaysIso(TODAY, -6);
    const r = await http()
      .get(`/api/reports/export?type=transactions&from=${from}&to=${TODAY}`)
      .expect(200);
    const lines = r.text.trim().split('\r\n').slice(1);
    const moneyIn = lines
      .filter((l) => l.split(',')[1] === 'Money in')
      .reduce((s, l) => s.plus(l.split(',')[2]), new Decimal(0));
    expect(moneyIn.toFixed(2)).toBe(
      (await get(`/reports/summary?from=${from}&to=${TODAY}`)).moneyIn,
    );
  });
});

describe('CSV reconciliation', () => {
  const upload = (
    rows: string[],
    name = 'bank.csv',
    mapping?: object,
    path = '/reconciliation/imports',
  ) => {
    const req = http().post(`/api${path}`).attach('file', csvFile(rows), name);
    return mapping ? req.field('mapping', JSON.stringify(mapping)) : req;
  };

  it('serves a sample template', async () => {
    const r = await http().get('/api/reconciliation/template').expect(200);
    expect(r.headers['content-disposition']).toContain('.csv');
    expect(r.text).toContain('Date,Description,Amount');
  });

  it('preview validates and classifies rows without saving anything', async () => {
    const inv = await firstInvoice('UNPAID');
    const importsBefore = await prisma.reconciliationImport.count();
    const r = await upload(
      [
        `${addDaysIso(TODAY, -1)},Transfer ${inv.invoiceNumber},${inv.balance},credit,PV-1`,
        `not-a-date,Bad date row,100,credit,PV-2`,
        `${addDaysIso(TODAY, -1)},Transfer again,${inv.balance},credit,PV-1`,
        `${addDaysIso(TODAY, -1)},Airtime,500,debit,PV-4`,
      ],
      'bank.csv',
      undefined,
      '/reconciliation/preview',
    ).expect(200);
    expect(r.body.counts).toMatchObject({
      SUGGESTED_MATCH: 1,
      INVALID: 1,
      DUPLICATE: 1,
      VALID: 1,
    });
    expect(r.body.rows.find((x: any) => x.status === 'INVALID').note).toMatch(
      /date/i,
    );
    expect(await prisma.reconciliationImport.count()).toBe(importsBefore);
  });

  it('a suggested match is NOT applied until the user confirms it', async () => {
    const inv = await firstInvoice('UNPAID');
    const txnsBefore = await prisma.transaction.count();
    const saved = (
      await upload([
        `${addDaysIso(TODAY, -1)},Transfer ${inv.invoiceNumber},${inv.balance},credit,SAVE-1`,
      ]).expect(201)
    ).body;
    expect(saved.counts.SUGGESTED_MATCH).toBe(1);
    expect(saved.status).toBe('PENDING_REVIEW');
    expect(await prisma.transaction.count()).toBe(txnsBefore);
    expect((await get(`/invoices/${inv.id}`)).balance).toBe(inv.balance);

    const detail = await get(`/reconciliation/imports/${saved.id}`);
    expect(detail.notice).toMatch(/not verified/i);
    const row = detail.rows[0];
    expect(row.status).toBe('SUGGESTED_MATCH');
    expect(row.suggestedInvoice.invoiceNumber).toBe(inv.invoiceNumber);

    const confirmed = await post(
      `/reconciliation/rows/${row.id}/confirm`,
    ).expect(200);
    expect(confirmed.body.status).toBe('MATCHED');
    const after = await get(`/invoices/${inv.id}`);
    expect(after.status).toBe('PAID');
    expect(after.payments.at(-1)).toMatchObject({
      method: 'BANK_TRANSFER',
      reference: 'SAVE-1',
    });
    const linked = await prisma.transaction.findUniqueOrThrow({
      where: { id: confirmed.body.createdTransactionId },
    });
    expect(linked).toMatchObject({
      source: 'IMPORTED',
      type: 'INCOME',
      importedTransactionId: row.id,
    });
    expect((await get(`/reconciliation/imports/${saved.id}`)).status).toBe(
      'COMPLETED',
    );
    await post(`/reconciliation/rows/${row.id}/confirm`).expect(409);
    const audit = (await get('/audit?limit=100')).items.map(
      (a: any) => a.action,
    );
    expect(audit).toEqual(
      expect.arrayContaining(['IMPORT_SAVED', 'RECONCILIATION_CONFIRMED']),
    );
  });

  it('re-uploading the same file is caught as duplicates', async () => {
    const inv = await firstInvoice('UNPAID');
    const rows = [
      `${addDaysIso(TODAY, -1)},Transfer ${inv.invoiceNumber},${inv.balance},credit,ONCE-1`,
      `${addDaysIso(TODAY, -1)},Fee,50,debit,ONCE-2`,
    ];
    await upload(rows).expect(201);
    const again = await upload(
      rows,
      'bank.csv',
      undefined,
      '/reconciliation/preview',
    ).expect(200);
    expect(again.body.counts.DUPLICATE).toBe(2);
    expect(again.body.canSave).toBe(false);
    await upload(rows).expect(400);
  });

  it('rejecting a suggestion leaves the invoice untouched; the user can still match manually to a chosen invoice', async () => {
    const inv = await firstInvoice('UNPAID');
    const other = await firstInvoice('PARTIALLY_PAID');
    const saved = (
      await upload([
        `${addDaysIso(TODAY, -1)},Transfer ${inv.invoiceNumber},${inv.balance},credit,REJ-1`,
      ]).expect(201)
    ).body;
    const row = (await get(`/reconciliation/imports/${saved.id}`)).rows[0];
    expect(
      (await post(`/reconciliation/rows/${row.id}/reject`).expect(200)).body
        .status,
    ).toBe('UNMATCHED');
    expect((await get(`/invoices/${inv.id}`)).balance).toBe(inv.balance);
    await post(`/reconciliation/rows/${row.id}/reject`).expect(400);
    // The row amount equals inv.balance; matching it to an invoice that owes less must fail cleanly.
    if (new Decimal(other.balance).lt(inv.balance))
      await post(`/reconciliation/rows/${row.id}/confirm`, {
        invoiceId: other.id,
      }).expect(400);
    await post(`/reconciliation/rows/${row.id}/confirm`, {
      invoiceId: inv.id,
    }).expect(200);
    expect((await get(`/invoices/${inv.id}`)).status).toBe('PAID');
  });

  it('only decision-ready money-in rows can be matched', async () => {
    const saved = (
      await upload([
        `${addDaysIso(TODAY, -1)},Airtime,500,debit,OUT-1`,
        `bad,Bad,1,credit,BAD-1`,
      ]).expect(201)
    ).body;
    const rows = (await get(`/reconciliation/imports/${saved.id}`)).rows;
    for (const r of rows)
      await post(`/reconciliation/rows/${r.id}/confirm`, {
        invoiceId: 'x',
      }).expect(400);
    await post('/reconciliation/rows/ghost/confirm').expect(404);
  });

  it('handles bank-style Credit/Debit columns, day-first dates, and manual column mapping', async () => {
    const r = await upload(
      ['01/10/2026,Deposit,,"₦5,000.00"', '02-10-2026,Charge,100.00,'],
      'bank.csv',
      undefined,
      '/reconciliation/preview',
    );
    expect(r.status).toBe(200);
    const mapped = await http()
      .post('/api/reconciliation/preview')
      .attach(
        'file',
        Buffer.from('When,What,How much\n2026-10-01,Sale,300\n'),
        'x.csv',
      )
      .field(
        'mapping',
        JSON.stringify({
          date: 'When',
          description: 'What',
          amount: 'How much',
        }),
      )
      .expect(200);
    expect(mapped.body.rows[0]).toMatchObject({
      amount: '300.00',
      direction: 'IN',
    });
    const unreadable = await http()
      .post('/api/reconciliation/preview')
      .attach('file', Buffer.from('Foo,Bar\n1,2\n'), 'x.csv')
      .expect(200);
    expect(unreadable.body.problems.length).toBeGreaterThan(0);
    await http()
      .post('/api/reconciliation/imports')
      .attach('file', Buffer.from('Foo,Bar\n1,2\n'), 'x.csv')
      .expect(400);
  });

  it('enforces file rules: csv only, present, and size/row limits', async () => {
    await http().post('/api/reconciliation/preview').expect(400);
    await http()
      .post('/api/reconciliation/preview')
      .attach('file', Buffer.from('a'), 'notes.txt')
      .expect(400);
    await http()
      .post('/api/reconciliation/preview')
      .attach('file', Buffer.alloc(1_100_000, 'a'), 'big.csv')
      .expect(413);
    const many = Array.from(
      { length: 501 },
      () => `${addDaysIso(TODAY, -1)},x,1,credit,`,
    );
    const r = await upload(
      many,
      'many.csv',
      undefined,
      '/reconciliation/preview',
    ).expect(200);
    expect(r.body.problems.join(' ')).toMatch(/more than 500/);
  });

  it('lists import history with status counts', async () => {
    const list = (await get('/reconciliation/imports')).items;
    expect(list).toHaveLength(3);
    expect(list[0].counts).toBeDefined();
  });
});
