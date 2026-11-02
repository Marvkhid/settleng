import Decimal from 'decimal.js';
import { isoDate } from '../common/dates';
import { D, money } from '../common/money';
import type { Prisma } from '../generated/prisma/client';

export type DebtStatus =
  | 'PENDING'
  | 'PARTIAL'
  | 'OVERDUE'
  | 'PAID'
  | 'DISPUTED'
  | 'WRITTEN_OFF'
  | 'CANCELLED';

export interface DebtView {
  id: string;
  counterpartyName: string;
  counterpartyPhone: string | null;
  counterpartyEmail: string | null;
  direction: 'OWED_TO_ME' | 'I_OWE';
  principal: string;
  currency: string;
  description: string;
  incurredOn: string;
  dueOn: string | null;
  terms: string | null;
  status: DebtStatus;
  override: 'DISPUTED' | 'WRITTEN_OFF' | 'CANCELLED' | null;
  balance: string;
  totalRepaid: string;
  daysOverdue: number;
  customer: { id: string; name: string } | null;
  assignedToUserId: string | null;
  repaymentCount: number;
  lastPaymentOn: string | null;
  createdAt: string;
}

export const debtInclude = {
  customer: { select: { id: true, name: true } },
  repayments: { select: { amount: true, paidOn: true }, orderBy: { paidOn: 'desc' } },
} satisfies Prisma.DebtInclude;

export type DebtWithRepayments = Prisma.DebtGetPayload<{ include: typeof debtInclude }>;

/** Whole days between two ISO dates (b - a). Dates are UTC-normalised YYYY-MM-DD. */
export function daysBetween(a: string, b: string): number {
  const from = Date.parse(`${a}T00:00:00Z`);
  const to = Date.parse(`${b}T00:00:00Z`);
  return Math.round((to - from) / 86_400_000);
}

/**
 * The one place a debt's balance and status are computed. Every reader — list, detail, summary,
 * analytics, the public payment page — goes through this, so the numbers can never disagree.
 */
export function computeDebt(d: DebtWithRepayments, today: string): {
  view: DebtView;
  balance: Decimal;
  repaid: Decimal;
  live: boolean;
} {
  const repaid = d.repayments.reduce((sum, r) => sum.plus(D(r.amount)), new Decimal(0));
  const balance = Decimal.max(new Decimal(0), D(d.principal).minus(repaid));
  const dueIso = d.dueOn ? isoDate(d.dueOn) : null;
  const daysOverdue =
    dueIso && balance.gt(0) && dueIso < today ? daysBetween(dueIso, today) : 0;
  const override = d.override as DebtStatus | null;
  const status: DebtStatus =
    override ??
    (balance.lte(0)
      ? 'PAID'
      : daysOverdue > 0
        ? 'OVERDUE'
        : repaid.gt(0)
          ? 'PARTIAL'
          : 'PENDING');
  const live = !override && balance.gt(0);
  return {
    balance,
    repaid,
    live,
    view: {
      id: d.id,
      counterpartyName: d.counterpartyName,
      counterpartyPhone: d.counterpartyPhone,
      counterpartyEmail: d.counterpartyEmail,
      direction: d.direction as 'OWED_TO_ME' | 'I_OWE',
      principal: money(d.principal),
      currency: d.currency,
      description: d.description,
      incurredOn: isoDate(d.incurredOn),
      dueOn: dueIso,
      terms: d.terms,
      status,
      override: (d.override as 'DISPUTED' | 'WRITTEN_OFF' | 'CANCELLED' | null) ?? null,
      balance: money(balance),
      totalRepaid: money(repaid),
      daysOverdue,
      customer: d.customer ? { id: d.customer.id, name: d.customer.name } : null,
      assignedToUserId: d.assignedToUserId,
      repaymentCount: d.repayments.length,
      lastPaymentOn: d.repayments[0] ? isoDate(d.repayments[0].paidOn) : null,
      createdAt: d.createdAt.toISOString(),
    },
  };
}
