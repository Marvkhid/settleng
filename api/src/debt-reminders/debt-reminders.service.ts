import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { timingSafeEqual } from 'crypto';
import { requireBusinessId } from '../common/business';
import { todayInLagos } from '../common/dates';
import { D, money } from '../common/money';
import { PrismaService } from '../prisma/prisma.service';
import { currentUserEmail, currentUserId, requireRole } from '../auth/tenant-context';
import { computeDebt, type DebtWithRepayments } from '../debts/debt-view';
import { NotificationProviders } from '../recovery/notification.provider';
import { renderReminderEmail } from './reminder-email';
import { renderDebtorReminderEmail } from './debtor-reminder-email';
import { formatNaira } from './money-format';
import {
  DEFAULT_TIMEZONE,
  greetingFor,
  isQuietHour,
  isValidTime,
  nextRunAfter,
  normaliseTimes,
  zoneHour,
} from './reminder-time';
import { SaveDebtReminderDto } from './debt-reminder.dto';

const LIVE_STATUSES = ['PENDING', 'PARTIAL', 'OVERDUE'];
const MAX_FAILURES = 3;
const APP_URL = () => (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/$/, '');

type ReminderWithDebt = {
  id: string;
  debtId: string;
  workspaceId: string;
  ownerUserId: string;
  email: string;
  frequency: string;
  times: string[];
  timezone: string;
  nextRunAt: Date | null;
  failureCount: number;
  debt: {
    id: string;
    counterpartyName: string;
    counterpartyEmail: string | null;
    direction: string;
    description: string;
    principal: unknown;
    dueOn: Date | null;
    override: string | null;
    repayments: unknown[];
    workspace: { name: string };
  };
};

/** Everything one scheduler window sends to one owner, plus the debtor copies it owes. */
type DeliveryGroup = {
  workspaceId: string;
  ownerUserId: string;
  email: string;
  businessName: string;
  timezone: string;
  slot: Date;
  debts: { id: string; name: string; balance: string }[];
  reminderIds: string[];
  /** One entry per debtor address on the debts in this window, holding only their own debt. */
  debtorCopies: Map<string, { debtId: string; debts: { description: string; balance: string }[] }>;
};

@Injectable()
export class DebtRemindersService {
  private readonly log = new Logger(DebtRemindersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly providers: NotificationProviders,
  ) {}

  // ------------------------------------------------------------------ configuration

  private async loadDebt(debtId: string) {
    const debt = await this.prisma.debt.findFirst({
      where: { id: debtId, workspaceId: requireBusinessId() },
      include: { repayments: true },
    });
    if (!debt) throw new NotFoundException('We could not find that debt.');
    return debt;
  }

