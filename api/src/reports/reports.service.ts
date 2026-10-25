import { BadRequestException, Injectable } from '@nestjs/common';
import Decimal from 'decimal.js';
import { requireBusinessId } from '../common/business';
import {
  addDaysIso,
  isoDate,
  isRealDate,
  todayInLagos,
  toDbDate,
} from '../common/dates';
import { toCsv } from '../common/csv';
import { D, money } from '../common/money';
import { invoiceInclude, toInvoiceView } from '../invoices/invoice-view';
import { computeInvoice } from '../invoices/invoice-view';
import { PrismaService } from '../prisma/prisma.service';

export interface Range {
  from: string;
  to: string;
}

export type PerformancePeriod = '7d' | '30d' | '90d' | '6m' | '1y';
export type PerformanceGranularity = 'day' | 'week' | 'month';
export type TrendDirection = 'UP' | 'DOWN' | 'FLAT';

const PERFORMANCE_SPECS: Record<
  PerformancePeriod,
  { days?: number; granularity: PerformanceGranularity; previousLabel: string }
> = {
  '7d': {
    days: 7,
    granularity: 'day',
    previousLabel: 'the previous 7 days',
  },
  '30d': {
    days: 30,
    granularity: 'day',
    previousLabel: 'the previous 30 days',
  },
  '90d': {
    days: 90,
    granularity: 'week',
    previousLabel: 'the previous 3 months',
  },
  '6m': {
    days: 180,
    granularity: 'week',
    previousLabel: 'the previous 6 months',
  },
  '1y': {
    granularity: 'month',
    previousLabel: 'the period before this one',
  },
};

/** Whole days covered by [from, to], inclusive. */
const daysBetween = (from: string, to: string): number =>
  Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
      86_400_000,
  ) + 1;

