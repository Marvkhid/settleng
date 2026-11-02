import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { AuditService } from '../common/audit.service';
import { requireBusinessId } from '../common/business';
import { addDaysIso, isoDate, todayInLagos, toDbDate } from '../common/dates';
import { money } from '../common/money';
import { currentUserId, requireRole } from '../auth/tenant-context';
import { PrismaService } from '../prisma/prisma.service';
import { computeDebt, type DebtWithRepayments } from '../debts/debt-view';
import { NotificationProviders } from './notification.provider';
import { CreateReminderDto } from './recovery.dto';

const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');

@Injectable()
export class RecoveryService {
  private readonly log = new Logger(RecoveryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly providers: NotificationProviders,
  ) {}

  // ---------------------------------------------------------------- payment requests

  private async loadDebt(workspaceId: string, debtId: string) {
    const debt = await this.prisma.debt.findFirst({
      where: { id: debtId, workspaceId },
      include: { repayments: { orderBy: { paidOn: 'desc' } }, customer: true },
    });
    if (!debt) throw new NotFoundException('We could not find that debt.');
    return debt;
  }

  /**
   * Creates a shareable payment link. The token is returned exactly once, to the member who created
   * it; only its SHA-256 hash is stored, so a database leak cannot expose live links.
   */
  async createPaymentRequest(debtId: string, days = 30) {
    const workspaceId = requireBusinessId();
    await this.loadDebt(workspaceId, debtId);
    const token = randomBytes(32).toString('base64url');
    const row = await this.prisma.paymentRequest.create({
      data: {
        debtId,
        tokenHash: sha256(token),
        tokenPrefix: token.slice(0, 8),
        expiresAt: toDbDate(addDaysIso(todayInLagos(), days)),
        createdByUserId: currentUserId(),
      },
    });
    await this.prisma.recoveryActivity.create({
      data: {
        debtId,
        actorUserId: currentUserId(),
        kind: 'PAYMENT_REQUEST',
        summary: 'Payment request link created',
      },
    });
    return {
      id: row.id,
      token,
      path: `/pay/${token}`,
      expiresAt: row.expiresAt?.toISOString() ?? null,
    };
  }

  async revokePaymentRequest(debtId: string, requestId: string) {
    const workspaceId = requireBusinessId();
    const row = await this.prisma.paymentRequest.findFirst({
      where: { id: requestId, debtId, debt: { workspaceId } },
    });
    if (!row) throw new NotFoundException('We could not find that link.');
    await this.prisma.paymentRequest.update({
      where: { id: requestId },
      data: { revokedAt: new Date() },
    });
    return { status: 'revoked' };
  }

  /**
   * The public view behind a payment link. It exposes only what a debtor needs in order to pay, and
   * it answers identically for unknown, expired and revoked tokens so links cannot be enumerated.
   */
  async publicPaymentRequest(token: string) {
    const unavailable = new NotFoundException(
      'This payment link is no longer available. Please contact the business that sent it.',
    );
    if (!token || token.length < 20) throw unavailable;
    const row = await this.prisma.paymentRequest.findUnique({
      where: { tokenHash: sha256(token) },
      include: {
        debt: {
          include: { repayments: true, workspace: { select: { name: true, currency: true } } },
        },
      },
    });
    if (!row) throw unavailable;
    if (row.revokedAt) throw unavailable;
    if (row.expiresAt && row.expiresAt.getTime() < Date.now()) throw unavailable;

    const debt = row.debt;
    const computed = computeDebt(debt as unknown as DebtWithRepayments, todayInLagos());
    // Record the view after the checks so a bad token never writes.
    await this.prisma.paymentRequest.update({
      where: { id: row.id },
      data: { viewCount: { increment: 1 }, lastViewedAt: new Date() },
    });
    return {
      reference: row.tokenPrefix,
      business: debt.workspace.name,
      currency: debt.workspace.currency,
      description: debt.description,
      amountOwed: money(debt.principal),
      amountPaid: computed.view.totalRepaid,
      balance: computed.view.balance,
      dueOn: computed.view.dueOn,
      status: computed.view.status,
      instructions:
        'Pay the balance to the business using the details they gave you, then keep your receipt. This page does not take payments.',
      disputeContact:
        'If any of this looks wrong, contact the business directly so they can correct it.',
    };
  }

  // ---------------------------------------------------------------- reminders

  private message(
    templateKey: string,
    debt: { counterpartyName: string; description: string; currency: string },
    balance: string,
    dueOn: string | null,
    business: string,
  ) {
    const name = debt.counterpartyName;
    const subject = `Payment reminder from ${business}`;
    const due = dueOn ? ` It was due on ${dueOn}.` : '';
    const text =
      templateKey === 'firm'
        ? `Hello ${name}, our records at ${business} show ${balance} outstanding for "${debt.description}".${due} Please arrange payment, or reply if you believe this is incorrect.`
        : `Hello ${name}, a friendly reminder from ${business} about "${debt.description}". The outstanding balance is ${balance}.${due} If you have already paid, please ignore this message.`;
    return { subject, text };
  }

