-- AlterTable: schedule-to-cancel flag for Polar's cancel-at-period-end flow.
ALTER TABLE "Subscription" ADD COLUMN "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false;
