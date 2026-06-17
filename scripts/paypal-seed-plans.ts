import "dotenv/config";
import { randomUUID } from "node:crypto";

/**
 * One-off helper: create the PayPal product + billing plans for Spanlyfy's catalog and print the
 * env lines to paste into `.env` (docs/implementation/10, "Phase 0").
 *
 * Run:  npx tsx scripts/paypal-seed-plans.ts
 * Needs PAYPAL_ENV / PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET in .env (sandbox by default).
 *
 * Each tier plan has a 7-day $0 TRIAL cycle followed by the recurring price. The API add-on is
 * a standalone $5/mo plan with no trial. Re-running creates fresh plans (PayPal plan creation
 * isn't idempotent) — just use the IDs from the latest run.
 *
 * Catalog prices are duplicated here to keep the script self-contained; keep in sync with
 * src/lib/plan-defaults.ts if you change pricing.
 */

const TRIAL_DAYS = 7;
const CURRENCY = "USD";

const TIERS = [
  { key: "CREATOR", name: "Creator", monthly: 29, yearly: 319 },
  { key: "GROWTH", name: "Growth", monthly: 49, yearly: 529 },
  { key: "PRO", name: "Pro", monthly: 99, yearly: 1069 },
] as const;

const ADDON = { name: "API Access Add-on", monthly: 5 };

function base(): string {
  return process.env.PAYPAL_ENV === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

async function token(): Promise<string> {
  const id = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!id || !secret) {
    throw new Error("Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET in .env first.");
  }
  const basic = Buffer.from(`${id}:${secret}`).toString("base64");
  const res = await fetch(`${base()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`Token failed (${res.status}): ${await res.text()}`);
  return ((await res.json()) as { access_token: string }).access_token;
}

async function api<T>(path: string, accessToken: string, body: unknown): Promise<T> {
  const res = await fetch(`${base()}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "PayPal-Request-Id": randomUUID(),
      Prefer: "return=representation",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${path} failed (${res.status}): ${await res.text()}`);
  return (await res.json()) as T;
}

/** A monthly/yearly recurring cycle (sequence 2), optionally preceded by a 7-day trial. */
function billingCycles(intervalUnit: "MONTH" | "YEAR", price: number, withTrial: boolean) {
  const cycles: unknown[] = [];
  let seq = 1;
  if (withTrial) {
    cycles.push({
      frequency: { interval_unit: "DAY", interval_count: TRIAL_DAYS },
      tenure_type: "TRIAL",
      sequence: seq++,
      total_cycles: 1,
      pricing_scheme: { fixed_price: { value: "0", currency_code: CURRENCY } },
    });
  }
  cycles.push({
    frequency: { interval_unit: intervalUnit, interval_count: 1 },
    tenure_type: "REGULAR",
    sequence: seq,
    total_cycles: 0, // 0 = until cancelled
    pricing_scheme: { fixed_price: { value: String(price), currency_code: CURRENCY } },
  });
  return cycles;
}

async function createPlan(
  accessToken: string,
  productId: string,
  name: string,
  intervalUnit: "MONTH" | "YEAR",
  price: number,
  withTrial: boolean,
): Promise<string> {
  const plan = await api<{ id: string }>("/v1/billing/plans", accessToken, {
    product_id: productId,
    name,
    status: "ACTIVE",
    billing_cycles: billingCycles(intervalUnit, price, withTrial),
    payment_preferences: {
      auto_bill_outstanding: true,
      setup_fee: { value: "0", currency_code: CURRENCY },
      setup_fee_failure_action: "CONTINUE",
      payment_failure_threshold: 3,
    },
  });
  return plan.id;
}

async function main() {
  const accessToken = await token();
  console.log(`Creating product + plans in ${base()} …\n`);

  const product = await api<{ id: string }>("/v1/catalogs/products", accessToken, {
    name: "Spanlyfy",
    description: "Spanlyfy social scheduling subscription",
    type: "SERVICE",
    category: "SOFTWARE",
  });
  console.log(`Product: ${product.id}\n`);

  const out: string[] = [];
  for (const tier of TIERS) {
    const monthId = await createPlan(
      accessToken,
      product.id,
      `Spanlyfy ${tier.name} (Monthly)`,
      "MONTH",
      tier.monthly,
      true,
    );
    out.push(`PAYPAL_PLAN_${tier.key}_MONTH="${monthId}"`);
    console.log(`  ${tier.name} monthly → ${monthId}`);

    const yearId = await createPlan(
      accessToken,
      product.id,
      `Spanlyfy ${tier.name} (Yearly)`,
      "YEAR",
      tier.yearly,
      true,
    );
    out.push(`PAYPAL_PLAN_${tier.key}_YEAR="${yearId}"`);
    console.log(`  ${tier.name} yearly  → ${yearId}`);
  }

  const addonId = await createPlan(
    accessToken,
    product.id,
    ADDON.name,
    "MONTH",
    ADDON.monthly,
    false, // add-on has no trial
  );
  out.push(`PAYPAL_PLAN_API_ADDON="${addonId}"`);
  console.log(`  API add-on monthly → ${addonId}`);

  console.log("\n── Paste these into .env ──────────────────────────────\n");
  console.log(out.join("\n"));
  console.log("\nThen set BILLING_MODE=\"live\" and restart the dev server + worker.");
}

main().catch((err) => {
  console.error("\nFailed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
