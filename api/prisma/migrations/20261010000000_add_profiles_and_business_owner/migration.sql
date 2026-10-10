-- Multi-tenancy: every business is owned by exactly one Supabase user, and each user has a profile.
-- Existing rows (from the old demo) get a placeholder owner; in a fresh production database there are
-- none. The API always resolves the owner from the verified JWT, never from client input.

-- AlterTable: Business gains an owner (unique, indexed).
ALTER TABLE "Business" ADD COLUMN "ownerId" TEXT;

-- Backfill any pre-existing businesses so the NOT NULL / UNIQUE constraints hold. The placeholder can
-- never match a real Supabase user id, so these rows are unreachable through the authenticated API.
UPDATE "Business" SET "ownerId" = 'legacy-' || "id" WHERE "ownerId" IS NULL;

-- Now enforce that every business has exactly one owner.
ALTER TABLE "Business" ALTER COLUMN "ownerId" SET NOT NULL;

-- CreateTable
CREATE TABLE "Profile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Business_ownerId_key" ON "Business"("ownerId");

-- CreateIndex
CREATE INDEX "Business_ownerId_idx" ON "Business"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "Profile_userId_key" ON "Profile"("userId");

-- CreateIndex
CREATE INDEX "Profile_userId_idx" ON "Profile"("userId");
