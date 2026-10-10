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
    const [summary, owing, recent, series] = await Promise.all([
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
      this.timeseries('7d'),
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
      chart: series,
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