  private validate(dto: SaveDebtReminderDto) {
    const times = normaliseTimes(dto.times ?? []);
    if (dto.enabled) {
      if (times.length === 0)
        throw new BadRequestException('Choose at least one time to be reminded.');
      if (times.length > 3)
        throw new BadRequestException('You can choose up to three reminder times a day.');
      for (const t of times) {
        if (!isValidTime(t))
          throw new BadRequestException(`"${t}" is not a valid time. Use HH:MM.`);
        if (isQuietHour(t))
          throw new BadRequestException(
            'Choose a time between 06:00 and 21:59. Reminders are not sent overnight.',
          );
      }
      const expected =
        dto.frequency === 'ONCE_DAILY'
          ? 1
          : dto.frequency === 'TWICE_DAILY'
            ? 2
            : dto.frequency === 'THREE_TIMES_DAILY'
              ? 3
              : null;
      if (expected !== null && expected !== times.length)
        throw new BadRequestException(
          `That frequency needs exactly ${expected} time${expected === 1 ? '' : 's'}.`,
        );
    }
    const timezone = dto.timezone?.trim() || DEFAULT_TIMEZONE;
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: timezone });
    } catch {
      throw new BadRequestException('That timezone is not recognised.');
    }
    return { times, timezone };
  }

  async configForDebt(debtId: string) {
    const debt = await this.loadDebt(debtId);
    const row = await this.prisma.debtReminder.findUnique({
      where: { debtId },
    });
    const computed = computeDebt(debt as unknown as DebtWithRepayments, todayInLagos());
    return {
      debtId,
      balance: computed.view.balance,
      status: computed.view.status,
      reminder: row
        ? {
            enabled: row.enabled,
            paused: row.paused,
            frequency: row.frequency,
            times: row.times,
            timezone: row.timezone,
            nextRunAt: row.nextRunAt?.toISOString() ?? null,
            lastSentAt: row.lastSentAt?.toISOString() ?? null,
            lastError: row.lastError,
            email: row.email,
          }
        : null,
    };
  }

  /** Enabling reminders on a fully paid debt is refused: there is nothing left to chase. */
  async save(debtId: string, dto: SaveDebtReminderDto) {
    requireRole('OWNER', 'MANAGER');
    const { times, timezone } = this.validate(dto);
    const debt = await this.loadDebt(debtId);
    const computed = computeDebt(debt as unknown as DebtWithRepayments, todayInLagos());
    if (dto.enabled && D(computed.view.balance).lte(0))
      throw new BadRequestException('This debt is fully paid, so there is nothing to remind you about.');
    if (dto.enabled && debt.override && debt.override !== 'DISPUTED')
      throw new BadRequestException('Reminders are off for written-off or cancelled debts.');

    const email = currentUserEmail();
    if (dto.enabled && !email)
      throw new BadRequestException('Your account has no email address to send reminders to.');

    const now = new Date();
    const nextRunAt = dto.enabled ? nextRunAfter(now, times, timezone) : null;
    const row = await this.prisma.debtReminder.upsert({
      where: { debtId },
      create: {
        debtId,
        workspaceId: debt.workspaceId,
        ownerUserId: currentUserId(),
        email: email ?? '',
        enabled: dto.enabled,
        paused: dto.paused ?? false,
        frequency: dto.frequency,
        times,
        timezone,
        nextRunAt,
      },
      update: {
        email: email ?? undefined,
        enabled: dto.enabled,
        paused: dto.paused ?? false,
        frequency: dto.frequency,
        times,
        timezone,
        nextRunAt,
        failureCount: 0,
        lastError: null,
      },
    });
    return {
      enabled: row.enabled,
      paused: row.paused,
      frequency: row.frequency,
      times: row.times,
      timezone: row.timezone,
      nextRunAt: row.nextRunAt?.toISOString() ?? null,
    };
  }

  async setPaused(debtId: string, paused: boolean) {
    requireRole('OWNER', 'MANAGER');
    const debt = await this.loadDebt(debtId);
    const row = await this.prisma.debtReminder.findUnique({ where: { debtId } });
    if (!row) throw new NotFoundException('Automatic reminders are not set up for this debt.');
    const nextRunAt = paused
      ? null
      : nextRunAfter(new Date(), row.times, row.timezone);
    const updated = await this.prisma.debtReminder.update({
      where: { debtId },
      data: { paused, enabled: paused ? row.enabled : true, nextRunAt },
    });
    void debt;
    return { paused: updated.paused, nextRunAt: updated.nextRunAt?.toISOString() ?? null };
  }

  async disable(debtId: string) {
    requireRole('OWNER', 'MANAGER');
    await this.loadDebt(debtId);
    await this.prisma.debtReminder.updateMany({
      where: { debtId },
      data: { enabled: false, paused: false, nextRunAt: null },
    });
    return { enabled: false };
  }

  // ------------------------------------------------------------------ overview

  async overview() {
    const workspaceId = requireBusinessId();
    // A reminder for a debt that has since been settled stops being active immediately, even
    // before the scheduler next runs.
    const rows = await this.prisma.debtReminder.findMany({
      where: { workspaceId },
      include: { debt: { include: { repayments: true } } },
      orderBy: { createdAt: 'desc' },
    });
    const today = todayInLagos();
    const items = rows.map((r) => {
      const computed = computeDebt(r.debt as unknown as DebtWithRepayments, today);
      const live =
        D(computed.view.balance).gt(0) && LIVE_STATUSES.includes(computed.view.status);
      return {
        debtId: r.debtId,
        name: r.debt.counterpartyName,
        description: r.debt.description,
        balance: computed.view.balance,
        status: computed.view.status,
        enabled: r.enabled,
        paused: r.paused,
        active: r.enabled && !r.paused && live,
        frequency: r.frequency,
        times: r.times,
        timezone: r.timezone,
        nextRunAt: r.nextRunAt?.toISOString() ?? null,
        lastSentAt: r.lastSentAt?.toISOString() ?? null,
        lastError: r.lastError,
        email: r.email,
        debtorEmail: r.debt.counterpartyEmail,
      };
    });
    const active = items.filter((i) => i.active);
    const history = await this.prisma.debtReminderDelivery.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    return {
      email: currentUserEmail(),
      schedulerConfigured: Boolean(process.env.CRON_SECRET),
      emailConfigured: this.providers.emailConfigured(),
      emailProvider: this.providers.emailProviderName(),
      totals: {
        enabled: items.filter((i) => i.enabled).length,
        paused: items.filter((i) => i.enabled && i.paused).length,
        active: active.length,
        outstanding: money(
          active.reduce((s, i) => s.plus(D(i.balance)), D(0)),
        ),
        nextRunAt:
          active
            .map((i) => i.nextRunAt)
            .filter((x): x is string => !!x)
            .sort()[0] ?? null,
      },
      items,
      history: history.map((h) => ({
        id: h.id,
        subject: h.subject,
        status: h.status,
        provider: h.provider,
        debtCount: h.debtCount,
        totalOutstanding: money(D(h.totalOutstanding)),
        createdAt: h.createdAt.toISOString(),
        errorCode: h.errorCode,
      })),
    };
  }

  // ------------------------------------------------------------------ sending

  private async ownerName(userId: string, email: string): Promise<string> {
    const profile = await this.prisma.profile.findUnique({ where: { userId } });
    const name = profile?.fullName?.trim();
    if (name) return name.split(/\s+/)[0];
    return email.split('@')[0]?.slice(0, 40) || 'there';
  }

  /**
   * One email per owner per delivery window, containing every debt that is due. Debts are read
   * again here, right before sending, so a payment recorded a minute ago is never chased.
   */
  async dispatchDue(secret: string | undefined, atIso?: string) {
    const expected = process.env.CRON_SECRET;
    if (!expected) throw new NotFoundException();
    const given = Buffer.from(secret ?? '');
    const want = Buffer.from(expected);
    if (given.length !== want.length || !timingSafeEqual(given, want))
      throw new ForbiddenException('Not allowed.');

    // `at` lets an operator (or a test) run a window that has already passed, e.g. after downtime.
    const now = atIso ? new Date(atIso) : new Date();
    if (Number.isNaN(now.getTime()))
      throw new BadRequestException("Use an ISO timestamp for at.");
    const due = (await this.prisma.debtReminder.findMany({
      where: { enabled: true, paused: false, nextRunAt: { lte: now } },
      include: {
        debt: { include: { repayments: true, workspace: { select: { name: true } } } },
      },
      take: 200,
    })) as unknown as ReminderWithDebt[];

    const groups = new Map<string, DeliveryGroup>();
    const today = todayInLagos();
    let skipped = 0;

    for (const r of due) {
      const computed = computeDebt(
        r.debt as unknown as DebtWithRepayments,
        today,
      );
      const live =
        D(computed.view.balance).gt(0) && LIVE_STATUSES.includes(computed.view.status);
      if (!live) {
        // Settled, archived, written off or deleted: stop for good, no email.
        await this.prisma.debtReminder.updateMany({
          where: { id: r.id },
          data: { enabled: false, nextRunAt: null, paused: false },
        });
        skipped++;
        continue;
      }
      const slot = r.nextRunAt ?? now;
      const next = nextRunAfter(now, r.times, r.timezone);
      // Claim atomically: only the run that moves nextRunAt forward may send this window.
      const claimed = await this.prisma.debtReminder.updateMany({
        where: { id: r.id, nextRunAt: slot, enabled: true, paused: false },
        data: { nextRunAt: next },
      });
      if (claimed.count === 0) {
        skipped++;
        continue;
      }
      const key = `${r.workspaceId}|${r.ownerUserId}|${slot.toISOString()}`;
      const g: DeliveryGroup = groups.get(key) ?? {
        workspaceId: r.workspaceId,
        ownerUserId: r.ownerUserId,
        email: r.email,
        businessName: r.debt.workspace.name,
        timezone: r.timezone,
        slot,
        debts: [],
        reminderIds: [],
        debtorCopies: new Map(),
      };
      g.debts.push({
        id: r.debt.id,
        name: r.debt.counterpartyName,
        balance: computed.view.balance,
      });
      g.reminderIds.push(r.id);
      // The address typed on the debt also gets its own copy, never the owner's consolidated one.
      const debtorEmail = r.debt.counterpartyEmail?.trim().toLowerCase();
      if (debtorEmail && r.debt.direction === 'OWED_TO_ME') {
        const copy =
          g.debtorCopies.get(debtorEmail) ??
          ({ debtId: r.debt.id, debts: [] as { description: string; balance: string }[] });
        copy.debts.push({
          description: r.debt.description || r.debt.counterpartyName,
          balance: computed.view.balance,
        });
        g.debtorCopies.set(debtorEmail, copy);
      }
      groups.set(key, g);
    }

    const results: {
      windowKey: string;
      status: string;
      debtCount: number;
      debtorNotified?: number;
    }[] = [];
    for (const [key, g] of groups) {
      const windowKey = `${g.workspaceId}:${g.ownerUserId}:${g.slot.toISOString()}`;
      if (!g.email) {
        results.push({ windowKey, status: 'SKIPPED', debtCount: g.debts.length });
        continue;
      }
      let deliveryId: string | null = null;
      try {
        const created = await this.prisma.debtReminderDelivery.create({
          data: {
            workspaceId: g.workspaceId,
            ownerUserId: g.ownerUserId,
            email: g.email,
            windowKey,
            slot: g.slot,
            debtCount: g.debts.length,
            totalOutstanding: money(
              g.debts.reduce((s, d) => s.plus(D(d.balance)), D(0)),
            ),
            debtIds: g.debts.map((d) => d.id),
            subject: '',
            status: 'SKIPPED',
            provider: 'none',
          },
        });
        deliveryId = created.id;
      } catch (err) {
        // Only a unique-window clash means "already delivered". Anything else is a real failure
        // and must be reported as such, never silently swallowed as a duplicate.
        if ((err as { code?: string }).code === 'P2002') {
          results.push({ windowKey, status: 'DUPLICATE_IGNORED', debtCount: g.debts.length });
          continue;
        }
        this.log.error("Could not record reminder delivery: " + String(err));
        results.push({ windowKey, status: 'FAILED', debtCount: g.debts.length });
        continue;
      }

      const name = await this.ownerName(g.ownerUserId, g.email);
      const total = money(g.debts.reduce((s, d) => s.plus(D(d.balance)), D(0)));
      const content = renderReminderEmail({
        ownerName: name,
        greeting: greetingFor(zoneHour(now, g.timezone)),
        debts: g.debts.map((d) => ({
          name: d.name,
          balance: formatNaira(d.balance),
          url: `${APP_URL()}/debts/${d.id}`,
        })),
        total: formatNaira(total),
        timezone: g.timezone,
        appUrl: APP_URL(),
      });

      const sent = await this.providers.send({
        channel: 'EMAIL',
        to: g.email,
        subject: content.subject,
        text: content.text,
        html: content.html,
      });

      const status = sent.ok ? 'SENT' : sent.skippedReason ? 'SKIPPED' : 'FAILED';
      await this.prisma.$transaction(async (tx) => {
        await tx.debtReminderDelivery.update({
          where: { id: deliveryId! },
          data: {
            status,
            provider: sent.provider,
            providerMessageId: sent.messageId ?? null,
            errorCode: sent.skippedReason ?? sent.errorCode ?? null,
            subject: content.subject,
          },
        });
        await tx.debtReminder.updateMany({
          where: { id: { in: g.reminderIds } },
          data: sent.ok
            ? { lastSentAt: new Date(), lastError: null, failureCount: 0 }
            : {
                lastError: sent.skippedReason ?? sent.errorCode ?? 'send_failed',
                failureCount: { increment: 1 },
              },
        });
        if (!sent.ok) {
          // Back off 15 minutes and retry, but never forever.
          const retryAt = new Date(Date.now() + 15 * 60_000);
          await tx.debtReminder.updateMany({
            where: { id: { in: g.reminderIds }, failureCount: { lt: MAX_FAILURES } },
            data: { nextRunAt: retryAt },
          });
          await tx.debtReminder.updateMany({
            where: { id: { in: g.reminderIds }, failureCount: { gte: MAX_FAILURES } },
            data: { enabled: false, nextRunAt: null, lastError: 'retry_limit_reached' },
          });
        }
        await tx.auditEvent.create({
          data: {
            businessId: g.workspaceId,
            actorUserId: g.ownerUserId,
            action: `REMINDER_EMAIL_${status}`,
            entityType: 'DebtReminderDelivery',
            entityId: deliveryId!,
            summary:
              status === 'SENT'
                ? `Reminder email sent to the account owner (${g.debts.length} debt${g.debts.length === 1 ? '' : 's'})`
                : `Reminder email not sent (${sent.skippedReason ?? sent.errorCode ?? 'failed'})`,
          },
        });
      });
      // Each debtor with an email on the debt receives their own reminder, never anyone else's.
      let debtorNotified = 0;
      for (const [address, copy] of g.debtorCopies) {
        const debtorContent = renderDebtorReminderEmail({
          businessName: g.businessName,
          debts: copy.debts,
          total: formatNaira(money(copy.debts.reduce((s, d) => s.plus(D(d.balance)), D(0)))),
          appUrl: APP_URL(),
        });
        const toDebtor = await this.providers.send({
          channel: 'EMAIL',
          to: address,
          subject: debtorContent.subject,
          text: debtorContent.text,
          html: debtorContent.html,
        });
        if (toDebtor.ok) debtorNotified++;
        // Recorded in the recovery log so the owner can see the debtor was actually told.
        try {
          await this.prisma.notificationLog.create({
            data: {
              workspaceId: g.workspaceId,
              debtId: copy.debtId,
              channel: 'EMAIL',
              provider: toDebtor.provider,
              providerMessageId: toDebtor.messageId ?? null,
              status: toDebtor.ok ? 'SENT' : toDebtor.skippedReason ? 'SKIPPED' : 'FAILED',
              errorCode: toDebtor.skippedReason ?? toDebtor.errorCode ?? null,
            },
          });
        } catch (err) {
          this.log.warn('Could not record the debtor reminder copy: ' + String(err));
        }
      }

      results.push({ windowKey, status, debtCount: g.debts.length, debtorNotified });
    }
    this.log.log(
      `Reminder dispatch: ${results.filter((r) => r.status === 'SENT').length} sent, ${skipped} skipped`,
    );
    return { processed: results.length, skipped, results };
  }

  /** Sends one real email now so the owner can see exactly what will arrive. */
  async sendTest() {
    requireRole('OWNER', 'MANAGER');
    const workspaceId = requireBusinessId();
    const email = currentUserEmail();
    if (!email) throw new BadRequestException('Your account has no email address.');
    const rows = await this.prisma.debtReminder.findMany({
      where: { workspaceId, enabled: true },
      include: { debt: { include: { repayments: true } } },
      take: 50,
    });
    const today = todayInLagos();
    const debts = rows
      .map((r) => {
        const c = computeDebt(r.debt as unknown as DebtWithRepayments, today);
        return D(c.view.balance).gt(0) && LIVE_STATUSES.includes(c.view.status)
          ? { id: r.debtId, name: r.debt.counterpartyName, balance: c.view.balance }
          : null;
      })
      .filter((d): d is { id: string; name: string; balance: string } => !!d);
    if (debts.length === 0)
      throw new BadRequestException(
        'Turn on reminders for at least one unpaid debt first.',
      );
    const total = money(debts.reduce((s, d) => s.plus(D(d.balance)), D(0)));
    const content = renderReminderEmail({
      ownerName: await this.ownerName(currentUserId(), email),
      greeting: greetingFor(zoneHour(new Date(), DEFAULT_TIMEZONE)),
      debts: debts.map((d) => ({
        name: d.name,
        balance: formatNaira(d.balance),
        url: `${APP_URL()}/debts/${d.id}`,
      })),
      total: formatNaira(total),
      timezone: DEFAULT_TIMEZONE,
      appUrl: APP_URL(),
    });
    const sent = await this.providers.send({
      channel: 'EMAIL',
      to: email,
      subject: content.subject,
      text: content.text,
      html: content.html,
    });
    const status = sent.ok ? 'SENT' : sent.skippedReason ? 'SKIPPED' : 'FAILED';
    await this.prisma.debtReminderDelivery.create({
      data: {
        workspaceId,
        ownerUserId: currentUserId(),
        email,
        windowKey: `${workspaceId}:${currentUserId()}:test:${Date.now()}`,
        slot: new Date(),
        debtCount: debts.length,
        totalOutstanding: total,
        debtIds: debts.map((d) => d.id),
        subject: content.subject,
        status,
        provider: sent.provider,
        providerMessageId: sent.messageId ?? null,
        errorCode: sent.skippedReason ?? sent.errorCode ?? null,
      },
    });
    return {
      status,
      provider: sent.provider,
      subject: content.subject,
      to: email,
      reason: sent.skippedReason ?? sent.errorCode ?? null,
      debtCount: debts.length,
      preview: content.text,
    };
  }
}
