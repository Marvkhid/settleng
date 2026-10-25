/* eslint-disable @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call */
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import Decimal from 'decimal.js';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { addDaysIso, todayInLagos } from '../src/common/dates';
import { SupabaseAdminService } from '../src/auth/supabase-admin';
import { PrismaService } from '../src/prisma/prisma.service';
import { signTestToken } from './support/tokens';

let app: INestApplication;
let prisma: PrismaService;
const TODAY = todayInLagos();

// Two distinct owners, so the suite can prove one tenant never sees the other's data.
const OWNER_A = 'user-a';
const OWNER_B = 'user-b';
let tokenA = '';
let tokenB = '';

const http = () => request(app.getHttpServer() as App);
const as = (token: string) => ({
  get: (url: string) =>
    http().get(`/api${url}`).set('Authorization', `Bearer ${token}`),
  post: (url: string, body: object = {}) =>
    http()
      .post(`/api${url}`)
      .set('Authorization', `Bearer ${token}`)
      .send(body),
  patch: (url: string, body: object = {}) =>
    http()
      .patch(`/api${url}`)
      .set('Authorization', `Bearer ${token}`)
      .send(body),
  del: (url: string) =>
    http().delete(`/api${url}`).set('Authorization', `Bearer ${token}`),
});

beforeAll(async () => {
  const mod = await Test.createTestingModule({
    imports: [AppModule],
  })
    // Account deletion also removes the Supabase auth user; the suite has no live project, so the
    // admin call is stubbed. Everything else (data deletion) runs for real.
    .overrideProvider(SupabaseAdminService)
    .useValue({ deleteUser: () => Promise.resolve(undefined) })
    .compile();
  app = mod.createNestApplication();
  configureApp(app, ['http://localhost:3000']);
  await app.init();
  prisma = app.get(PrismaService);
  tokenA = await signTestToken({ sub: OWNER_A, fullName: 'Marvel Okafor' });
  tokenB = await signTestToken({ sub: OWNER_B, fullName: 'Zainab Bello' });
  // Each owner bootstraps their own (empty) business.
  for (const [token, name] of [
    [tokenA, 'Marvel Stores'],
    [tokenB, 'Zainab Textiles'],
  ] as const) {
    const r = await as(token)
      .post('/auth/bootstrap', {
        fullName: name.split(' ')[0],
        businessName: name,
      })
      .expect(200);
    expect(r.body.business.name).toBe(name);
  }
});
afterAll(async () => {
  await app.close();
});

const dashboard = (token = tokenA) => as(token).get('/dashboard');
const newCustomer = async (name?: string, token = tokenA) =>
  (
    await as(token).post('/customers', {
      name: name ?? `Cust ${Math.random().toString(36).slice(2, 7)}`,
    })
  ).body;
const newInvoice = async (
  customerId: string,
  amount: string,
  over: object = {},
  token = tokenA,
) =>
  (
    await as(token).post('/invoices', {
      customerId,
      issueDate: addDaysIso(TODAY, -2),
      dueDate: addDaysIso(TODAY, 10),
      items: [{ description: 'Goods', quantity: '1', unitPrice: amount }],
      ...over,
    })
  ).body;

describe('authentication', () => {
  it('keeps /api/health public but rejects app routes without a token', async () => {
    await http().get('/api/health').expect(200);
    await http().get('/api/health/ready').expect(200);
    await http().get('/api/dashboard').expect(401);
    await http().get('/api/customers').expect(401);
  });

  it('rejects a garbage or expired token', async () => {
    await http()
      .get('/api/dashboard')
      .set('Authorization', 'Bearer nope')
      .expect(401);
    await http()
      .get('/api/dashboard')
      .set('Authorization', 'Basic abc')
      .expect(401);
  });

  it('bootstraps the profile and business, and reports them on /auth/me', async () => {
    const me = (await as(tokenA).get('/auth/me').expect(200)).body;
    expect(me.fullName).toBe('Marvel');
    expect(me.business.name).toBe('Marvel Stores');
  });

  it('a brand-new user has an empty business (dashboard zeroes), and no cross-tenant rows', async () => {
    const d = (await dashboard().expect(200)).body;
    expect(d.salesToday).toBe('0.00');
    expect(d.recentActivity).toHaveLength(0);
    expect(
      (await as(tokenA).get('/customers?pageSize=100').expect(200)).body.items,
    ).toHaveLength(0);
  });
});

