import Decimal from 'decimal.js';
import { Prisma } from '../generated/prisma/client';
import { D, money } from '../common/money';
import { isoDate } from '../common/dates';
import {
  amountPaid,
  invoiceBalance,
  invoiceStatus,
  invoiceTotal,
  InvoiceStatus,
} from '../domain/invoice-status';

export const invoiceInclude = {
  customer: { select: { id: true, name: true } },
  items: { orderBy: { id: 'asc' } },
  payments: { orderBy: [{ paymentDate: 'asc' }, { createdAt: 'asc' }] },
} satisfies Prisma.InvoiceInclude;

export type InvoiceRow = Prisma.InvoiceGetPayload<{
  include: typeof invoiceInclude;
}>;

export interface InvoiceView {
  id: string;
  invoiceNumber: string;
  customer: { id: string; name: string };
  issueDate: string;
  dueDate: string;
  status: InvoiceStatus;
  total: string;
  amountPaid: string;
  balance: string;
  items: {
    id: string;
    description: string;
    quantity: string;
    unitPrice: string;
    lineTotal: string;
  }[];
  payments: {
    id: string;
    amount: string;
    paymentDate: string;
    method: string;
    reference: string | null;
  }[];
}

export function computeInvoice(
  row: InvoiceRow,
  today: string,
): { status: InvoiceStatus; total: Decimal; paid: Decimal; balance: Decimal } {
  const items = row.items.map((i) => ({
    quantity: D(i.quantity),
    unitPrice: D(i.unitPrice),
  }));
  const payments = row.payments.map((p) => ({ amount: D(p.amount) }));
  return {
    status: invoiceStatus(
      {
        isDraft: row.isDraft,
        voidedAt: row.voidedAt,
        dueDate: isoDate(row.dueDate),
        items,
        payments,
      },
      today,
    ),
    total: invoiceTotal(items),
    paid: amountPaid(payments),
    balance: invoiceBalance({ items, payments }),
  };
}

/** Everything the browser sees about an invoice is calculated here, on the server. */
export function toInvoiceView(row: InvoiceRow, today: string): InvoiceView {
  const c = computeInvoice(row, today);
  return {
    id: row.id,
    invoiceNumber: row.invoiceNumber,
    customer: row.customer,
    issueDate: isoDate(row.issueDate),
    dueDate: isoDate(row.dueDate),
    status: c.status,
    total: money(c.total),
    amountPaid: money(c.paid),
    balance: money(c.balance),
    items: row.items.map((i) => ({
      id: i.id,
      description: i.description,
      quantity: D(i.quantity).toString(),
      unitPrice: money(D(i.unitPrice)),
      lineTotal: money(D(i.quantity).times(D(i.unitPrice))),
    })),
    payments: row.payments.map((p) => ({
      id: p.id,
      amount: money(D(p.amount)),
      paymentDate: isoDate(p.paymentDate),
      method: p.method,
      reference: p.reference,
    })),
  };
}
