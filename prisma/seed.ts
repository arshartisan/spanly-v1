import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { encryptTokens } from "../src/server/crypto";
import { PLATFORM_CONFIG, PLATFORMS } from "../src/lib/platforms";

const prisma = new PrismaClient();

async function main() {
  const email = "demo@spanly.app";
  const passwordHash = await bcrypt.hash("password", 12);

  // Fresh demo user (idempotent: wipe + recreate).
  await prisma.user.deleteMany({ where: { email } });

  const trialEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      displayName: "Demo User",
      timezone: "Asia/Colombo",
      emailVerified: new Date(),
      settings: {
        emailPrefs: { automation: true, failureAlerts: true, summary: true },
        platformPrefs: { filenameAsCaption: false, use24h: false, processVideosServerSide: true },
        weeklyPostingGoal: 5,
      },
      subscription: {
        create: {
          plan: "creator",
          interval: "month",
          status: "trialing",
          trialEndsAt,
        },
      },
      queueSettings: {
        create: {
          timezone: "Asia/Colombo",
          randomizeWithinMinutes: 0,
          slots: {
            create: [
              { time: "11:00", days: [true, true, true, true, true, false, false] },
              { time: "16:00", days: [true, true, true, true, true, false, false] },
            ],
          },
        },
      },
    },
  });

  // One mock SocialAccount per platform (PROVIDER_MODE=mock).
  for (const platform of PLATFORMS) {
    const cfg = PLATFORM_CONFIG[platform];
    const tokens = encryptTokens({
      accessToken: `mock-access-${platform}`,
      refreshToken: `mock-refresh-${platform}`,
      expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
      scopes: ["mock.publish"],
    });

    await prisma.socialAccount.create({
      data: {
        userId: user.id,
        platform,
        handle: `demo_${platform}`,
        displayName: `Demo ${cfg.label}`,
        externalId: `mock-${platform}-1`,
        status: "active",
        capabilities: cfg.capabilities,
        scopes: ["mock.publish"],
        encryptedTokens: tokens,
        tokenExpiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
      },
    });
  }

  const accountCount = await prisma.socialAccount.count({ where: { userId: user.id } });
  console.log(`✅ Seeded ${email} with ${accountCount} mock accounts, a trialing Creator plan, and 2 queue slots.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
