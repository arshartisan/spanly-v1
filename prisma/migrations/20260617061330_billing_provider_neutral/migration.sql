/*
  Warnings:

  - You are about to drop the column `stripeRefundId` on the `RefundRequest` table. All the data in the column will be lost.
  - You are about to drop the column `stripeCustomerId` on the `Subscription` table. All the data in the column will be lost.
  - You are about to drop the column `stripeSubId` on the `Subscription` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "RefundRequest" DROP COLUMN "stripeRefundId",
ADD COLUMN     "providerRefundId" TEXT;

-- AlterTable
ALTER TABLE "Subscription" DROP COLUMN "stripeCustomerId",
DROP COLUMN "stripeSubId",
ADD COLUMN     "providerAddonSubId" TEXT,
ADD COLUMN     "providerCustomerId" TEXT,
ADD COLUMN     "providerSubId" TEXT;