describe('multi-tenancy isolation', () => {
  it("one tenant's customers, invoices and transactions are invisible to another", async () => {
    const c = await newCustomer('Marvel-only customer');
    const inv = await newInvoice(c.id, '4000');
    await as(tokenA)
      .post(`/invoices/${inv.id}/payments`, { amount: '1500', method: 'CASH' })
      .expect(201);

    // Owner B sees none of it.
    const bCustomers = (
      await as(tokenB).get('/customers?pageSize=100').expect(200)
    ).body.items;
    expect(bCustomers.map((x: any) => x.id)).not.toContain(c.id);
    await as(tokenB).get(`/customers/${c.id}`).expect(404);
    await as(tokenB).get(`/invoices/${inv.id}`).expect(404);
    const bDashboard = (await dashboard(tokenB).expect(200)).body;
    expect(bDashboard.salesToday).toBe('0.00');
  });

  it("a businessId supplied by the client is ignored; the owner's own business is used", async () => {
    // Try to create a customer belonging to someone else's business. The field is not accepted.
    const r = await as(tokenB)
      .post('/customers', { name: 'Spoof', businessId: 'demo-business' })
      .expect(400); // forbidNonWhitelisted rejects the unexpected field
    expect(r.body.statusCode).toBe(400);
  });

  it('invoice numbers are unique within a business but can repeat across businesses', async () => {
    const cA = await newCustomer();
    const cB = await newCustomer('B cust', tokenB);
    await newInvoice(cA.id, '100', { invoiceNumber: 'SHARED-1' });
    await newInvoice(cB.id, '100', { invoiceNumber: 'SHARED-1' }, tokenB);
    expect(
      (await as(tokenA).get('/invoices?search=SHARED-1')).body.items,
    ).toHaveLength(1);
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
      const r = await as(tokenA).get(url).expect(404);
      expect(r.body).toMatchObject({ statusCode: 404, error: 'NOT_FOUND' });
      expect(typeof r.body.message).toBe('string');
    }
    const bad = await as(tokenA)
      .post('/sales', { amount: '12.345', paymentMethod: 'BITCOIN', extra: 1 })
      .expect(400);
    expect(bad.body.statusCode).toBe(400);
    expect(Array.isArray(bad.body.details)).toBe(true);
  });
});

describe('dashboard and reports share one source of truth', () => {
  it('dashboard equals the reports summary for today', async () => {
    const d = (await dashboard().expect(200)).body;
    const s = (
      await as(tokenA)
        .get(`/reports/summary?from=${TODAY}&to=${TODAY}`)
        .expect(200)
    ).body;
    expect(d.salesToday).toBe(s.sales.total);
    expect(d.expensesToday).toBe(s.expenses.total);
    expect(d.moneyIn).toBe(s.moneyIn);
    expect(d.moneyOut).toBe(s.moneyOut);
    expect(d.customersOwing).toEqual(s.customersOwing);
  });

  it('the chart series ends today and has one point per day', async () => {
    for (const [p, n] of [
      ['7d', 7],
      ['30d', 30],
      ['90d', 90],
    ] as const) {
      const s = (
        await as(tokenA).get(`/reports/timeseries?period=${p}`).expect(200)
      ).body;
      expect(s.points).toHaveLength(n);
      expect(s.points.at(-1).date).toBe(TODAY);
    }
    await as(tokenA).get('/reports/timeseries?period=5y').expect(400);
  });

  it('rejects bad ranges', async () => {
    await as(tokenA)
      .get(`/reports/summary?from=${TODAY}&to=${addDaysIso(TODAY, -3)}`)
      .expect(400);
    await as(tokenA)
      .get(`/reports/summary?from=2020-01-01&to=${TODAY}`)
      .expect(400);
    await as(tokenA).get('/reports/summary?from=2026-02-30').expect(400);
  });
});

describe('business profile', () => {
  it("renames the signed-in owner's business, persists it and reports it on /auth/me", async () => {
    const r = await as(tokenA)
      .patch('/auth/business', { name: '  Marvel Stores NG  ' })
      .expect(200);
    expect(r.body.business).toMatchObject({
      name: 'Marvel Stores NG',
      currency: 'NGN',
    });
    expect(
      (await as(tokenA).get('/auth/me').expect(200)).body.business.name,
    ).toBe('Marvel Stores NG');
    const row = await prisma.business.findUniqueOrThrow({
      where: { ownerId: OWNER_A },
    });
    expect(row.name).toBe('Marvel Stores NG');
  });

  it('rejects an empty or overlong name and never renames another business', async () => {
    await as(tokenA).patch('/auth/business', { name: '' }).expect(400);
    await as(tokenA).patch('/auth/business', { name: '   ' }).expect(400);
    await as(tokenA)
      .patch('/auth/business', { name: 'x'.repeat(121) })
      .expect(400);

    await as(tokenA)
      .patch('/auth/business', { name: 'Marvel Stores' })
      .expect(200);
    // The browser never sends a business id: B's business is untouched by A's request.
    expect(
      (await as(tokenB).get('/auth/me').expect(200)).body.business.name,
    ).toBe('Zainab Textiles');
  });

  it('requires a valid token', async () => {
    await http().patch('/api/auth/business').send({ name: 'Nope' }).expect(401);
  });
});

const OWNER_C = 'user-perf';
let tokenC = '';