/** ₦25,000.00 for insight sentences (the JSON fields stay plain "25000.00" strings). */
const naira = (v: Decimal): string => {
  const [whole, cents] = money(v).split('.');
  return `₦${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${cents}`;
};

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  resolveRange(from?: string, to?: string): Range {
    const today = todayInLagos();
    const end = to ?? today;
    const start = from ?? addDaysIso(end, -29);
    if (!isRealDate(start) || !isRealDate(end))
      throw new BadRequestException('Please enter real dates.');
    if (start > end)
      throw new BadRequestException(
        'The start date must be before the end date.',
      );
    if (addDaysIso(start, 366) < end)
      throw new BadRequestException(
        'Please choose a range of one year or less.',
      );
    return { from: start, to: end };
  }

  /** Sales on invoices count on the day the invoice is issued (drafts and void invoices are ignored). */
  private async invoiceSalesByDay(r: Range): Promise<Map<string, Decimal>> {
    const rows = await this.prisma.$queryRaw<{ d: Date; total: string }[]>`
      SELECT i."issueDate" AS d, SUM(it."quantity" * it."unitPrice")::text AS total
      FROM "Invoice" i JOIN "InvoiceItem" it ON it."invoiceId" = i."id"
      WHERE i."businessId" = ${requireBusinessId()} AND i."isDraft" = false AND i."voidedAt" IS NULL
        AND i."issueDate" >= ${toDbDate(r.from)} AND i."issueDate" <= ${toDbDate(r.to)}
      GROUP BY i."issueDate"`;
    return new Map(rows.map((x) => [isoDate(x.d), D(x.total)]));
  }

  private async txnsByDay(r: Range) {
    const rows = await this.prisma.transaction.groupBy({
      by: ['date', 'type', 'source'],
      where: {
        businessId: requireBusinessId(),
        date: { gte: toDbDate(r.from), lte: toDbDate(r.to) },
      },
      _sum: { amount: true },
    });
    return rows.map((x) => ({
      date: isoDate(x.date),
      type: x.type,
      source: x.source,
      amount: D(x._sum.amount),
    }));
  }

  /** Single source of truth: the dashboard and the reports page both call this. */
  async summary(range: Range) {
    const [invSales, txns, owing, catRows] = await Promise.all([
      this.invoiceSalesByDay(range),
      this.txnsByDay(range),
      this.customersOwing(),
      this.prisma.transaction.groupBy({
        by: ['type', 'category'],
        where: {
          businessId: requireBusinessId(),
          date: { gte: toDbDate(range.from), lte: toDbDate(range.to) },
        },
        _sum: { amount: true },
        _count: true,
      }),
    ]);
    const sum = (xs: Decimal[]) =>
      xs.reduce((s, x) => s.plus(x), new Decimal(0));
    const recordedSales = sum(
      txns
        .filter((t) => t.type === 'INCOME' && t.source === 'MANUAL')
        .map((t) => t.amount),
    );
    const invoiceSales = sum([...invSales.values()]);
    const moneyIn = sum(
      txns.filter((t) => t.type === 'INCOME').map((t) => t.amount),
    );
    const moneyOut = sum(
      txns.filter((t) => t.type === 'EXPENSE').map((t) => t.amount),
    );
    const breakdown = (t: 'INCOME' | 'EXPENSE') =>
      catRows
        .filter((c) => c.type === t)
        .map((c) => ({
          category: c.category,
          total: D(c._sum.amount),
          count: c._count,
        }))
        .sort((a, b) => b.total.comparedTo(a.total))
        .map((c) => ({
          category: c.category,
          total: money(c.total),
          count: c.count,
        }));
    return {
      range,
      sales: {
        total: money(recordedSales.plus(invoiceSales)),
        recorded: money(recordedSales),
        onInvoices: money(invoiceSales),
      },
      expenses: { total: money(moneyOut) },
      moneyIn: money(moneyIn),
      moneyOut: money(moneyOut),
      netRecordedMovement: money(moneyIn.minus(moneyOut)),
      customersOwing: {
        total: money(owing.total),
        customerCount: owing.customerCount,
        invoiceCount: owing.invoiceCount,
      },
      overdueInvoices: {
        count: owing.overdue.length,
        total: money(owing.overdueTotal),
        items: owing.overdue.slice(0, 10),
      },
      expensesByCategory: breakdown('EXPENSE'),
      incomeByCategory: breakdown('INCOME'),
    };
  }

  /** Money customers owe right now (not limited to a date range). */
  async customersOwing() {
    const today = todayInLagos();
    const rows = await this.prisma.invoice.findMany({
      where: {
        businessId: requireBusinessId(),
        isDraft: false,
        voidedAt: null,
      },
      include: invoiceInclude,
      orderBy: { dueDate: 'asc' },
    });
    let total = new Decimal(0);
    let overdueTotal = new Decimal(0);
    let invoiceCount = 0;
    const byCustomer = new Map<
      string,
      { id: string; name: string; owing: Decimal }
    >();
    const overdue: {
      invoiceId: string;
      invoiceNumber: string;
      customer: string;
      dueDate: string;
      daysOverdue: number;
      balance: string;
    }[] = [];
    for (const r of rows) {
      const c = computeInvoice(r, today);
      if (c.balance.lte(0)) continue;
      invoiceCount++;
      total = total.plus(c.balance);
      const e = byCustomer.get(r.customerId) ?? {
        id: r.customerId,
        name: r.customer.name,
        owing: new Decimal(0),
      };
      e.owing = e.owing.plus(c.balance);
      byCustomer.set(r.customerId, e);
      if (c.status === 'OVERDUE') {
        overdueTotal = overdueTotal.plus(c.balance);
        const days = Math.round(
          (Date.parse(`${today}T00:00:00Z`) - r.dueDate.getTime()) / 86_400_000,
        );
        overdue.push({
          invoiceId: r.id,
          invoiceNumber: r.invoiceNumber,
          customer: r.customer.name,
          dueDate: isoDate(r.dueDate),
          daysOverdue: days,
          balance: money(c.balance),
        });
      }
    }
    const customers = [...byCustomer.values()]
      .sort((a, b) => b.owing.comparedTo(a.owing))
      .map((c) => ({ id: c.id, name: c.name, amountOwing: money(c.owing) }));
    return {
      total,
      customerCount: byCustomer.size,
      invoiceCount,
      overdue,
      overdueTotal,
      customers,
    };
  }

  /**
   * Sales and expenses per day for a range.
   *
   * The definitions are the same ones summary() and timeseries() use, so the chart always
   * reconciles with the Reports page: sales = recorded sales + invoice totals on their issue date
   * (drafts and void invoices excluded), expenses = every expense record. Invoice payments are not
   * added again (they are money in against an invoice that already counted as a sale), and imported
   * bank credits are not treated as sales - they are money in, exactly as on the Reports page.
   */
  private async dailyTotals(
    range: Range,
  ): Promise<Map<string, { sales: Decimal; expenses: Decimal }>> {
    const [invSales, txns] = await Promise.all([
      this.invoiceSalesByDay(range),
      this.txnsByDay(range),
    ]);
    const map = new Map<string, { sales: Decimal; expenses: Decimal }>();
    const at = (d: string) => {
      let e = map.get(d);
      if (!e) {
        e = { sales: new Decimal(0), expenses: new Decimal(0) };
        map.set(d, e);
      }
      return e;
    };
    for (const [d, v] of invSales) at(d).sales = at(d).sales.plus(v);
    for (const t of txns) {
      if (t.type === 'INCOME' && t.source === 'MANUAL')
        at(t.date).sales = at(t.date).sales.plus(t.amount);
      if (t.type === 'EXPENSE')
        at(t.date).expenses = at(t.date).expenses.plus(t.amount);
    }
    return map;
  }

  private bucketRanges(
    from: string,
    to: string,
    granularity: PerformanceGranularity,
  ): Range[] {
    if (granularity === 'day')
      return Array.from({ length: daysBetween(from, to) }, (_, i) => {
        const d = addDaysIso(from, i);
        return { from: d, to: d };
      });
    if (granularity === 'week') {
      const out: Range[] = [];
      for (let start = from; start <= to; start = addDaysIso(start, 7)) {
        const end = addDaysIso(start, 6);
        out.push({ from: start, to: end > to ? to : end });
      }
      return out;
    }
    const out: Range[] = [];
    let monthStart = `${from.slice(0, 7)}-01`;
    while (monthStart <= to) {
      const [y, m] = monthStart.split('-').map(Number);
      const nextMonth =
        m === 12
          ? `${y + 1}-01-01`
          : `${y}-${String(m + 1).padStart(2, '0')}-01`;
      const monthEnd = addDaysIso(nextMonth, -1);
      out.push({
        from: monthStart < from ? from : monthStart,
        to: monthEnd > to ? to : monthEnd,
      });
      monthStart = nextMonth;
    }
    return out;
  }

  /**
   * The Home dashboard chart: real, persisted revenue, expenses and profit over the selected
   * period, compared with the immediately preceding period of the same length. Every money value
   * is calculated with decimal.js on the server, so no floating point touches a total.
   */
  async performance(period: PerformancePeriod = '30d') {
    const spec = PERFORMANCE_SPECS[period];
    const to = todayInLagos();
    const from =
      period === '1y'
        ? `${to.slice(0, 4)}-01-01`
        : addDaysIso(to, -(spec.days! - 1));
    const length = daysBetween(from, to);
    const previousTo = addDaysIso(from, -1);
    const previousFrom = addDaysIso(previousTo, -(length - 1));

    const [current, previous, business] = await Promise.all([
      this.dailyTotals({ from, to }),
      this.dailyTotals({ from: previousFrom, to: previousTo }),
      this.prisma.business.findUnique({
        where: { id: requireBusinessId() },
        select: { currency: true },
      }),
    ]);

    const total = (
      map: Map<string, { sales: Decimal; expenses: Decimal }>,
      key: 'sales' | 'expenses',
    ) => [...map.values()].reduce((s, v) => s.plus(v[key]), new Decimal(0));

    const sales = total(current, 'sales');
    const expenses = total(current, 'expenses');
    const profit = sales.minus(expenses);
    const prevSales = total(previous, 'sales');
    const prevExpenses = total(previous, 'expenses');
    const prevProfit = prevSales.minus(prevExpenses);

    const points = this.bucketRanges(from, to, spec.granularity).map((b) => {
      let bSales = new Decimal(0);
      let bExpenses = new Decimal(0);
      for (let d = b.from; d <= b.to; d = addDaysIso(d, 1)) {
        const t = current.get(d);
        if (!t) continue;
        bSales = bSales.plus(t.sales);
        bExpenses = bExpenses.plus(t.expenses);
      }
      return {
        start: b.from,
        end: b.to,
        sales: money(bSales),
        expenses: money(bExpenses),
        profit: money(bSales.minus(bExpenses)),
      };
    });

    const compare = (cur: Decimal, prev: Decimal) => {
      const diff = cur.minus(prev);
      return {
        current: money(cur),
        previous: money(prev),
        changePct: prev.isZero()
          ? null
          : Number(diff.div(prev.abs()).times(100).toFixed(1)),
        direction: diff.gt(0) ? 'UP' : diff.lt(0) ? 'DOWN' : 'FLAT',
      };
    };

    const salesCmp = compare(sales, prevSales);
    const expensesCmp = compare(expenses, prevExpenses);
    const profitCmp = compare(profit, prevProfit);

    const hasData = !sales.isZero() || !expenses.isZero();
    // A comparison needs something to compare with. An empty previous period cannot produce a
    // percentage, and calling that "0% change" would be a false statement.
    const enoughHistory = !prevSales.isZero() || !prevExpenses.isZero();
    const pct = (c: { changePct: number | null }) =>
      c.changePct === null ? null : `${Math.abs(c.changePct).toFixed(1)}%`;

    const insights: string[] = [];
    if (!hasData) {
      insights.push(
        'No sales or expenses recorded in this period yet. Record a sale or an expense and the chart will fill in.',
      );
    } else if (!enoughHistory) {
      insights.push(
        `Not enough earlier records to compare this period with ${spec.previousLabel}.`,
      );
      insights.push(
        profit.gte(0)
          ? `So far: ${naira(sales)} in sales, ${naira(expenses)} in expenses, and ${naira(profit)} profit.`
          : `So far: ${naira(sales)} in sales and ${naira(expenses)} in expenses - a loss of ${naira(profit.abs())}.`,
      );
    } else {
      if (salesCmp.direction === 'UP' && pct(salesCmp))
        insights.push(
          `Sales increased by ${pct(salesCmp)} compared with ${spec.previousLabel}.`,
        );
      else if (salesCmp.direction === 'DOWN' && pct(salesCmp))
        insights.push(
          `Sales fell by ${pct(salesCmp)} compared with ${spec.previousLabel}.`,
        );
      else if (salesCmp.direction === 'FLAT')
        insights.push(
          `Sales were unchanged compared with ${spec.previousLabel}.`,
        );

      if (
        expensesCmp.direction === 'UP' &&
        expensesCmp.changePct !== null &&
        (salesCmp.changePct === null ||
          expensesCmp.changePct > salesCmp.changePct)
      )
        insights.push(
          `Expenses grew faster than sales during this period (up ${pct(expensesCmp)}).`,
        );
      else if (expensesCmp.direction === 'UP' && pct(expensesCmp))
        insights.push(
          `Expenses rose by ${pct(expensesCmp)} compared with ${spec.previousLabel}.`,
        );
      else if (expensesCmp.direction === 'DOWN' && pct(expensesCmp))
        insights.push(
          `Expenses fell by ${pct(expensesCmp)} compared with ${spec.previousLabel}.`,
        );

      if (profit.lt(0))
        insights.push(
          `Your business recorded a loss of ${naira(profit.abs())} during this period.`,
        );
      else if (profitCmp.direction === 'UP' && pct(profitCmp))
        insights.push(
          `Profit rose by ${pct(profitCmp)} compared with ${spec.previousLabel}, to ${naira(profit)}.`,
        );
      else if (profitCmp.direction === 'DOWN' && pct(profitCmp))
        insights.push(
          `Profit fell by ${pct(profitCmp)} compared with ${spec.previousLabel}, to ${naira(profit)}.`,
        );
      else if (profitCmp.direction === 'FLAT')
        insights.push(`Profit was unchanged at ${naira(profit)}.`);
    }

    return {
      period,
      granularity: spec.granularity,
      currency: business?.currency ?? 'NGN',
      from,
      to,
      previousFrom,
      previousTo,
      previousLabel: spec.previousLabel,
      points,
      totals: {
        sales: money(sales),
        expenses: money(expenses),
        profit: money(profit),
      },
      comparison: {
        sales: salesCmp,
        expenses: expensesCmp,
        profit: profitCmp,
      },
      trend: !enoughHistory
        ? ('UNKNOWN' as const)
        : profitCmp.direction === 'UP'
          ? ('IMPROVING' as const)
          : profitCmp.direction === 'DOWN'
            ? ('DECLINING' as const)
            : ('STABLE' as const),
      hasData,
      enoughHistory,
      insights,
    };
  }

  async timeseries(period: '7d' | '30d' | '90d') {
    const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
    const to = todayInLagos();
    const from = addDaysIso(to, -(days - 1));
    const [invSales, txns] = await Promise.all([
      this.invoiceSalesByDay({ from, to }),
      this.txnsByDay({ from, to }),
    ]);
    const points = Array.from({ length: days }, (_, i) =>
      addDaysIso(from, i),
    ).map((date) => {
      const sales = txns
        .filter(
          (t) =>
            t.date === date && t.type === 'INCOME' && t.source === 'MANUAL',
        )
        .reduce(
          (s, t) => s.plus(t.amount),
          invSales.get(date) ?? new Decimal(0),
        );
      const expenses = txns
        .filter((t) => t.date === date && t.type === 'EXPENSE')
        .reduce((s, t) => s.plus(t.amount), new Decimal(0));
      return { date, sales: money(sales), expenses: money(expenses) };
    });
    return { period, from, to, points };
  }

  async dashboard() {
    const today = todayInLagos();
    // The performance chart loads from /api/reports/performance on its own, so a slow chart never
    // delays the figures above it.
    const [summary, owing, recent] = await Promise.all([
      this.summary({ from: today, to: today }),
      this.customersOwing(),
      this.prisma.transaction.findMany({
        where: { businessId: requireBusinessId() },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        take: 10,
        include: {
          customer: { select: { name: true } },
          invoicePayment: { select: { invoiceId: true } },
        },
      }),
    ]);
    return {
      today,
      salesToday: summary.sales.total,
      expensesToday: summary.expenses.total,
      moneyIn: summary.moneyIn,
      moneyOut: summary.moneyOut,
      customersOwing: summary.customersOwing,
      overdueInvoices: {
        count: summary.overdueInvoices.count,
        total: summary.overdueInvoices.total,
      },
      topDebtors: owing.customers.slice(0, 5),
      recentActivity: recent.map((t) => ({
        id: t.id,
        label: t.description ?? t.category,
        category: t.category,
        date: isoDate(t.date),
        sign: t.type === 'INCOME' ? '+' : '-',
        type: t.type,
        source: t.source,
        amount: money(D(t.amount)),
        customerName: t.customer?.name ?? null,
        invoiceId: t.invoicePayment?.invoiceId ?? null,
      })),
    };
  }

  async exportCsv(
    type: 'transactions' | 'invoices' | 'customers-owing',
    range: Range,
  ): Promise<{ filename: string; body: string }> {
    const today = todayInLagos();
    if (type === 'transactions') {
      const rows = await this.prisma.transaction.findMany({
        where: {
          businessId: requireBusinessId(),
          date: { gte: toDbDate(range.from), lte: toDbDate(range.to) },
        },
        include: { customer: { select: { name: true } } },
        orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
      });
      return {
        filename: `transactions_${range.from}_to_${range.to}.csv`,
        body: toCsv(
          [
            'Date',
            'Type',
            'Amount (NGN)',
            'Category',
            'Description',
            'Customer',
            'Payment method',
            'Reference',
            'Source',
          ],
          rows.map((t) => [
            isoDate(t.date),
            t.type === 'INCOME' ? 'Money in' : 'Money out',
            money(D(t.amount)),
            t.category,
            t.description,
            t.customer?.name,
            t.paymentMethod,
            t.reference,
            t.source,
          ]),
        ),
      };
    }
    const invs = await this.prisma.invoice.findMany({
      where: {
        businessId: requireBusinessId(),
        ...(type === 'invoices'
          ? {
              issueDate: { gte: toDbDate(range.from), lte: toDbDate(range.to) },
            }
          : { isDraft: false, voidedAt: null }),
      },
      include: invoiceInclude,
      orderBy: { dueDate: 'asc' },
    });
    const views = invs.map((r) => toInvoiceView(r, today));
    if (type === 'invoices')
      return {
        filename: `invoices_${range.from}_to_${range.to}.csv`,
        body: toCsv(
          [
            'Invoice',
            'Customer',
            'Issue date',
            'Due date',
            'Status',
            'Total (NGN)',
            'Paid (NGN)',
            'Balance (NGN)',
          ],
          views.map((v) => [
            v.invoiceNumber,
            v.customer.name,
            v.issueDate,
            v.dueDate,
            v.status,
            v.total,
            v.amountPaid,
            v.balance,
          ]),
        ),
      };
    const open = views.filter((v) => D(v.balance).gt(0));
    return {
      filename: `customers-owing_${today}.csv`,
      body: toCsv(
        ['Customer', 'Invoice', 'Due date', 'Status', 'Balance (NGN)'],
        open.map((v) => [
          v.customer.name,
          v.invoiceNumber,
          v.dueDate,
          v.status,
          v.balance,
        ]),
      ),
    };
  }
}
