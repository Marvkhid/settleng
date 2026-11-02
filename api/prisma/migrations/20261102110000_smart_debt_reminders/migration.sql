-- Smart Debt Reminders: per-debt schedule that emails the account owner (never the debtor),
-- plus an append-only delivery log used for idempotency and history.
CREATE TYPE "ReminderFrequency" AS ENUM ('ONCE_DAILY', 'TWICE_DAILY', 'THREE_TIMES_DAILY', 'CUSTOM');
CREATE TYPE "SmartDeliveryStatus" AS ENUM ('SENT', 'FAILED', 'SKIPPED');

CREATE TABLE "DebtReminder" (
  "id" TEXT NOT NULL,
  "debtId" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "paused" BOOLEAN NOT NULL DEFAULT false,
  "frequency" "ReminderFrequency" NOT NULL DEFAULT 'THREE_TIMES_DAILY',
  "times" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "timezone" TEXT NOT NULL DEFAULT 'Africa/Lagos',
  "nextRunAt" TIMESTAMP(3),
  "lastSentAt" TIMESTAMP(3),
  "lastError" TEXT,
  "failureCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DebtReminder_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DebtReminder_debtId_key" ON "DebtReminder"("debtId");
CREATE INDEX "DebtReminder_enabled_paused_nextRunAt_idx" ON "DebtReminder"("enabled", "paused", "nextRunAt");
CREATE INDEX "DebtReminder_workspaceId_idx" ON "DebtReminder"("workspaceId");
ALTER TABLE "DebtReminder" ADD CONSTRAINT "DebtReminder_debtId_fkey" FOREIGN KEY ("debtId") REFERENCES "Debt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DebtReminder" ADD CONSTRAINT "DebtReminder_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "DebtReminderDelivery" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "windowKey" TEXT NOT NULL,
  "slot" TIMESTAMP(3) NOT NULL,
  "debtCount" INTEGER NOT NULL,
  "totalOutstanding" DECIMAL(14,2) NOT NULL,
  "debtIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "subject" TEXT NOT NULL,
  "status" "SmartDeliveryStatus" NOT NULL,
  "provider" TEXT NOT NULL,
  "providerMessageId" TEXT,
  "errorCode" TEXT,
  "attempts" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DebtReminderDelivery_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DebtReminderDelivery_windowKey_key" ON "DebtReminderDelivery"("windowKey");
CREATE INDEX "DebtReminderDelivery_workspaceId_createdAt_idx" ON "DebtReminderDelivery"("workspaceId", "createdAt");