describe('business performance chart', () => {
  const perf = (period: string, token = tokenC) =>
    as(token).get(`/reports/performance?period=${period}`);

  beforeAll(async () => {
    tokenC = await signTestToken({
      sub: OWNER_C,
      fullName: 'Chinedu Perf',
    });
    await as(tokenC)
      .post('/auth/bootstrap', {
        fullName: 'Chinedu',
        businessName: 'Chinedu Traders',
      })
      .expect(200);
    // Three known trading days, one in each comparison window.
    await as(tokenC)
      .post('/sales', {
        amount: '1000',
        paymentMethod: 'CASH',
        date: addDaysIso(TODAY, -8),
      })
      .expect(201);
    await as(tokenC)
      .post('/expenses', {
        amount: '400',
        category: 'Stock',
        date: addDaysIso(TODAY, -8),
      })
      .expect(201);
    await as(tokenC)
      .post('/sales', {
        amount: '1500',
        paymentMethod: 'CASH',
        date: addDaysIso(TODAY, -2),
      })
      .expect(201);
    await as(tokenC)
      .post('/expenses', {
        amount: '500',
        category: 'Transport',
        date: addDaysIso(TODAY, -2),
      })
      .expect(201);
    await as(tokenC)
      .post('/sales', {
        amount: '2000',
        paymentMethod: 'CASH',
        date: addDaysIso(TODAY, -40),
      })
      .expect(201);
    await as(tokenC)
      .post('/expenses', {
        amount: '1000',
        category: 'Rent',
        date: addDaysIso(TODAY, -40),
      })
      .expect(201);
  });

  it('7 days: daily buckets, exact totals and a real percentage change', async () => {
    const p = (await perf('7d').expect(200)).body;
    expect(p).toMatchObject({
      period: '7d',
      granularity: 'day',
      currency: 'NGN',
      to: TODAY,
      from: addDaysIso(TODAY, -6),
      previousTo: addDaysIso(TODAY, -7),
      previousFrom: addDaysIso(TODAY, -13),
      previousLabel: 'the previous 7 days',
      hasData: true,
      enoughHistory: true,
      trend: 'IMPROVING',
    });
    expect(p.points).toHaveLength(7);
    expect(p.points.at(-1)).toMatchObject({ start: TODAY, end: TODAY });
    expect(p.totals).toEqual({
      sales: '1500.00',
      expenses: '500.00',
      profit: '1000.00',
    });
    expect(p.comparison.sales).toMatchObject({
      current: '1500.00',
      previous: '1000.00',
      changePct: 50,
      direction: 'UP',
    });
    expect(p.comparison.expenses.changePct).toBe(25);
    expect(p.comparison.profit.changePct).toBe(66.7);
    expect(p.insights.join(' ')).toMatch(/Sales increased by 50\.0%/);
    expect(p.insights.join(' ')).not.toMatch(/grew faster/);
  });

  it('30 days: compares with the previous 30 days, including falling expenses', async () => {
    const p = (await perf('30d').expect(200)).body;
    expect(p.points).toHaveLength(30);
    expect(p.totals).toEqual({
      sales: '2500.00',
      expenses: '900.00',
      profit: '1600.00',
    });
    expect(p.comparison.sales.changePct).toBe(25);
    expect(p.comparison.expenses.changePct).toBe(-10);
    expect(p.comparison.expenses.direction).toBe('DOWN');
    expect(p.comparison.profit.changePct).toBe(60);
    expect(p.trend).toBe('IMPROVING');
  });

  it('buckets sum exactly to the totals (no floating point drift)', async () => {
    const p = (await perf('30d').expect(200)).body;
    const sum = p.points.reduce(
      (
        acc: { sales: Decimal; expenses: Decimal; profit: Decimal },
        x: any,
      ) => ({
        sales: acc.sales.plus(x.sales),
        expenses: acc.expenses.plus(x.expenses),
        profit: acc.profit.plus(x.profit),
      }),
      {
        sales: new Decimal(0),
        expenses: new Decimal(0),
        profit: new Decimal(0),
      },
    );
    expect(sum.sales.toFixed(2)).toBe(p.totals.sales);
    expect(sum.expenses.toFixed(2)).toBe(p.totals.expenses);
    expect(sum.profit.toFixed(2)).toBe(p.totals.profit);
  });

  it('reconciles with the Reports page for the same dates', async () => {
    const p = (await perf('30d').expect(200)).body;
    const s = (
      await as(tokenC)
        .get(`/reports/summary?from=${p.from}&to=${p.to}`)
        .expect(200)
    ).body;
    expect(p.totals.sales).toBe(s.sales.total);
    expect(p.totals.expenses).toBe(s.expenses.total);
  });

  it('aggregates weekly and monthly for longer periods', async () => {
    const p90 = (await perf('90d').expect(200)).body;
    expect(p90.granularity).toBe('week');
    expect(p90.points).toHaveLength(13);
    expect(p90.points.at(-1).end).toBe(TODAY);

    const p6m = (await perf('6m').expect(200)).body;
    expect(p6m.granularity).toBe('week');
    expect(p6m.points).toHaveLength(26);

    const p1y = (await perf('1y').expect(200)).body;
    expect(p1y.granularity).toBe('month');
    expect(p1y.from).toBe(`${TODAY.slice(0, 4)}-01-01`);
    expect(p1y.points).toHaveLength(Number(TODAY.slice(5, 7)));
    expect(p1y.points.at(-1).end).toBe(TODAY);
  });

  it('says so when there is no comparable earlier period instead of inventing 0%', async () => {
    const p = (await perf('90d').expect(200)).body;
    expect(p.hasData).toBe(true);
    expect(p.enoughHistory).toBe(false);
    expect(p.trend).toBe('UNKNOWN');
    expect(p.comparison.sales.changePct).toBeNull();
    expect(p.comparison.sales.previous).toBe('0.00');
    expect(p.insights.join(' ')).toMatch(/Not enough earlier records/);
  });

  it('counts invoice sales on the issue date, and a payment does not count the sale twice', async () => {
    const c = await newCustomer('Perf Customer', tokenC);
    const inv = await newInvoice(
      c.id,
      '500',
      { issueDate: addDaysIso(TODAY, -1) },
      tokenC,
    );
    let p = (await perf('7d').expect(200)).body;
    expect(p.totals.sales).toBe('2000.00');

    await as(tokenC)
      .post(`/invoices/${inv.id}/payments`, {
        amount: '100',
        method: 'CASH',
        paymentDate: addDaysIso(TODAY, -1),
      })
      .expect(201);
    p = (await perf('7d').expect(200)).body;
    expect(p.totals.sales).toBe('2000.00');
    expect(p.totals.profit).toBe('1500.00');

    // A draft is not revenue yet.
    await as(tokenC)
      .post('/invoices', {
        customerId: c.id,
        issueDate: TODAY,
        dueDate: addDaysIso(TODAY, 7),
        saveAsDraft: true,
        items: [{ description: 'Draft', quantity: '1', unitPrice: '999' }],
      })
      .expect(201);
    expect((await perf('7d').expect(200)).body.totals.sales).toBe('2000.00');
  });

  it('follows edits and deletions immediately', async () => {
    const created = (
      await as(tokenC)
        .post('/transactions', {
          type: 'INCOME',
          amount: '700',
          category: 'Sales',
          date: TODAY,
        })
        .expect(201)
    ).body;
    expect((await perf('7d').expect(200)).body.totals.sales).toBe('2700.00');

    await as(tokenC)
      .patch(`/transactions/${created.id}`, { amount: '300' })
      .expect(200);
    expect((await perf('7d').expect(200)).body.totals.sales).toBe('2300.00');

    await as(tokenC).del(`/transactions/${created.id}`).expect(204);
    expect((await perf('7d').expect(200)).body.totals.sales).toBe('2000.00');
  });

  it('is empty, and isolated, for a brand-new business', async () => {
    const tokenD = await signTestToken({
      sub: 'user-perf-empty',
      fullName: 'No Data',
    });
    await as(tokenD)
      .post('/auth/bootstrap', {
        fullName: 'No Data',
        businessName: 'Empty Shop',
      })
      .expect(200);
    const p = (await perf('30d', tokenD).expect(200)).body;
    expect(p.totals).toEqual({
      sales: '0.00',
      expenses: '0.00',
      profit: '0.00',
    });
    expect(p.points).toHaveLength(30);
    expect(p.hasData).toBe(false);
    expect(p.enoughHistory).toBe(false);
    expect(p.trend).toBe('UNKNOWN');
    expect(p.insights.join(' ')).toMatch(/No sales or expenses/);
  });

  it('rejects unknown periods and needs a token', async () => {
    await perf('5y').expect(400);
    await http().get('/api/reports/performance?period=30d').expect(401);
  });
});

