import "server-only";

/**
 * Provider-neutral billing configuration (docs/implementation/10).
 *
 * BILLING_MODE gates whether we talk to the real payment provider (Polar, "live") or run an
 * internal stand-in ("mock", the default). Mock mode lets the whole billing flow -
 * checkout → trial → cancel → addon - be built and verified with no Polar account. This
 * module holds only the bits that are provider-agnostic so the mock routes don't have to
 * import from the Polar client.
 */

export type BillingMode = "mock" | "live";

export const BILLING_MODE: BillingMode =
  process.env.BILLING_MODE === "live" ? "live" : "mock";

export function isLiveBilling(): boolean {
  return BILLING_MODE === "live";
}

/** App origin for building absolute redirect URLs (checkout return/cancel, webhooks). */
export function appUrl(path = ""): string {
  const base = process.env.APP_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  return `${base.replace(/\/$/, "")}${path}`;
}
