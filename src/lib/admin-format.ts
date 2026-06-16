// Shared formatting helpers for the admin billing surface (doc 17). Money always flows
// through `formatCents` so every staff page renders amounts identically.

/** Minor units (cents) → "$X.XX", grouped. Defaults to USD. */
export function formatCents(cents: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

/** A 0..1 ratio → "X.X%". */
export function formatPercent(ratio: number): string {
  return `${(ratio * 100).toFixed(1)}%`;
}