describe('sales and expenses (simple actions)', () => {
  it('a cash sale moves sales and money in by exactly that amount', async () => {
    const a = (await dashboard().expect(200)).body;
    const r = await as(tokenA)
      .post('/sales', { amount: '3000', paymentMethod: 'CASH' })
      .expect(201);
    expect(r.body.kind).toBe('transaction');
    expect(r.body.transaction).toMatchObject({
      type: 'INCOME',
      source: 'MANUAL',
      amount: '3000.00',
      sign: '+',
    });
    const b = (await dashboard().expect(200)).body;
    expect(new Decimal(b.salesToday).minus(a.salesToday).toString()).toBe(
      '3000',
    );
    expect(new Decimal(b.moneyIn).minus(a.moneyIn).toString()).toBe('3000');
  });

  it('an expense moves expenses and money out, not sales', async () => {
    const a = (await dashboard().expect(200)).body;
    await as(tokenA)
      .post('/expenses', {
        amount: '8000',
        category: 'Stock',
        description: 'Bought stock',
      })
      .expect(201);
    const b = (await dashboard().expect(200)).body;
    expect(new Decimal(b.expensesToday).minus(a.expensesToday).toString()).toBe(
      '8000',
    );
    expect(new Decimal(b.moneyOut).minus(a.moneyOut).toString()).toBe('8000');
    expect(b.salesToday).toBe(a.salesToday);
  });

  it('a credit sale becomes a customer debt', async () => {
    const c = await newCustomer();
    await as(tokenA)
      .post('/sales', { amount: '5000', paymentMethod: 'CREDIT' })
      .expect(400); // needs a customer
    const a = (await dashboard().expect(200)).body;
    const r = await as(tokenA)
      .post('/sales', {
        amount: '5000',
        paymentMethod: 'CREDIT',
        customerId: c.id,
        description: 'Rice on credit',
      })
      .expect(201);
    expect(r.body.kind).toBe('credit_invoice');
    expect(r.body.invoice).toMatchObject({
      status: 'UNPAID',
      total: '5000.00',
      balance: '5000.00',
    });
    const b = (await dashboard().expect(200)).body;
    expect(new Decimal(b.salesToday).minus(a.salesToday).toString()).toBe(
      '5000',
    );
    expect(b.moneyIn).toBe(a.moneyIn);
    expect(
      (await as(tokenA).get(`/customers/${c.id}`).expect(200)).body.amountOwing,
    ).toBe('5000.00');
  });

  it('validates amounts, categories and dates with friendly errors', async () => {
    await as(tokenA)
      .post('/sales', { amount: '0', paymentMethod: 'CASH' })
      .expect(400);
    await as(tokenA)
      .post('/sales', {
        amount: '100',
        paymentMethod: 'CASH',
        date: addDaysIso(TODAY, 3),
      })
      .expect(400);
    await as(tokenA)
      .post('/sales', {
        amount: '100',
        paymentMethod: 'CASH',
        customerId: 'ghost',
      })
      .expect(404);
    await as(tokenA)
      .post('/expenses', { amount: '100', category: '' })
      .expect(400);
    await as(tokenA)
      .post('/expenses', { amount: '-5', category: 'Stock' })
      .expect(400);
  });
});

