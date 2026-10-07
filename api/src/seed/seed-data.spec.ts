import Decimal from 'decimal.js';
import {
  invoiceBalance,
  invoiceStatus,
  invoiceTotal,
} from '../domain/invoice-status';
import { buildSeedData, addDays } from './seed-data';

const TODAY = '2026-10-04';
const data = buildSeedData(TODAY);

const invoiceView = (invId: string) => {
  const inv = data.invoices.find((i) => i.id === invId)!;
  return {
    ...inv,
    voidedAt: null,
    items: data.items.filter((x) => x.invoiceId === invId),
    payments: data.payments.filter((x) => x.invoiceId === invId),
  };
};

describe('seed data', () => {
  it('is deterministic', () => {
    expect(buildSeedData(TODAY)).toEqual(data);
  });

  it('meets the volume targets from the spec', () => {
    expect(data.customers).toHaveLength(12);
    expect(data.invoices).toHaveLength(25);
    expect(data.items.length).toBeGreaterThanOrEqual(40);
    expect(data.items.length).toBeLessThanOrEqual(60);
    expect(data.payments.length).toBeGreaterThanOrEqual(20);
    expect(data.payments.length).toBeLessThanOrEqual(30);
    expect(data.transactions.length).toBeGreaterThanOrEqual(80);
    expect(data.transactions.length).toBeLessThanOrEqual(120);
    expect(data.imports).toHaveLength(3);
    expect(data.importedRows.length).toBeGreaterThanOrEqual(30);
    expect(data.importedRows.length).toBeLessThanOrEqual(50);
  });

  it('has unique ids and invoice numbers', () => {
    const all = [
      ...data.customers,
      ...data.invoices,
      ...data.items,
      ...data.payments,
      ...data.transactions,
      ...data.imports,
      ...data.importedRows,
    ].map((x) => x.id);
    expect(new Set(all).size).toBe(all.length);
    const nums = data.invoices.map((i) => i.invoiceNumber);
    expect(new Set(nums).size).toBe(nums.length);
  });

  it('contains every invoice status the demo needs', () => {
    const statuses = new Set(
      data.invoices.map((i) => invoiceStatus(invoiceView(i.id), TODAY)),
    );
    for (const s of ['DRAFT', 'UNPAID', 'PARTIALLY_PAID', 'PAID', 'OVERDUE'])
      expect(statuses).toContain(s);
  });

  it('never overpays an invoice and keeps payments inside a valid date range', () => {
    for (const inv of data.invoices) {
      const v = invoiceView(inv.id);
      expect(invoiceBalance(v).gte(0)).toBe(true);
      const paid = v.payments.reduce(
        (s, p) => s.plus(p.amount),
        new Decimal(0),
      );
      expect(paid.lte(invoiceTotal(v.items))).toBe(true);
      for (const p of v.payments) {
        expect(p.paymentDate >= inv.issueDate).toBe(true);
        expect(p.paymentDate <= TODAY).toBe(true);
      }
    }
  });

  it('keeps issue date before due date and draft invoices unpaid', () => {
    for (const inv of data.invoices) {
      expect(inv.issueDate < inv.dueDate).toBe(true);
      if (inv.isDraft)
        expect(data.payments.some((p) => p.invoiceId === inv.id)).toBe(false);
    }
  });

  it('links every invoice payment to exactly one matching income transaction', () => {
    for (const p of data.payments) {
      const txns = data.transactions.filter((t) => t.invoicePaymentId === p.id);
      expect(txns).toHaveLength(1);
      expect(txns[0].type).toBe('INCOME');
      expect(txns[0].amount).toBe(p.amount);
      expect(txns[0].date).toBe(p.paymentDate);
    }
  });

  it('has only positive amounts and references that exist', () => {
    const custIds = new Set(data.customers.map((c) => c.id));
    for (const i of data.invoices) expect(custIds.has(i.customerId)).toBe(true);
    for (const t of data.transactions) expect(t.amount).toBeGreaterThan(0);
    for (const x of data.items) {
      expect(x.quantity).toBeGreaterThan(0);
      expect(x.unitPrice).toBeGreaterThan(0);
    }
  });

  it('has both income and expense transactions across several months', () => {
    expect(data.transactions.some((t) => t.type === 'EXPENSE')).toBe(true);
    const months = new Set(data.transactions.map((t) => t.date.slice(0, 7)));
    expect(months.size).toBeGreaterThanOrEqual(2);
    expect(
      data.transactions.some((t) => t.date === TODAY && t.type === 'INCOME'),
    ).toBe(true);
  });

  it('covers every reconciliation row state, and suggestions are never pre-confirmed', () => {
    const states = new Set(data.importedRows.map((r) => r.matchStatus));
    for (const s of [
      'VALID',
      'INVALID',
      'DUPLICATE',
      'UNMATCHED',
      'SUGGESTED_MATCH',
      'MATCHED',
    ])
      expect(states).toContain(s);
    for (const r of data.importedRows.filter(
      (x) => x.matchStatus === 'SUGGESTED_MATCH',
    )) {
      expect(r.matchedInvoiceId).toBeNull();
      expect(r.suggestedInvoiceId).not.toBeNull();
    }
    for (const imp of data.imports) {
      expect(
        data.importedRows.filter((r) => r.importId === imp.id),
      ).toHaveLength(imp.rowCount);
    }
  });

  it('every suggested match can really be confirmed: dated on/after the invoice, not in the future, and within what is owed', () => {
    for (const r of data.importedRows.filter(
      (x) => x.matchStatus === 'SUGGESTED_MATCH',
    )) {
      const inv = data.invoices.find((i) => i.id === r.suggestedInvoiceId)!;
      const v = invoiceView(inv.id);
      expect(r.date! >= inv.issueDate).toBe(true);
      expect(r.date! <= TODAY).toBe(true);
      expect(new Decimal(r.amount!).lte(invoiceBalance(v))).toBe(true);
      expect(invoiceStatus(v, TODAY)).not.toBe('PAID');
    }
    for (const r of data.importedRows.filter(
      (x) => x.matchStatus === 'MATCHED',
    )) {
      const pay = data.payments.find(
        (p) => p.invoiceId === r.matchedInvoiceId,
      )!;
      expect(r.date).toBe(pay.paymentDate);
      expect(r.amount).toBe(pay.amount);
    }
  });

  it('shifts all dates with `today` and keeps the same story', () => {
    const later = buildSeedData(addDays(TODAY, 30));
    expect(later.invoices.map((i) => i.invoiceNumber)).toEqual(
      data.invoices.map((i) => i.invoiceNumber),
    );
    const statuses = later.invoices.map((i) =>
      invoiceStatus(
        {
          ...i,
          voidedAt: null,
          items: later.items.filter((x) => x.invoiceId === i.id),
          payments: later.payments.filter((x) => x.invoiceId === i.id),
        },
        addDays(TODAY, 30),
      ),
    );
    expect(statuses).toContain('OVERDUE');
    expect(statuses).toContain('PAID');
  });
});
