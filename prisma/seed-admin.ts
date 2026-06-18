import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { PLATFORMS } from "../src/lib/platforms";

// Minimal seed: ONE superadmin user + the non-user catalog the app needs to render (feature
// flags, plan catalog, platform config). NO demo customer / mock social accounts — so signup,
// login OTP, and email flows can be tested against a clean user table. Run after a DB reset:
//   npx prisma migrate reset --force --skip-seed --skip-generate
//   npx tsx prisma/seed-admin.ts

const KNOWN_FLAGS: { key: string; description: string }[] = [
  { key: "signups", description: "Allow new account sign-ups." },
  { key: "publishing", description: "Allow posts to be dispatched to providers." },
  { key: "content-studio", description: "Enable the AI content studio." },
  { key: "bulk", description: "Enable bulk scheduling / CSV import." },
  { key: "api", description: "Enable the public v1 API + MCP surface." },
  { key: "maintenance-mode", description: "Put the customer app into maintenance mode (default off)." },
  ...PLATFORMS.map((p) => ({ key: `platform.${p}`, description: `Allow connecting & publishing to ${p}.` })),
];

const DEFAULT_PLANS = [
  { key: "creator", name: "Creator", tagline: "Best for growing creators", monthly: 29, yearly: 319, accountLimit: 15, rank: 0, features: ["Unlimited posts", "Schedule & queue", "Carousels", "Bulk tools", "Content studio", "Analytics (beta)", "API add-on available", "Human support"] },
  { key: "growth", name: "Growth", tagline: "Best for growing teams & agencies", monthly: 49, yearly: 529, accountLimit: 50, rank: 1, features: ["Everything in Creator", "Viral content tools", "Priority support"] },
  { key: "pro", name: "Pro", tagline: "Best for scaling brands", monthly: 99, yearly: 1069, accountLimit: -1, rank: 2, features: ["Everything in Growth", "Unlimited connected accounts", "Viral consulting", "Invite team members (later)"] },
];

const DEFAULT_CONFIG: { key: string; value: number | boolean }[] = [
  { key: "trialDays", value: 7 },
  { key: "refundWindowDays", value: 7 },
  { key: "signupsDefault", value: true },
];

const prisma = new PrismaClient();

async function main() {
  const adminEmail = "admin@spanly.app";
  const adminPassword = "password";
  await prisma.user.deleteMany({ where: { email: adminEmail } });
  await prisma.user.create({
    data: {
      email: adminEmail,
      passwordHash: await bcrypt.hash(adminPassword, 12),
      displayName: "Spanlyfy Admin",
      timezone: "Asia/Colombo",
      emailVerified: new Date(),
      role: "superadmin",
      subscription: { create: { plan: "pro", interval: "month", status: "active" } },
    },
  });
  console.log(`✅ Seeded superadmin ${adminEmail} / ${adminPassword} (role: superadmin).`);

  for (const flag of KNOWN_FLAGS) {
    await prisma.featureFlag.upsert({
      where: { key: flag.key },
      create: { key: flag.key, enabled: flag.key !== "maintenance-mode", description: flag.description },
      update: { description: flag.description },
    });
  }
  console.log(`✅ Seeded ${KNOWN_FLAGS.length} feature flags (maintenance-mode disabled).`);

  for (const plan of DEFAULT_PLANS) {
    await prisma.plan.upsert({
      where: { key: plan.key },
      create: { ...plan, isPublic: true, active: true },
      update: { name: plan.name, tagline: plan.tagline, monthly: plan.monthly, yearly: plan.yearly, accountLimit: plan.accountLimit, rank: plan.rank, features: plan.features },
    });
  }
  console.log(`✅ Seeded ${DEFAULT_PLANS.length} plans.`);

  for (const cfg of DEFAULT_CONFIG) {
    await prisma.platformConfig.upsert({ where: { key: cfg.key }, create: { key: cfg.key, value: cfg.value }, update: {} });
  }
  console.log(`✅ Seeded ${DEFAULT_CONFIG.length} platform defaults.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
