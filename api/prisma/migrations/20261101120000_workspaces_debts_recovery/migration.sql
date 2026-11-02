-- CreateEnum
CREATE TYPE "WorkspaceKind" AS ENUM ('PERSONAL', 'BUSINESS');

-- CreateEnum
CREATE TYPE "MembershipRole" AS ENUM ('OWNER', 'MANAGER', 'STAFF');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('INVITED', 'ACTIVE', 'REMOVED');

-- CreateEnum
CREATE TYPE "DebtDirection" AS ENUM ('OWED_TO_ME', 'I_OWE');

-- CreateEnum
CREATE TYPE "DebtOverride" AS ENUM ('DISPUTED', 'WRITTEN_OFF', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReminderChannel" AS ENUM ('EMAIL', 'WHATSAPP', 'SMS');

-- CreateEnum
CREATE TYPE "ReminderStatus" AS ENUM ('SCHEDULED', 'SENDING', 'SENT', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('SENT', 'FAILED', 'SKIPPED');

-- DropIndex
DROP INDEX "Business_ownerId_key";

-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "kind" "WorkspaceKind" NOT NULL DEFAULT 'BUSINESS';

-- AlterTable
ALTER TABLE "AuditEvent" ADD COLUMN     "actorUserId" TEXT;

-- CreateTable
CREATE TABLE "OrganisationMembership" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT,
    "invitedEmail" TEXT,
    "role" "MembershipRole" NOT NULL DEFAULT 'STAFF',
    "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganisationMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Debt" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "customerId" TEXT,
    "counterpartyName" TEXT NOT NULL,
    "counterpartyPhone" TEXT,
    "counterpartyEmail" TEXT,
    "direction" "DebtDirection" NOT NULL,
    "principal" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "description" TEXT NOT NULL,
    "incurredOn" DATE NOT NULL,
    "dueOn" DATE,
    "terms" TEXT,
    "override" "DebtOverride",
    "assignedToUserId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Debt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DebtRepayment" (
    "id" TEXT NOT NULL,
    "debtId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "paidOn" DATE NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "reference" TEXT,
    "note" TEXT,
    "recordedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DebtRepayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentRequest" (
    "id" TEXT NOT NULL,
    "debtId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "tokenPrefix" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "lastViewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reminder" (
    "id" TEXT NOT NULL,
    "debtId" TEXT NOT NULL,
    "channel" "ReminderChannel" NOT NULL,
    "templateKey" TEXT NOT NULL DEFAULT 'friendly',
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "status" "ReminderStatus" NOT NULL DEFAULT 'SCHEDULED',
    "sentAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Reminder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationLog" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "debtId" TEXT NOT NULL,
    "reminderId" TEXT,
    "channel" "ReminderChannel" NOT NULL,
    "provider" TEXT NOT NULL,
    "providerMessageId" TEXT,
    "status" "NotificationStatus" NOT NULL,
    "errorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecoveryActivity" (
    "id" TEXT NOT NULL,
    "debtId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecoveryActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportingDocument" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "debtId" TEXT,
    "storageKey" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "uploadedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportingDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrganisationMembership_userId_idx" ON "OrganisationMembership"("userId");

-- CreateIndex
CREATE INDEX "OrganisationMembership_invitedEmail_idx" ON "OrganisationMembership"("invitedEmail");

-- CreateIndex
CREATE UNIQUE INDEX "OrganisationMembership_workspaceId_userId_key" ON "OrganisationMembership"("workspaceId", "userId");

-- CreateIndex
CREATE INDEX "Debt_workspaceId_dueOn_idx" ON "Debt"("workspaceId", "dueOn");

-- CreateIndex
CREATE INDEX "Debt_workspaceId_direction_idx" ON "Debt"("workspaceId", "direction");

-- CreateIndex
CREATE INDEX "Debt_workspaceId_assignedToUserId_idx" ON "Debt"("workspaceId", "assignedToUserId");

-- CreateIndex
CREATE INDEX "Debt_customerId_idx" ON "Debt"("customerId");

-- CreateIndex
CREATE INDEX "DebtRepayment_debtId_paidOn_idx" ON "DebtRepayment"("debtId", "paidOn");

-- CreateIndex
CREATE UNIQUE INDEX "DebtRepayment_debtId_reference_key" ON "DebtRepayment"("debtId", "reference");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentRequest_tokenHash_key" ON "PaymentRequest"("tokenHash");

-- CreateIndex
CREATE INDEX "PaymentRequest_debtId_idx" ON "PaymentRequest"("debtId");

-- CreateIndex
CREATE INDEX "Reminder_status_scheduledFor_idx" ON "Reminder"("status", "scheduledFor");

-- CreateIndex
CREATE INDEX "Reminder_debtId_idx" ON "Reminder"("debtId");

-- CreateIndex
CREATE INDEX "NotificationLog_workspaceId_createdAt_idx" ON "NotificationLog"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "NotificationLog_debtId_createdAt_idx" ON "NotificationLog"("debtId", "createdAt");

-- CreateIndex
CREATE INDEX "RecoveryActivity_debtId_createdAt_idx" ON "RecoveryActivity"("debtId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SupportingDocument_storageKey_key" ON "SupportingDocument"("storageKey");

-- CreateIndex
CREATE INDEX "SupportingDocument_workspaceId_idx" ON "SupportingDocument"("workspaceId");

-- CreateIndex
CREATE INDEX "SupportingDocument_debtId_idx" ON "SupportingDocument"("debtId");

-- AddForeignKey
ALTER TABLE "OrganisationMembership" ADD CONSTRAINT "OrganisationMembership_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Debt" ADD CONSTRAINT "Debt_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Debt" ADD CONSTRAINT "Debt_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DebtRepayment" ADD CONSTRAINT "DebtRepayment_debtId_fkey" FOREIGN KEY ("debtId") REFERENCES "Debt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRequest" ADD CONSTRAINT "PaymentRequest_debtId_fkey" FOREIGN KEY ("debtId") REFERENCES "Debt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_debtId_fkey" FOREIGN KEY ("debtId") REFERENCES "Debt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecoveryActivity" ADD CONSTRAINT "RecoveryActivity_debtId_fkey" FOREIGN KEY ("debtId") REFERENCES "Debt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportingDocument" ADD CONSTRAINT "SupportingDocument_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportingDocument" ADD CONSTRAINT "SupportingDocument_debtId_fkey" FOREIGN KEY ("debtId") REFERENCES "Debt"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Backfill: every existing workspace gets an OWNER membership for the user who created it, so no
-- one loses access when tenancy moves from ownership to membership. Deterministic ids keep this
-- idempotent if the statement is ever re-run.
INSERT INTO "OrganisationMembership" ("id", "workspaceId", "userId", "role", "status", "createdAt", "updatedAt")
SELECT 'mem_' || "id", "id", "ownerId", 'OWNER', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Business"
WHERE "ownerId" IS NOT NULL
ON CONFLICT ("workspaceId", "userId") DO NOTHING;