describe('customers', () => {
  it('creates, validates, searches and edits', async () => {
    await as(tokenA).post('/customers', { name: '' }).expect(400);
    await as(tokenA)
      .post('/customers', { name: 'X', email: 'not-an-email' })
      .expect(400);
    const c = await newCustomer('Zainab Textiles Extra');
    expect(
      (await as(tokenA).get('/customers?search=Zainab')).body.items.map(
        (x: any) => x.id,
      ),
    ).toContain(c.id);
    const e = await as(tokenA)
      .patch(`/customers/${c.id}`, { phone: '08011112222' })
      .expect(200);
    expect(e.body.phone).toBe('08011112222');
  });

  it('never destroys history: customers with debt cannot be archived; settled ones can', async () => {
    const c = await newCustomer();
    const inv = await newInvoice(c.id, '10000');
    await as(tokenA).post(`/customers/${c.id}/archive`).expect(409);
    await as(tokenA)
      .post(`/invoices/${inv.id}/payments`, { amount: '10000', method: 'CASH' })
      .expect(201);
    await as(tokenA).post(`/customers/${c.id}/archive`).expect(200);
    expect(
      (await as(tokenA).get('/customers?pageSize=100')).body.items.map(
        (x: any) => x.id,
      ),
    ).not.toContain(c.id);
    expect(
      (
        await as(tokenA).get('/customers?includeArchived=true&pageSize=100')
      ).body.items.map((x: any) => x.id),
    ).toContain(c.id);
    const detail = (await as(tokenA).get(`/customers/${c.id}`).expect(200))
      .body;
    expect(detail.invoices).toHaveLength(1);
    expect(detail.payments).toHaveLength(1);
    expect(detail.totalBought).toBe('10000.00');
    await as(tokenA).post(`/customers/${c.id}/restore`).expect(200);
  });
});

