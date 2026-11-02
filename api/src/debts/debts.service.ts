import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import Decimal from 'decimal.js';
import { AuditService } from '../common/audit.service';
import { requireBusinessId } from '../common/business';
import { isoDate, todayInLagos, toDbDate } from '../common/dates';
import { D, money } from '../common/money';
import { Page, pageOf } from '../common/pagination';
import {
  currentRole,
  currentUserId,
  requireRole,
} from '../auth/tenant-context';
import { PrismaService } from '../prisma/prisma.service';
import {
  AssignDebtDto,
  CreateDebtDto,
  DebtListQuery,
  RecordRepaymentDto,
  UpdateDebtDto,
} from './debt.dto';
import {
  computeDebt,
  debtInclude,
  type DebtStatus,
  type DebtView,
} from './debt-view';

export interface DebtSummary {
  today: string;
  owedToMe: { outstanding: string; recovered: string; count: number };
  iOwe: { outstanding: string; count: number };
  overdue: { amount: string; count: number };
  dueSoon: { amount: string; count: number };
  recoveredThisMonth: string;
}

const soonDays = 7;

@Injectable()
export class DebtsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private async allViews() {
    const today = todayInLagos();
    const rows = await this.prisma.debt.findMany({
      where: { workspaceId: requireBusinessId() },
      include: debtInclude,
      orderBy: [{ dueOn: 'asc' }, { createdAt: 'desc' }],
    });
    return rows.map((d) => ({ row: d, ...computeDebt(d, today), today }));
  }

  async list(q: DebtListQuery): Promise<Page<DebtView>> {
    const computed = await this.allViews();
    let items = computed;
    if (q.direction) items = items.filter((i) => i.view.direction === q.direction);
    if (q.status) items = items.filter((i) => i.view.status === q.status);
    if (q.customerId) items = items.filter((i) => i.row.customerId === q.customerId);
    if (q.from) items = items.filter((i) => i.view.incurredOn >= q.from!);
    if (q.to) items = items.filter((i) => i.view.incurredOn <= q.to!);
    if (q.search) {
      const s = q.search.trim().toLowerCase();
      items = items.filter(
        (i) =>
          i.view.counterpartyName.toLowerCase().includes(s) ||
          i.view.description.toLowerCase().includes(s) ||
          (i.view.counterpartyPhone ?? "").includes(s) ||
          (i.view.customer?.name ?? "").toLowerCase().includes(s),
      );
    }
    // Unpaid first (oldest due date first), settled debts last.
    const rank = (v: DebtView) => (v.status === 'PAID' ? 2 : v.daysOverdue > 0 ? 0 : 1);
    items = [...items].sort((a, b) => {
      const byRank = rank(a.view) - rank(b.view);
      if (byRank !== 0) return byRank;
      return (a.view.dueOn ?? a.view.incurredOn).localeCompare(
        b.view.dueOn ?? b.view.incurredOn,
      );
    });
    const start = (q.page - 1) * q.pageSize;
    return pageOf(
      items.slice(start, start + q.pageSize).map((i) => i.view),
      items.length,
      q,
    );
  }

  async get(id: string) {
    const today = todayInLagos();
    const debt = await this.prisma.debt.findFirst({
      where: { id, workspaceId: requireBusinessId() },
      include: {
        ...debtInclude,
        repayments: { orderBy: { paidOn: 'desc' } },
        activities: { orderBy: { createdAt: 'desc' }, take: 25 },
        reminders: { orderBy: { scheduledFor: 'desc' }, take: 15 },
        paymentRequests: { orderBy: { createdAt: 'desc' }, take: 10 },
        documents: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!debt) throw new NotFoundException('We could not find that debt.');
    const computed = computeDebt(debt, today);
    return {
      ...computed.view,
      repayments: debt.repayments.map((r) => ({
        id: r.id,
        amount: money(r.amount),
        paidOn: isoDate(r.paidOn),
        method: r.method,
        reference: r.reference,
        note: r.note,
        recordedByUserId: r.recordedByUserId,
      })),
      activities: debt.activities.map((a) => ({
        id: a.id,
        kind: a.kind,
        summary: a.summary,
        createdAt: a.createdAt.toISOString(),
      })),
      reminders: debt.reminders.map((r) => ({
        id: r.id,
        channel: r.channel,
        status: r.status,
        scheduledFor: r.scheduledFor.toISOString(),
        sentAt: r.sentAt?.toISOString() ?? null,
        lastError: r.lastError,
      })),
      paymentRequests: debt.paymentRequests.map((p) => ({
        id: p.id,
        tokenPrefix: p.tokenPrefix,
        createdAt: p.createdAt.toISOString(),
        expiresAt: p.expiresAt?.toISOString() ?? null,
        revokedAt: p.revokedAt?.toISOString() ?? null,
        viewCount: p.viewCount,
        active: !p.revokedAt && (!p.expiresAt || p.expiresAt > new Date()),
      })),
      documents: debt.documents.map((d) => ({
        id: d.id,
        filename: d.filename,
        mime: d.mime,
        sizeBytes: d.sizeBytes,
        createdAt: d.createdAt.toISOString(),
      })),
    };
  }

  private async checkCustomer(customerId?: string) {
    if (!customerId) return null;
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, businessId: requireBusinessId() },
      select: { id: true },
    });
    if (!customer) throw new NotFoundException('We could not find that customer.');
    return customerId;
  }

  private async checkAssignee(userId?: string | null) {
    if (!userId) return null;
    const member = await this.prisma.organisationMembership.findFirst({
      where: { workspaceId: requireBusinessId(), userId, status: 'ACTIVE' },
      select: { userId: true },
    });
    if (!member) throw new BadRequestException('Choose someone in this workspace.');
    return userId;
  }

  async create(dto: CreateDebtDto): Promise<DebtView> {
    if (new Decimal(dto.principal).lte(0))
      throw new BadRequestException('Enter an amount greater than zero.');
    const [customerId, assignedToUserId] = await Promise.all([
      this.checkCustomer(dto.customerId),
      this.checkAssignee(dto.assignedToUserId),
    ]);
    const debt = await this.prisma.$transaction(async (tx) => {
      const created = await tx.debt.create({
        data: {
          workspaceId: requireBusinessId(),
          counterpartyName: dto.counterpartyName.trim(),
          counterpartyPhone: dto.counterpartyPhone?.trim() || null,
          counterpartyEmail: dto.counterpartyEmail?.trim().toLowerCase() || null,
          direction: dto.direction,
          principal: dto.principal,
          description: dto.description.trim(),
          incurredOn: toDbDate(dto.incurredOn),
          dueOn: dto.dueOn ? toDbDate(dto.dueOn) : null,
          terms: dto.terms?.trim() || null,
          customerId,
          assignedToUserId,
          createdByUserId: currentUserId(),
        },
        include: debtInclude,
      });
      await tx.recoveryActivity.create({
        data: {
          debtId: created.id,
          actorUserId: currentUserId(),
          kind: 'DEBT_CREATED',
          summary: `Debt of ${money(created.principal)} recorded for ${created.counterpartyName}`,
        },
      });
      await this.audit.record(tx, {
        action: 'DEBT_CREATED',
        entityType: 'Debt',
        entityId: created.id,
        summary: `Debt of ${money(created.principal)} recorded for ${created.counterpartyName}`,
      });
      return created;
    });
    return computeDebt(debt, todayInLagos()).view;
  }

  async update(id: string, dto: UpdateDebtDto) {
    const existing = await this.prisma.debt.findFirst({
      where: { id, workspaceId: requireBusinessId() },
      include: { repayments: { select: { amount: true } } },
    });
    if (!existing) throw new NotFoundException('We could not find that debt.');
    if (dto.principal !== undefined) {
      const repaid = existing.repayments.reduce((s, r) => s.plus(D(r.amount)), new Decimal(0));
      if (new Decimal(dto.principal).lt(repaid))
        throw new ConflictException(
          `This debt already has ${money(repaid)} repaid, so the amount cannot be lower than that.`,
        );
      if (existing.repayments.length > 0 && existing.override === null && dto.principal !== money(existing.principal))
        throw new ConflictException(
          'Repayments have already been recorded, so the original amount cannot change.',
        );
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const debt = await tx.debt.update({
        where: { id },
        data: {
          counterpartyName: dto.counterpartyName?.trim(),
          counterpartyPhone: dto.counterpartyPhone?.trim() || undefined,
          counterpartyEmail: dto.counterpartyEmail?.trim().toLowerCase() || undefined,
          principal: dto.principal,
          description: dto.description?.trim(),
          incurredOn: dto.incurredOn ? toDbDate(dto.incurredOn) : undefined,
          dueOn: dto.dueOn ? toDbDate(dto.dueOn) : undefined,
          terms: dto.terms?.trim() || undefined,
          override: dto.override === undefined ? undefined : dto.override,
        },
        include: debtInclude,
      });
      await tx.recoveryActivity.create({
        data: {
          debtId: id,
          actorUserId: currentUserId(),
          kind: dto.override === undefined ? 'DEBT_UPDATED' : 'STATUS_CHANGED',
          summary:
            dto.override === undefined
              ? `Details updated for ${debt.counterpartyName}`
              : `Status set to ${dto.override ?? 'automatic'}`,
        },
      });
      await this.audit.record(tx, {
        action: 'DEBT_UPDATED',
        entityType: 'Debt',
        entityId: id,
        summary: `Debt for ${debt.counterpartyName} updated`,
      });
      return debt;
    });
    return computeDebt(updated, todayInLagos()).view;
  }

  async assign(id: string, dto: AssignDebtDto) {
    requireRole('OWNER', 'MANAGER');
    const debt = await this.prisma.debt.findFirst({
      where: { id, workspaceId: requireBusinessId() },
      select: { id: true },
    });
    if (!debt) throw new NotFoundException('We could not find that debt.');
    const userId = await this.checkAssignee(dto.userId);
    await this.prisma.$transaction(async (tx) => {
      await tx.debt.update({ where: { id }, data: { assignedToUserId: userId } });
      await tx.recoveryActivity.create({
        data: {
          debtId: id,
          actorUserId: currentUserId(),
          kind: 'ASSIGNED',
          summary: userId ? 'Recovery assigned to a team member' : 'Recovery assignment cleared',
        },
      });
    });
    return { id, assignedToUserId: userId };
  }

  async remove(id: string) {
    requireRole('OWNER', 'MANAGER');
    const debt = await this.prisma.debt.findFirst({
      where: { id, workspaceId: requireBusinessId() },
      include: { repayments: { select: { id: true } } },
    });
    if (!debt) throw new NotFoundException('We could not find that debt.');
    if (debt.repayments.length > 0)
      throw new ConflictException(
        'This debt has repayments recorded against it. Mark it written off instead of deleting it.',
      );
    await this.prisma.$transaction(async (tx) => {
      await tx.recoveryActivity.deleteMany({ where: { debtId: id } });
      await tx.debt.delete({ where: { id } });
      await this.audit.record(tx, {
        action: 'DEBT_DELETED',
        entityType: 'Debt',
        entityId: id,
        summary: `Debt for ${debt.counterpartyName} deleted`,
      });
    });
    return { status: 'deleted' };
  }

  /**
   * Records a repayment. The debt row is locked for the duration of the transaction, so two clicks
   * (or two officers) can never overpay a debt, and duplicate receipt references are rejected by a
   * unique index as well as by this check.
   */
  async recordRepayment(debtId: string, dto: RecordRepaymentDto) {
    const workspaceId = requireBusinessId();
    const amount = new Decimal(dto.amount);
    if (amount.lte(0)) throw new BadRequestException('Enter an amount greater than zero.');

    return this.prisma.$transaction(
      async (tx) => {
        const locked = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT "id" FROM "Debt"
          WHERE "id" = ${debtId} AND "workspaceId" = ${workspaceId}
          FOR UPDATE`;
        if (locked.length === 0)
          throw new NotFoundException('We could not find that debt.');

        const debt = await tx.debt.findUniqueOrThrow({
          where: { id: debtId },
          include: { repayments: true },
        });
        const repaid = debt.repayments.reduce(
          (s, r) => s.plus(D(r.amount)),
          new Decimal(0),
        );
        const balance = D(debt.principal).minus(repaid);
        if (amount.gt(balance))
          throw new ConflictException(
            balance.lte(0)
              ? 'This debt is already fully repaid.'
              : `That is more than the ${money(balance)} still outstanding.`,
          );
        if (dto.reference) {
          const duplicate = await tx.debtRepayment.findFirst({
            where: { debtId, reference: dto.reference.trim() },
          });
          if (duplicate)
            throw new ConflictException(
              `A payment with reference ${dto.reference} was already recorded.`,
            );
        }
        const repayment = await tx.debtRepayment.create({
          data: {
            debtId,
            amount: dto.amount,
            paidOn: toDbDate(dto.paidOn ?? todayInLagos()),
            method: dto.method,
            reference: dto.reference?.trim() || null,
            note: dto.note?.trim() || null,
            recordedByUserId: currentUserId(),
          },
        });
        const newBalance = balance.minus(amount);
        // The moment a debt is settled, its automatic reminders stop for good: no future email
        // can be sitting in the queue for money that has already been paid.
        if (newBalance.lte(0))
          await tx.debtReminder.updateMany({
            where: { debtId },
            data: { enabled: false, paused: false, nextRunAt: null, lastError: 'debt_settled' },
          });
        await tx.recoveryActivity.create({
          data: {
            debtId,
            actorUserId: currentUserId(),
            kind: 'REPAYMENT',
            summary: `${money(amount)} received from ${debt.counterpartyName}. ${money(newBalance)} outstanding.`,
          },
        });
        await this.audit.record(tx, {
          action: 'DEBT_REPAYMENT',
          entityType: 'Debt',
          entityId: debtId,
          summary: `${money(amount)} repayment recorded for ${debt.counterpartyName}`,
        });
        return {
          id: repayment.id,
          amount: money(repayment.amount),
          balance: money(newBalance),
          status: newBalance.lte(0) ? 'PAID' : 'PARTIAL',
        };
      },
      { timeout: 20_000 },
    );
  }

  async summary(): Promise<DebtSummary> {
    const today = todayInLagos();
    const computed = await this.allViews();
    const thisMonth = today.slice(0, 7);
    let owed = new Decimal(0);
    let recovered = new Decimal(0);
    let owe = new Decimal(0);
    let overdue = new Decimal(0);
    let overdueCount = 0;
    let dueSoon = new Decimal(0);
    let dueSoonCount = 0;
    let recoveredThisMonth = new Decimal(0);
    for (const c of computed) {
      if (c.view.direction === 'I_OWE') {
        if (c.live) owe = owe.plus(c.balance);
        continue;
      }
      recovered = recovered.plus(c.repaid);
      if (c.live) owed = owed.plus(c.balance);
      if (c.live && c.view.daysOverdue > 0) {
        overdue = overdue.plus(c.balance);
        overdueCount += 1;
      } else if (c.live && c.view.dueOn && c.view.dueOn >= today) {
        const days = Math.round(
          (Date.parse(`${c.view.dueOn}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000,
        );
        if (days <= soonDays) {
          dueSoon = dueSoon.plus(c.balance);
          dueSoonCount += 1;
        }
      }
      for (const r of c.row.repayments) {
        if (isoDate(r.paidOn).startsWith(thisMonth)) recoveredThisMonth = recoveredThisMonth.plus(D(r.amount));
      }
    }
    return {
      today,
      owedToMe: {
        outstanding: money(owed),
        recovered: money(recovered),
        count: computed.filter((c) => c.view.direction === 'OWED_TO_ME' && c.live).length,
      },
      iOwe: {
        outstanding: money(owe),
        count: computed.filter((c) => c.view.direction === 'I_OWE' && c.live).length,
      },
      overdue: { amount: money(overdue), count: overdueCount },
      dueSoon: { amount: money(dueSoon), count: dueSoonCount },
      recoveredThisMonth: money(recoveredThisMonth),
    };
  }

  /** Debt ageing for receivables, plus collection performance. Never estimated, always from rows. */
  async analytics() {
    const today = todayInLagos();
    const computed = await this.allViews();
    const buckets = [
      { key: 'notDue', label: 'Not due yet', min: -1e9, max: 0 },
      { key: 'd1_30', label: '1–30 days', min: 1, max: 30 },
      { key: 'd31_60', label: '31–60 days', min: 31, max: 60 },
      { key: 'd61_90', label: '61–90 days', min: 61, max: 90 },
      { key: 'd90plus', label: 'Over 90 days', min: 91, max: 1e9 },
    ].map((b) => ({ ...b, amount: new Decimal(0), count: 0 }));

    let outstanding = new Decimal(0);
    let recovered = new Decimal(0);
    const monthly = new Map<string, Decimal>();

    for (const c of computed) {
      if (c.view.direction !== 'OWED_TO_ME') continue;
      recovered = recovered.plus(c.repaid);
      if (!c.live) continue;
      outstanding = outstanding.plus(c.balance);
      const bucket = buckets.find((b) => c.view.daysOverdue >= b.min && c.view.daysOverdue <= b.max);
      if (bucket) {
        bucket.amount = bucket.amount.plus(c.balance);
        bucket.count += 1;
      }
      for (const r of c.row.repayments) {
        const key = isoDate(r.paidOn).slice(0, 7);
        monthly.set(key, (monthly.get(key) ?? new Decimal(0)).plus(D(r.amount)));
      }
    }

    const months: { month: string; amount: string }[] = [];
    for (let i = 5; i >= 0; i -= 1) {
      const d = new Date(`${today.slice(0, 8)}01T00:00:00Z`);
      d.setUTCMonth(d.getUTCMonth() - i);
      const key = d.toISOString().slice(0, 7);
      months.push({ month: key, amount: money(monthly.get(key) ?? 0) });
    }

    const totalRecoverable = outstanding.plus(recovered);
    return {
      today,
      ageing: buckets.map((b) => ({
        key: b.key,
        label: b.label,
        amount: money(b.amount),
        count: b.count,
      })),
      outstanding: money(outstanding),
      recovered: money(recovered),
      collectionRate:
        totalRecoverable.lte(0)
          ? null
          : Number(recovered.dividedBy(totalRecoverable).times(100).toFixed(1)),
      monthlyRecovered: months,
      liveDebtCount: computed.filter((c) => c.view.direction === 'OWED_TO_ME' && c.live).length,
    };
  }

  /** Guard used by the recovery controllers: the debt must belong to the active workspace. */
  async requireDebt(debtId: string) {
    const debt = await this.prisma.debt.findFirst({
      where: { id: debtId, workspaceId: requireBusinessId() },
      include: debtInclude,
    });
    if (!debt) throw new NotFoundException('We could not find that debt.');
    return debt;
  }

  /** Staff may only act on debts assigned to them; owners and managers may act on any. */
  async requireDebtAccess(debtId: string) {
    const debt = await this.requireDebt(debtId);
    if (currentRole() === 'STAFF' && debt.assignedToUserId !== currentUserId())
      throw new ForbiddenException('This debt is not assigned to you.');
    return debt;
  }
}
