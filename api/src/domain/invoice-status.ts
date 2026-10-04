import Decimal from 'decimal.js';

export type InvoiceStatus =
  'DRAFT' | 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'VOID';

export interface InvoiceLike {
  isDraft: boolean;
  voidedAt: Date | string | null;
  dueDate: string; // YYYY-MM-DD
  items: { quantity: Decimal.Value; unitPrice: Decimal.Value }[];
  payments: { amount: Decimal.Value }[];
}

export function invoiceTotal(items: InvoiceLike['items']): Decimal {
  return items.reduce(
    (sum, i) => sum.plus(new Decimal(i.quantity).times(i.unitPrice)),
    new Decimal(0),
  );
}

export function amountPaid(payments: InvoiceLike['payments']): Decimal {
  return payments.reduce((sum, p) => sum.plus(p.amount), new Decimal(0));
}

export function invoiceBalance(
  inv: Pick<InvoiceLike, 'items' | 'payments'>,
): Decimal {
  return Decimal.max(
    invoiceTotal(inv.items).minus(amountPaid(inv.payments)),
    0,
  );
}

/** Status is always derived from items, payments and dates; never stored or trusted from the browser. */
export function invoiceStatus(inv: InvoiceLike, today: string): InvoiceStatus {
  if (inv.voidedAt) return 'VOID';
  if (inv.isDraft) return 'DRAFT';
  const total = invoiceTotal(inv.items);
  const paid = amountPaid(inv.payments);
  if (total.gt(0) && paid.gte(total)) return 'PAID';
  if (inv.dueDate < today) return 'OVERDUE';
  return paid.gt(0) ? 'PARTIALLY_PAID' : 'UNPAID';
}