describe('invoices', () => {
  it('totals are exact decimals calculated on the server; the browser cannot supply status or total', async () => {
    const c = await newCustomer();
    const bad = await as(tokenA).post('/invoices', {
      customerId: c.id,
      issueDate: TODAY,
      dueDate: addDaysIso(TODAY, 7),
      status: 'PAID',
      total: '1',
      items: [{ description: 'A', quantity: '3', unitPrice: '0.10' }],
    });
    expect(bad.status).toBe(400);
    const ok = await as(tokenA)
      .post('/invoices', {
        customerId: c.id,
        issueDate: TODAY,
        dueDate: addDaysIso(TODAY, 7),
        items: [
          { description: 'A', quantity: '3', unitPrice: '0.10' },
          { description: 'B', quantity: '2', unitPrice: '1500.10' },
        ],
      })
      .expect(201);
    expect(ok.body.total).toBe('3000.50');
    expect(ok.body.status).toBe('UNPAID');
    expect(
      (await as(tokenA).get(`/invoices/${ok.body.id}`).expect(200)).body.total,
    ).toBe('3000.50');
  });

  it('validates dates, items and customers', async () => {
    const c = await newCustomer();
    const base = {
      customerId: c.id,
      issueDate: TODAY,
      dueDate: TODAY,
      items: [{ description: 'A', quantity: '1', unitPrice: '10' }],
    };
    await as(tokenA)
      .post('/invoices', { ...base, dueDate: addDaysIso(TODAY, -1) })
      .expect(400);
    await as(tokenA)
      .post('/invoices', { ...base, items: [] })
      .expect(400);
    await as(tokenA)
      .post('/invoices', {
        ...base,
        items: [{ description: 'A', quantity: '0', unitPrice: '10' }],
      })
      .expect(400);
    await as(tokenA)
      .post('/invoices', { ...base, issueDate: '2026-02-30' })
      .expect(400);
    await as(tokenA)
      .post('/invoices', { ...base, customerId: 'ghost' })
      .expect(404);
  });

  it('status is derived from payments and dates', async () => {
    const c = await newCustomer();
    const past = await newInvoice(c.id, '2000', {
      issueDate: addDaysIso(TODAY, -30),
      dueDate: addDaysIso(TODAY, -5),
    });
    expect(past.status).toBe('OVERDUE');
    await as(tokenA)
      .post(`/invoices/${past.id}/payments`, { amount: '500', method: 'CASH' })
      .expect(201);
    expect((await as(tokenA).get(`/invoices/${past.id}`)).body.status).toBe(
      'OVERDUE',
    );
    await as(tokenA)
      .post(`/invoices/${past.id}/payments`, { amount: '1500', method: 'CASH' })
      .expect(201);
    expect((await as(tokenA).get(`/invoices/${past.id}`)).body.status).toBe(
      'PAID',
    );
  });

  it('drafts: no payments until issued; only drafts can be deleted', async () => {
    const c = await newCustomer();
    const d = await newInvoice(c.id, '900', { saveAsDraft: true });
    expect(d.status).toBe('DRAFT');
    await as(tokenA)
      .post(`/invoices/${d.id}/payments`, { amount: '100', method: 'CASH' })
      .expect(400);
    expect(
      (await as(tokenA).post(`/invoices/${d.id}/issue`).expect(200)).body
        .status,
    ).toBe('UNPAID');
    await as(tokenA).post(`/invoices/${d.id}/issue`).expect(409);
    await as(tokenA).del(`/invoices/${d.id}`).expect(400);
    const d2 = await newInvoice(c.id, '50', { saveAsDraft: true });
    await as(tokenA).del(`/invoices/${d2.id}`).expect(204);
    await as(tokenA).get(`/invoices/${d2.id}`).expect(404);
  });
});

