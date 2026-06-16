-- AlterEnum
ALTER TYPE "PostStatus" ADD VALUE 'canceled';
ALTER TYPE "PostStatus" ADD VALUE 'removed';

-- AlterEnum
ALTER TYPE "TargetStatus" ADD VALUE 'canceled';

-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "moderatedAt" TIMESTAMP(3),
ADD COLUMN     "moderatedById" TEXT,
ADD COLUMN     "moderationReason" TEXT;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_moderatedById_fkey" FOREIGN KEY ("moderatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
