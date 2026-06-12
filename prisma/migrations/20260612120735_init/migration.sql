-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('facebook', 'instagram', 'linkedin', 'tiktok', 'youtube', 'x');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('active', 'expired', 'error');

-- CreateEnum
CREATE TYPE "PostType" AS ENUM ('text', 'image', 'video', 'story');

-- CreateEnum
CREATE TYPE "PostStatus" AS ENUM ('draft', 'scheduled', 'publishing', 'posted', 'failed');

-- CreateEnum
CREATE TYPE "ScheduleMode" AS ENUM ('now', 'time', 'queue');

-- CreateEnum
CREATE TYPE "TargetStatus" AS ENUM ('pending', 'publishing', 'success', 'failed');

-- CreateEnum
CREATE TYPE "MediaKind" AS ENUM ('image', 'video', 'pdf');

-- CreateEnum
CREATE TYPE "PlanKey" AS ENUM ('creator', 'growth', 'pro');

-- CreateEnum
CREATE TYPE "BillingInterval" AS ENUM ('month', 'year');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('trialing', 'active', 'past_due', 'paused', 'canceled');

-- CreateEnum
CREATE TYPE "IgConnectMethod" AS ENUM ('instagram', 'facebook');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT,
    "avatarUrl" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "emailVerified" TIMESTAMP(3),
    "settings" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "plan" "PlanKey" NOT NULL DEFAULT 'creator',
    "interval" "BillingInterval" NOT NULL DEFAULT 'month',
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'trialing',
    "trialEndsAt" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "apiAddonActive" BOOLEAN NOT NULL DEFAULT false,
    "stripeCustomerId" TEXT,
    "stripeSubId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "handle" TEXT NOT NULL,
    "displayName" TEXT,
    "avatarUrl" TEXT,
    "externalId" TEXT NOT NULL,
    "pageId" TEXT,
    "igConnectMethod" "IgConnectMethod",
    "status" "AccountStatus" NOT NULL DEFAULT 'active',
    "capabilities" TEXT[],
    "scopes" TEXT[],
    "encryptedTokens" TEXT NOT NULL,
    "tokenExpiresAt" TIMESTAMP(3),
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "disconnectedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Post" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "PostType" NOT NULL,
    "mainCaption" TEXT NOT NULL DEFAULT '',
    "perPlatform" JSONB NOT NULL DEFAULT '{}',
    "status" "PostStatus" NOT NULL DEFAULT 'draft',
    "scheduleMode" "ScheduleMode" NOT NULL DEFAULT 'now',
    "publishAt" TIMESTAMP(3),
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostTarget" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "socialAccountId" TEXT NOT NULL,
    "status" "TargetStatus" NOT NULL DEFAULT 'pending',
    "caption" TEXT NOT NULL,
    "externalPostId" TEXT,
    "externalUrl" TEXT,
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "idempotencyKey" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "PostTarget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Media" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "MediaKind" NOT NULL,
    "url" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "durationSec" DOUBLE PRECISION,
    "sizeBytes" INTEGER,
    "mimeType" TEXT,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostMedia" (
    "postId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "PostMedia_pkey" PRIMARY KEY ("postId","mediaId")
);

-- CreateTable
CREATE TABLE "QueueSettings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "randomizeWithinMinutes" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "QueueSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QueueSlot" (
    "id" TEXT NOT NULL,
    "settingsId" TEXT NOT NULL,
    "time" TEXT NOT NULL,
    "days" BOOLEAN[],

    CONSTRAINT "QueueSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerificationToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_userId_key" ON "Subscription"("userId");

-- CreateIndex
CREATE INDEX "SocialAccount_userId_platform_idx" ON "SocialAccount"("userId", "platform");

-- CreateIndex
CREATE UNIQUE INDEX "SocialAccount_userId_platform_externalId_key" ON "SocialAccount"("userId", "platform", "externalId");

-- CreateIndex
CREATE INDEX "Post_userId_status_idx" ON "Post"("userId", "status");

-- CreateIndex
CREATE INDEX "Post_status_publishAt_idx" ON "Post"("status", "publishAt");

-- CreateIndex
CREATE UNIQUE INDEX "PostTarget_idempotencyKey_key" ON "PostTarget"("idempotencyKey");

-- CreateIndex
CREATE INDEX "PostTarget_postId_idx" ON "PostTarget"("postId");

-- CreateIndex
CREATE INDEX "PostTarget_status_idx" ON "PostTarget"("status");

-- CreateIndex
CREATE INDEX "Media_userId_idx" ON "Media"("userId");

-- CreateIndex
CREATE INDEX "PostMedia_postId_idx" ON "PostMedia"("postId");

-- CreateIndex
CREATE UNIQUE INDEX "QueueSettings_userId_key" ON "QueueSettings"("userId");

-- CreateIndex
CREATE INDEX "QueueSlot_settingsId_idx" ON "QueueSlot"("settingsId");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE INDEX "VerificationToken_userId_type_idx" ON "VerificationToken"("userId", "type");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialAccount" ADD CONSTRAINT "SocialAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostTarget" ADD CONSTRAINT "PostTarget_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostTarget" ADD CONSTRAINT "PostTarget_socialAccountId_fkey" FOREIGN KEY ("socialAccountId") REFERENCES "SocialAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Media" ADD CONSTRAINT "Media_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostMedia" ADD CONSTRAINT "PostMedia_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostMedia" ADD CONSTRAINT "PostMedia_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QueueSettings" ADD CONSTRAINT "QueueSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QueueSlot" ADD CONSTRAINT "QueueSlot_settingsId_fkey" FOREIGN KEY ("settingsId") REFERENCES "QueueSettings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
