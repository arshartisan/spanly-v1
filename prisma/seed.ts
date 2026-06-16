import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { encryptTokens } from "../src/server/crypto";
import { PLATFORM_CONFIG, PLATFORMS } from "../src/lib/platforms";
import { isAlwaysLive } from "../src/providers/registry";

// Known feature flags to seed (doc 20). Mirrors KNOWN_FLAGS in src/server/settings/flags.ts
// — kept inline here because that module is `server-only` (unresolvable under the tsx seed).
// Every flag seeds enabled EXCEPT maintenance-mode, which seeds disabled (absent = not in
// maintenance). The runtime store treats a missing row as enabled regardless.
const KNOWN_FLAGS: { key: string; description: string }[] = [
  { key: "signups", description: "Allow new account sign-ups." },
  { key: "publishing", description: "Allow posts to be dispatched to providers." },
  { key: "content-studio", description: "Enable the AI content studio." },
  { key: "bulk", description: "Enable bulk scheduling / CSV import." },
  { key: "api", description: "Enable the public v1 API + MCP surface." },
  { key: "maintenance-mode", description: "Put the customer app into maintenance mode (default off)." },
  ...PLATFORMS.map((p) => ({
    key: `platform.${p}`,
    description: `Allow connecting & publishing to ${p}.`,
  })),
];

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

  // One mock SocialAccount per platform (PROVIDER_MODE=mock). Always-live platforms
  // (e.g. LinkedIn, Instagram) have no mock provider, so a fake account would be unusable —
  // skip them and connect those for real via the OAuth flow.
  for (const platform of PLATFORMS) {
    if (isAlwaysLive(platform)) continue;
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

  // Staff superadmin for the admin dashboard (doc 15). Idempotent: wipe + recreate.
  const adminEmail = "admin@spanly.app";
  const adminPassword = "password";
  await prisma.user.deleteMany({ where: { email: adminEmail } });
  await prisma.user.create({
    data: {
      email: adminEmail,
      passwordHash: await bcrypt.hash(adminPassword, 12),
      displayName: "Spanly Admin",
      timezone: "Asia/Colombo",
      emailVerified: new Date(),
      role: "superadmin",
      subscription: {
        create: { plan: "pro", interval: "month", status: "active" },
      },
    },
  });
  console.log(`✅ Seeded superadmin ${adminEmail} / ${adminPassword} (role: superadmin).`);

  // Feature flags (doc 20). Idempotent upsert per key; only create the row when missing so a
  // re-seed never clobbers an admin's deliberate toggle. maintenance-mode seeds disabled.
  for (const flag of KNOWN_FLAGS) {
    await prisma.featureFlag.upsert({
      where: { key: flag.key },
      create: { key: flag.key, enabled: flag.key !== "maintenance-mode", description: flag.description },
      update: { description: flag.description },
    });
  }
  console.log(`✅ Seeded ${KNOWN_FLAGS.length} feature flags (maintenance-mode disabled).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
