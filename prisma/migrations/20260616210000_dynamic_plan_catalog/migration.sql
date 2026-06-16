-- Convert the hardcoded PlanKey enum catalog into a dynamic, DB-backed plan catalog.
--
-- Subscription.plan: enum PlanKey -> TEXT, PRESERVING existing values. Prisma's default
-- diff emits DROP COLUMN + ADD COLUMN (data loss); we hand-edit to an in-place
-- SET DATA TYPE TEXT cast so seeded subscriptions on 'creator'/'pro' are kept verbatim.
-- The default is restated as a text literal. No FK on Subscription.plan (app-level integrity).

-- AlterTable: in-place enum -> text, preserving data.
ALTER TABLE "Subscription" ALTER COLUMN "plan" DROP DEFAULT;
ALTER TABLE "Subscription" ALTER COLUMN "plan" SET DATA TYPE TEXT USING "plan"::text;
ALTER TABLE "Subscription" ALTER COLUMN "plan" SET DEFAULT 'creator';

-- DropEnum: the PlanKey type is no longer referenced once the column is TEXT.
DROP TYPE "PlanKey";

-- CreateTable
CREATE TABLE "Plan" (
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tagline" TEXT NOT NULL DEFAULT '',
    "monthly" INTEGER NOT NULL,
    "yearly" INTEGER NOT NULL,
    "accountLimit" INTEGER NOT NULL,
    "features" TEXT[],
    "rank" INTEGER NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "PlatformConfig" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformConfig_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "Plan_active_rank_idx" ON "Plan"("active", "rank");