  async createReminder(debtId: string, dto: CreateReminderDto) {
    const workspaceId = requireBusinessId();
    const debt = await this.loadDebt(workspaceId, debtId);
    const today = todayInLagos();
    const day = dto.scheduledFor ?? today;
    // 09:00 in Lagos (UTC+1) on the chosen day.
    const scheduledFor = new Date(`${day}T08:00:00.000Z`);
    if (scheduledFor.getTime() < Date.now() - 86_400_000)
      throw new BadRequestException('Choose today or a future date.');
    const row = await this.prisma.$transaction(async (tx) => {
      const created = await tx.reminder.create({
        data: {
          debtId,
          channel: dto.channel,
          templateKey: dto.templateKey ?? 'friendly',
          scheduledFor,
          createdByUserId: currentUserId(),
        },
      });
      await tx.recoveryActivity.create({
        data: {
          debtId,
          actorUserId: currentUserId(),
          kind: 'REMINDER_SCHEDULED',
          summary: `${dto.channel} reminder scheduled for ${day}`,
        },
      });
      return created;
    });
    void debt;
    return {
      id: row.id,
      channel: row.channel,
      status: row.status,
      scheduledFor: row.scheduledFor.toISOString(),
    };
  }

  async cancelReminder(debtId: string, reminderId: string) {
    const workspaceId = requireBusinessId();
    const row = await this.prisma.reminder.findFirst({
      where: { id: reminderId, debtId, debt: { workspaceId } },
    });
    if (!row) throw new NotFoundException('We could not find that reminder.');
    if (row.status === 'SENT')
      throw new BadRequestException('That reminder has already been sent.');
    await this.prisma.reminder.delete({ where: { id: reminderId } });
    return { status: 'cancelled' };
  }

  /**
   * Sends one reminder and records exactly what the provider answered. Unconfigured channels are
   * SKIPPED — nothing is ever reported as sent unless the provider accepted it.
   */
  async deliver(workspaceId: string, reminderId: string) {
    const reminder = await this.prisma.reminder.findFirst({
      where: { id: reminderId, debt: { workspaceId } },
      include: {
        debt: { include: { repayments: true, workspace: { select: { name: true } } } },
      },
    });
    if (!reminder) throw new NotFoundException('We could not find that reminder.');
    if (reminder.status === 'SENT') return { status: 'SENT' as const };

    const computed = computeDebt(reminder.debt as unknown as DebtWithRepayments, todayInLagos());
    if (computed.balance.lte(0)) {
      await this.prisma.reminder.update({
        where: { id: reminderId },
        data: { status: 'SKIPPED', lastError: 'This debt is already fully paid.', attempts: { increment: 1 } },
      });
      return { status: 'SKIPPED' as const, reason: 'already_paid' };
    }

    const to =
      reminder.channel === 'EMAIL'
        ? reminder.debt.counterpartyEmail
        : reminder.debt.counterpartyPhone;
    if (!to) {
      const reason =
        reminder.channel === 'EMAIL'
          ? 'No email address on file for this debtor.'
          : 'No phone number on file for this debtor.';
      await this.prisma.$transaction(async (tx) => {
        await tx.reminder.update({
          where: { id: reminderId },
          data: { status: 'SKIPPED', lastError: reason, attempts: { increment: 1 } },
        });
        await tx.notificationLog.create({
          data: {
            workspaceId,
            debtId: reminder.debtId,
            reminderId,
            channel: reminder.channel,
            provider: 'none',
            status: 'SKIPPED',
            errorCode: 'missing_contact',
          },
        });
      });
      return { status: 'SKIPPED' as const, reason };
    }

    const { subject, text } = this.message(
      reminder.templateKey,
      reminder.debt,
      `₦${computed.view.balance}`,
      computed.view.dueOn,
      reminder.debt.workspace.name,
    );

    await this.prisma.reminder.update({
      where: { id: reminderId },
      data: { status: 'SENDING', attempts: { increment: 1 } },
    });

    const result = await this.providers.send({
      channel: reminder.channel,
      to,
      subject,
      text,
    });

    const status = result.ok ? 'SENT' : result.skippedReason ? 'SKIPPED' : 'FAILED';
    await this.prisma.$transaction(async (tx) => {
      await tx.reminder.update({
        where: { id: reminderId },
        data: {
          status,
          sentAt: result.ok ? new Date() : null,
          lastError: result.ok ? null : (result.skippedReason ?? result.errorCode ?? 'Send failed'),
        },
      });
      await tx.notificationLog.create({
        data: {
          workspaceId,
          debtId: reminder.debtId,
          reminderId,
          channel: reminder.channel,
          provider: result.provider,
          providerMessageId: result.messageId ?? null,
          status: result.ok ? 'SENT' : result.skippedReason ? 'SKIPPED' : 'FAILED',
          errorCode: result.skippedReason ?? result.errorCode ?? null,
        },
      });
      await tx.recoveryActivity.create({
        data: {
          debtId: reminder.debtId,
          actorUserId: currentUserId(),
          kind: `REMINDER_${status}`,
          summary:
            status === 'SENT'
              ? `${reminder.channel} reminder sent to ${reminder.debt.counterpartyName}`
              : `${reminder.channel} reminder not sent (${result.skippedReason ?? result.errorCode ?? 'failed'})`,
        },
      });
    });
    return {
      status,
      reason: result.skippedReason ?? result.errorCode ?? null,
      provider: result.provider,
    };
  }

