-- DropIndex
DROP INDEX "LoginOtp_userId_createdAt_idx";

-- AlterTable
ALTER TABLE "LoginOtp" ADD COLUMN     "purpose" TEXT NOT NULL DEFAULT 'login';

-- CreateIndex
CREATE INDEX "LoginOtp_userId_purpose_createdAt_idx" ON "LoginOtp"("userId", "purpose", "createdAt");
