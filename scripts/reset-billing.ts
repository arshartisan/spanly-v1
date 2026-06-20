import "dotenv/config";
import { PrismaClient } from "@prisma/client";

/**
 * One-off helper: wipe stale billing state so we can start fresh on Polar.sh (no migration of
 * the old PayPal subscriptions). Deletes every RefundRequest + Subscription row, and any
 * provider webhook-event logs.
 *
 * Run ONCE before flipping BILLING_MODE=live on Polar:  npx tsx scripts/reset-billing.ts
 * Do NOT wire this into deploy - it is destructive and intended for the cutover only.
 */

const prisma = new PrismaClient();

async function main() {
  const refunds = await prisma.refundRequest.deleteMany({});
  const subs = await prisma.subscription.deleteMany({});
  const events = await prisma.webhookEvent.deleteMany({
    where: { source: { in: ["paypal", "polar"] } },
  });

  console.log(
    `Billing reset complete: ${refunds.count} refund requests, ${subs.count} subscriptions, ${events.count} webhook events deleted.`,
  );
}

main()
  .catch((err) => {
    console.error("reset-billing failed:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