  async sendNow(debtId: string, reminderId: string) {
    const workspaceId = requireBusinessId();
    const row = await this.prisma.reminder.findFirst({
      where: { id: reminderId, debtId, debt: { workspaceId } },
    });
    if (!row) throw new NotFoundException('We could not find that reminder.');
    return this.deliver(workspaceId, reminderId);
  }

  /**
   * Called by an external scheduler (Render's free tier has no cron). Refuses every request unless
   * CRON_SECRET matches, and claims reminders one at a time so overlapping runs cannot double-send.
   */
  async dispatchDue(secret: string | undefined) {
    const expected = process.env.CRON_SECRET;
    if (!expected) throw new NotFoundException();
    const given = Buffer.from(secret ?? '');
    const want = Buffer.from(expected);
    if (given.length !== want.length || !timingSafeEqual(given, want))
      throw new ForbiddenException('Not allowed.');

    const due = await this.prisma.reminder.findMany({
      where: { status: 'SCHEDULED', scheduledFor: { lte: new Date() } },
      select: { id: true, debt: { select: { workspaceId: true } } },
      orderBy: { scheduledFor: 'asc' },
      take: 25,
    });

    const results: { id: string; status: string }[] = [];
    for (const item of due) {
      // Claim atomically: only the run that flips SCHEDULED → SENDING sends it.
      const claimed = await this.prisma.reminder.updateMany({
        where: { id: item.id, status: 'SCHEDULED' },
        data: { status: 'SENDING' },
      });
      if (claimed.count === 0) continue;
      try {
        const r = await this.deliver(item.debt.workspaceId, item.id);
        results.push({ id: item.id, status: r.status });
      } catch (err) {
        this.log.error(`Reminder ${item.id} failed: ${String(err)}`);
        await this.prisma.reminder.update({
          where: { id: item.id },
          data: { status: 'FAILED', lastError: 'unexpected_error' },
        });
        results.push({ id: item.id, status: 'FAILED' });
      }
    }
    return { processed: results.length, results };
  }

  /** The workspace's delivery log, newest first, so members can see exactly what happened. */
  async notifications(limit = 50) {
    const workspaceId = requireBusinessId();
    const rows = await this.prisma.notificationLog.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 100),
    });
    const debts = await this.prisma.debt.findMany({
      where: { id: { in: rows.map((r) => r.debtId) } },
      select: { id: true, counterpartyName: true },
    });
    const names = new Map(debts.map((d) => [d.id, d.counterpartyName]));
    return {
      items: rows.map((r) => ({
        id: r.id,
        channel: r.channel,
        provider: r.provider,
        status: r.status,
        errorCode: r.errorCode,
        providerMessageId: r.providerMessageId,
        createdAt: r.createdAt.toISOString(),
        debtor: names.get(r.debtId) ?? '',
        debtId: r.debtId,
      })),
      configured: {
        email: !!process.env.RESEND_API_KEY,
        whatsapp: !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID),
        sms: !!process.env.TERMII_API_KEY,
        scheduler: !!process.env.CRON_SECRET,
      },
    };
  }

  /** Reminders that are due across the workspace, for the recovery dashboard. */
  async upcoming() {
    const workspaceId = requireBusinessId();
    const rows = await this.prisma.reminder.findMany({
      where: { debt: { workspaceId }, status: { in: ['SCHEDULED', 'FAILED', 'SKIPPED'] } },
      include: { debt: { select: { id: true, counterpartyName: true } } },
      orderBy: { scheduledFor: 'asc' },
      take: 25,
    });
    return {
      items: rows.map((r) => ({
        id: r.id,
        debtId: r.debtId,
        debtor: r.debt.counterpartyName,
        channel: r.channel,
        status: r.status,
        scheduledFor: r.scheduledFor.toISOString(),
        lastError: r.lastError,
      })),
    };
  }

  async createAndSend(debtId: string, dto: CreateReminderDto) {
    const created = await this.createReminder(debtId, dto);
    return this.sendNow(debtId, created.id);
  }

  async requireOwnerOrManager() {
    requireRole('OWNER', 'MANAGER');
  }
}
