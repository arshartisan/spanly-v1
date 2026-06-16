import "server-only";
import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { getCurrentUser, type CurrentUser } from "@/server/auth";

// Server-side role gating for the admin surface (doc 15), mirroring `requirePlan`
// in src/server/plans.ts. The session cookie's presence is gated by middleware;
// the REAL authorization is here — middleware runs on the edge with no DB.

const RANK: Record<Role, number> = { user: 0, support: 1, admin: 2, superadmin: 3 };

/** True if `role` is at least `min` in the staff ordering (user < support < admin < superadmin). */
export function roleAtLeast(role: Role, min: Role): boolean {
  return RANK[role] >= RANK[min];
}

/**
 * For RSC/layouts: returns the staff user, or redirects. No session → /login.
 * Suspended or below `min` → /dashboard (we never reveal the admin surface exists).
 */
export async function requireStaff(min: Role = "support"): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.suspendedAt || !roleAtLeast(user.role, min)) redirect("/dashboard");
  return user;
}

/** Minimal JSON error Response for admin API handlers. */
function jsonError(status: number, error: string): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/**
 * For /api/admin/* handlers: returns the staff user, or THROWS a Response the
 * handler must let propagate (401 no session, 403 wrong role / suspended).
 */
export async function requireRole(min: Role): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw jsonError(401, "Unauthorized.");
  if (user.suspendedAt || !roleAtLeast(user.role, min)) {
    throw jsonError(403, "Forbidden.");
  }
  return user;
}