describe('payments', () => {
  it('partial then full payments keep history, move the balance and create linked money-in records', async () => {
    const c = await newCustomer();
    const inv = await newInvoice(c.id, '10000.50');
    const p1 = (
      await as(tokenA)
        .post(`/invoices/${inv.id}/payments`, {
          amount: '4000.25',
          method: 'BANK_TRANSFER',
          reference: 'R-1',
        })
        .expect(201)
    ).body;
    expect(p1).toMatchObject({
      status: 'PARTIALLY_PAID',
      amountPaid: '4000.25',
      balance: '6000.25',
    });
    const p2 = (
      await as(tokenA)
        .post(`/invoices/${inv.id}/payments`, {
          amount: '6000.25',
          method: 'CASH',
          reference: 'R-2',
        })
        .expect(201)
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
  });

  it('rejects overpayment, paying a settled invoice, zero, and future dates', async () => {
    const c = await newCustomer();
    const inv = await newInvoice(c.id, '1000');
    await as(tokenA)
      .post(`/invoices/${inv.id}/payments`, {
        amount: '1000.01',
        method: 'CASH',
      })
      .expect(400);
    await as(tokenA)
      .post(`/invoices/${inv.id}/payments`, { amount: '0', method: 'CASH' })
      .expect(400);
    await as(tokenA)
      .post(`/invoices/${inv.id}/payments`, {
        amount: '10',
        method: 'CASH',
        paymentDate: addDaysIso(TODAY, 2),
      })
      .expect(400);
    await as(tokenA)
      .post(`/invoices/${inv.id}/payments`, { amount: '1000', method: 'CASH' })
      .expect(201);
    await as(tokenA)
      .post(`/invoices/${inv.id}/payments`, { amount: '1', method: 'CASH' })
      .expect(409);
  });

  it('prevents duplicate payments by reference', async () => {
    const c = await newCustomer();
    const inv = await newInvoice(c.id, '9000');
    await as(tokenA)
      .post(`/invoices/${inv.id}/payments`, {
        amount: '1000',
        method: 'CASH',
        reference: 'DUP',
      })
      .expect(201);
    await as(tokenA)
      .post(`/invoices/${inv.id}/payments`, {
        amount: '1000',
        method: 'CASH',
        reference: 'DUP',
      })
      .expect(409);
    expect(
      await prisma.invoicePayment.count({ where: { invoiceId: inv.id } }),
    ).toBe(1);
  });

  it('"Customer paid me" spreads across open invoices, oldest due first', async () => {
    const c = await newCustomer();
    const first = await newInvoice(c.id, '3000', {
      issueDate: addDaysIso(TODAY, -20),
      dueDate: addDaysIso(TODAY, -10),
    });
    const second = await newInvoice(c.id, '5000', {
      issueDate: addDaysIso(TODAY, -5),
      dueDate: addDaysIso(TODAY, 20),
    });
    await as(tokenA)
      .post(`/customers/${c.id}/payments`, { amount: '9000', method: 'CASH' })
      .expect(400); // more than owed
    const r = await as(tokenA)
      .post(`/customers/${c.id}/payments`, {
        amount: '3500',
        method: 'CASH',
        reference: 'CASH-1',
      })
      .expect(201);
    expect(r.body.applied).toEqual([
      { invoiceNumber: first.invoiceNumber, amount: '3000.00' },
      { invoiceNumber: second.invoiceNumber, amount: '500.00' },
    ]);
    expect((await as(tokenA).get(`/invoices/${first.id}`)).body.status).toBe(
      'PAID',
    );
    expect((await as(tokenA).get(`/customers/${c.id}`)).body.amountOwing).toBe(
      '4500.00',
    );
  });
});

describe('transactions', () => {
  it('filters, searches and paginates', async () => {
    await as(tokenA)
      .post('/expenses', {
        amount: '100',
        category: 'Other',
        description: 'findable-needle',
      })
      .expect(201);
    expect(
      (await as(tokenA).get('/transactions?search=FINDABLE-needle')).body.items,
    ).toHaveLength(1);
    const exp = await as(tokenA).get('/transactions?type=EXPENSE&pageSize=100');
    expect(
      exp.body.items.every((t: any) => t.type === 'EXPENSE' && t.sign === '-'),
    ).toBe(true);
    await as(tokenA).get('/transactions?pageSize=1000').expect(400);
  });

  it('manual records can be edited and deleted; payment-linked records cannot', async () => {
    const t = (
      await as(tokenA)
        .post('/expenses', { amount: '2000', category: 'Transport' })
        .expect(201)
    ).body;
    const edited = await as(tokenA)
      .patch(`/transactions/${t.id}`, { amount: '2500', category: 'Stock' })
      .expect(200);
    expect(edited.body).toMatchObject({ amount: '2500.00', category: 'Stock' });
    await as(tokenA).del(`/transactions/${t.id}`).expect(204);
    await as(tokenA).get(`/transactions/${t.id}`).expect(404);
  });

  it('lists categories for filters', async () => {
    const cats = (await as(tokenA).get('/transactions/categories').expect(200))
      .body;
    expect(cats.expense).toEqual(
      expect.arrayContaining(['Stock', 'Transport']),
    );
    expect(cats.income).toContain('Sales');
  });
});

describe('CSV export', () => {
  it('exports with a download header and neutralises spreadsheet formulas', async () => {
    await as(tokenA)
      .post('/expenses', {
        amount: '100',
        category: 'Other',
        description: '=HYPERLINK("http://evil","x")',
      })
      .expect(201);
    const r = await as(tokenA)
      .get(`/reports/export?type=transactions&from=${TODAY}&to=${TODAY}`)
      .expect(200);
    expect(r.headers['content-type']).toContain('text/csv');
    expect(r.headers['content-disposition']).toContain('attachment');
    expect(r.text).toContain(`"'=HYPERLINK(""http://evil"",""x"")"`);
    for (const type of ['invoices', 'customers-owing'])
      await as(tokenA).get(`/reports/export?type=${type}`).expect(200);
    await as(tokenA).get('/reports/export?type=secrets').expect(400);
  });
});

describe('CSV reconciliation', () => {
  const csvFile = (
    rows: string[],
    header = 'Date,Description,Amount,Direction,Reference',
  ) => Buffer.from([header, ...rows].join('\n'));
  const upload = (
    rows: string[],
    name = 'bank.csv',
    mapping?: object,
    path = '/reconciliation/imports',
    token = tokenA,
  ) => {
    // Build a multipart request WITHOUT a JSON body, because superagent rejects mixing
    // .send() and .attach(). .field() adds multipart fields (the mapping), which is fine.
    const req = request(app.getHttpServer() as App)
      .post(`/api${path}`)
      .set('Authorization', `Bearer ${token}`)
      .attach('file', csvFile(rows), name);
    return mapping ? req.field('mapping', JSON.stringify(mapping)) : req;
  };

  it('serves a sample template', async () => {
    const r = await as(tokenA).get('/reconciliation/template').expect(200);
    expect(r.headers['content-disposition']).toContain('.csv');
    expect(r.text).toContain('Date,Description,Amount');
  });

  it('preview validates and classifies rows without saving anything', async () => {
    const c = await newCustomer();
    const inv = await newInvoice(c.id, '700');
    const before = await prisma.reconciliationImport.count();
    const r = await upload(
      [
        `${addDaysIso(TODAY, -1)},Transfer ${inv.invoiceNumber},${inv.balance},credit,PV-1`,
        `not-a-date,Bad date row,100,credit,PV-2`,
        `${addDaysIso(TODAY, -1)},Airtime,500,debit,PV-4`,
      ],
      'bank.csv',
      undefined,
      '/reconciliation/preview',
    ).expect(200);
    expect(r.body.counts).toMatchObject({ INVALID: 1, VALID: 1 });
    expect(await prisma.reconciliationImport.count()).toBe(before);
  });

  it('a suggested match is NOT applied until the user confirms it', async () => {
    const c = await newCustomer();
    const inv = await newInvoice(c.id, '750');
    const saved = (
      await upload([
        `${addDaysIso(TODAY, -1)},Transfer ${inv.invoiceNumber},${inv.balance},credit,SAVE-1`,
      ]).expect(201)
    ).body;
    expect(saved.status).toBe('PENDING_REVIEW');
    expect((await as(tokenA).get(`/invoices/${inv.id}`)).body.balance).toBe(
      inv.balance,
    );

    const detail = (
      await as(tokenA).get(`/reconciliation/imports/${saved.id}`).expect(200)
    ).body;
    expect(detail.notice).toMatch(/not verified/i);
    const row = detail.rows[0];
    expect(row.suggestedInvoice.invoiceNumber).toBe(inv.invoiceNumber);
    const confirmed = await as(tokenA)
      .post(`/reconciliation/rows/${row.id}/confirm`)
      .expect(200);
    expect(confirmed.body.status).toBe('MATCHED');
    expect((await as(tokenA).get(`/invoices/${inv.id}`)).body.status).toBe(
      'PAID',
    );
    await as(tokenA).post(`/reconciliation/rows/${row.id}/confirm`).expect(409);
  });

  it('only decision-ready money-in rows can be matched', async () => {
    const saved = (
      await upload([`${addDaysIso(TODAY, -1)},Airtime,500,debit,OUT-1`]).expect(
        201,
      )
    ).body;
    const rows = (
      await as(tokenA).get(`/reconciliation/imports/${saved.id}`).expect(200)
    ).body.rows;
    for (const r of rows)
      await as(tokenA)
        .post(`/reconciliation/rows/${r.id}/confirm`, { invoiceId: 'x' })
        .expect(400);
    await as(tokenA).post('/reconciliation/rows/ghost/confirm').expect(404);
  });

  it('enforces file rules: csv only, present, and size/row limits', async () => {
    await as(tokenA).post('/reconciliation/preview').expect(400);
    await request(app.getHttpServer() as App)
      .post('/api/reconciliation/preview')
      .set('Authorization', `Bearer ${tokenA}`)
      .attach('file', Buffer.from('a'), 'notes.txt')
      .expect(400);
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
});

describe('account deletion', () => {
  it("deletes all of the account's data, even after a CSV match was confirmed, and leaves other tenants intact", async () => {
    const business = await prisma.business.findUniqueOrThrow({
      where: { ownerId: OWNER_B },
    });
    const customer = await newCustomer('Deletable customer', tokenB);
    const invoice = await newInvoice(customer.id, '1200', {}, tokenB);
    // A confirmed match stores a Transaction pointing at its ImportedTransaction (onDelete:
    // Restrict), which used to make account deletion fail on a foreign key.
    const csv = [
      'Date,Description,Amount,Direction,Reference',
      `${addDaysIso(TODAY, -1)},Transfer ${invoice.invoiceNumber},${invoice.balance},credit,DEL-1`,
    ].join('\n');
    const saved = (
      await request(app.getHttpServer() as App)
        .post('/api/reconciliation/imports')
        .set('Authorization', `Bearer ${tokenB}`)
        .attach('file', Buffer.from(csv), 'delete-me.csv')
        .expect(201)
    ).body;
    const rows = (
      await as(tokenB).get(`/reconciliation/imports/${saved.id}`).expect(200)
    ).body.rows;
    await as(tokenB)
      .post(`/reconciliation/rows/${rows[0].id}/confirm`)
      .expect(200);

    await as(tokenB).del('/auth/account').expect(200);

    expect(await prisma.business.count({ where: { id: business.id } })).toBe(0);
    expect(await prisma.profile.count({ where: { userId: OWNER_B } })).toBe(0);
    expect(
      await prisma.transaction.count({ where: { businessId: business.id } }),
    ).toBe(0);
    expect(
      await prisma.importedTransaction.count({
        where: { import: { businessId: business.id } },
      }),
    ).toBe(0);
    expect(
      await prisma.invoice.count({ where: { businessId: business.id } }),
    ).toBe(0);

    // The other tenant is untouched and still reachable.
    await as(tokenA).get('/dashboard').expect(200);
  });
});
