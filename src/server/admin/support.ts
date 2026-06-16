import "server-only";
import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { mailer } from "@/server/mailer";
import { roleAtLeast } from "@/server/admin/access";
import { AdminActionError } from "@/server/admin/errors";
import {
  createImpersonationSession,
  createSession,
  getSessionContext,
  type CurrentUser,
} from "@/server/auth";

/**
 * Advanced support powers service (doc 21) — the highest-blast-radius admin actions:
 * impersonation, broadcast email, and GDPR anonymize/delete. Every caller route is
 * `superadmin`-gated and audited (the route does the audit, never this layer — and never
 * with PII/token/secret payloads). Re-exports the shared guard type so routes can map
 * `.status` to an HTTP code, matching the billing/users services.
 */
export { AdminActionError } from "@/server/admin/errors";

// The 30-min impersonation TTL is enforced by `createImpersonationSession` in auth.ts
// (single source of truth); not re-declared here to avoid drift.
const BROADCAST_CHUNK = 50; // send in bounded chunks; structured to allow queueing later

// ─────────────────────────── Impersonation ───────────────────────────

/**
 * Start impersonating `targetId` as `actor` (doc 21). Guards: target must exist (404),
 * cannot impersonate self (400), cannot impersonate any staff member — support/admin/
 * superadmin (403). Creates a NEW short-lived session for the TARGET carrying the
 * impersonator id and swaps the cookie to it; the actor's own staff session row is left
 * intact so `stopImpersonation` can restore it.
 */
export async function startImpersonation(
  actor: CurrentUser,
  targetId: string,
): Promise<void> {
  if (actor.id === targetId) {
    throw new AdminActionError(400, "You cannot impersonate yourself.");
  }
  const target = await prisma.user.findUnique({
    where: { id: targetId },
    select: { id: true, role: true },
  });
  if (!target) throw new AdminActionError(404, "User not found.");
  if (roleAtLeast(target.role, "support")) {
    throw new AdminActionError(403, "Staff accounts cannot be impersonated.");
  }
  await createImpersonationSession(target.id, actor.id);
}

/**
 * Stop the current impersonation (doc 21). Reads the active session via the cookie; if it
 * is an impersonation session, deletes that row and restores the staff identity with a
 * fresh normal session (re-sets the cookie). Returns `{ impersonatorId }` for the route to
 * audit, or null when the caller isn't impersonating (route → 400).
 */
export async function stopImpersonation(): Promise<
  { impersonatorId: string; targetId: string } | null
> {
  const ctx = await getSessionContext();
  if (!ctx || !ctx.impersonatorId) return null;

  const impersonatorId = ctx.impersonatorId;
  const targetId = ctx.user.id;
  // Delete the impersonation session row(s) for this target carrying this impersonator.
  await prisma.session.deleteMany({
    where: { userId: targetId, impersonatorId },
  });
  // Restore the staff identity with a fresh normal session + cookie.
  await createSession(impersonatorId);
  return { impersonatorId, targetId };
}

/**
 * Guardrail helper (doc 21): destructive billing actions are blocked while impersonating.
 * Throws 403 when the current session is an impersonation. Billing routes COULD call this;
 * see the impersonation note in the doc for the (out-of-scope-here) wiring.
 */
export async function assertNotImpersonating(): Promise<void> {
  const ctx = await getSessionContext();
  if (ctx?.impersonatorId) {
    throw new AdminActionError(403, "This action is blocked while impersonating a user.");
  }
}

// ─────────────────────────── Broadcast ───────────────────────────

export interface BroadcastInput {
  audience: string;
  subject: string;
  body: string;
}

/**
 * Pure mapping from the audience grammar to a Prisma `UserWhereInput` — no DB calls, so it
 * is unit-testable in isolation. Grammar: `all` | `trialing` | `plan:<key>` |
 * `ids:<comma ids>`. Unknown shapes throw `AdminActionError(400)` (the Zod schema already
 * guards the route, this is defence-in-depth + the source of truth for tests).
 */
export function buildAudienceWhere(audience: string): Prisma.UserWhereInput {
  if (audience === "all") return {};
  if (audience === "trialing") {
    return { subscription: { is: { status: "trialing" } } };
  }
  if (audience.startsWith("plan:")) {
    const planKey = audience.slice("plan:".length).trim();
    if (!planKey) throw new AdminActionError(400, "Audience plan key is empty.");
    // plan is a PlanKey enum; cast through the where input (validated upstream by Zod).
    return { subscription: { is: { plan: planKey as never } } };
  }
  if (audience.startsWith("ids:")) {
    const ids = audience
      .slice("ids:".length)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (ids.length === 0) throw new AdminActionError(400, "Audience id list is empty.");
    return { id: { in: ids } };
  }
  throw new AdminActionError(400, "Unrecognized audience.");
}

/** Resolve the audience string into the recipient list (id + email). */
export async function resolveAudience(
  audience: string,
): Promise<{ id: string; email: string }[]> {
  return prisma.user.findMany({
    where: buildAudienceWhere(audience),
    select: { id: true, email: true },
  });
}

/**
 * Send a broadcast email to the resolved audience and return the recipient count (doc 21).
 *
 * Send-vs-queue decision (MVP, bounded): we send directly via `mailer.send` in a chunked
 * loop rather than wiring a new BullMQ queue + worker. The dev mailer only logs, so there
 * is no real blocking; the chunk loop keeps it iterable and the shape (resolve → chunk →
 * send) is exactly what a queue producer would do, so this can be moved behind a queue
 * later without changing callers.
 *
 * Email opt-outs: there is no broadcast/marketing opt-out field — `settings.emailPrefs`
 * only covers transactional product notifications (automation/failureAlerts/summary) — so
 * none is honored here. Add a dedicated opt-out flag if broadcasts ever become marketing.
 *
 * The actor and the message body are NOT logged here; the route audits only audience +
 * recipientCount.
 */
export async function sendBroadcast(
  actor: CurrentUser,
  input: BroadcastInput,
): Promise<{ recipientCount: number }> {
  void actor; // recorded by the route's audit log, not stored here
  const recipients = await resolveAudience(input.audience);

  for (let i = 0; i < recipients.length; i += BROADCAST_CHUNK) {
    const chunk = recipients.slice(i, i + BROADCAST_CHUNK);
    await Promise.all(
      chunk.map((r) =>
        mailer.send({ to: r.email, subject: input.subject, text: input.body }),
      ),
    );
  }

  return { recipientCount: recipients.length };
}

// ─────────────────────────── GDPR ───────────────────────────

const ACTIVE_PAID_STATUSES = ["active", "past_due"] as const;

/** Deterministic, unique anonymized placeholder email derived from the user id. */
function anonymizedEmail(userId: string): string {
  const hash = createHash("sha256").update(userId).digest("hex").slice(0, 32);
  return `anonymized+${hash}@deleted.invalid`;
}

/** Load the target for a GDPR action or throw 404. */
async function requireGdprTarget(targetId: string) {
  const target = await prisma.user.findUnique({
    where: { id: targetId },
    select: { id: true, role: true, subscription: { select: { status: true } } },
  });
  if (!target) throw new AdminActionError(404, "User not found.");
  return target;
}

/**
 * Anonymize a user (doc 21, GDPR erasure — preferred over hard delete). Guards: 404 if
 * missing, cannot anonymize self (400) or a superadmin (403). In one transaction: scrub PII
 * (email → hashed placeholder, displayName/avatarUrl null, settings → {}), suspend the
 * account, revoke all sessions + api keys, and soft-delete every social connection
 * (`disconnectedAt` + `status="error"`) — which inertly purges the encrypted OAuth tokens
 * from active use WITHOUT ever reading or logging them. Subscription/refund/audit rows are
 * retained for financial + audit-trail reasons. The reason is audited by the route (no PII).
 */
export async function anonymizeUser(
  actorId: string,
  targetId: string,
  reason: string,
): Promise<void> {
  if (actorId === targetId) {
    throw new AdminActionError(400, "You cannot anonymize your own account.");
  }
  const target = await requireGdprTarget(targetId);
  if (roleAtLeast(target.role, "superadmin")) {
    throw new AdminActionError(403, "A superadmin cannot be anonymized.");
  }
  void reason; // recorded by the route's audit log, not stored on the user

  await prisma.$transaction([
    prisma.user.update({
      where: { id: targetId },
      data: {
        email: anonymizedEmail(targetId),
        displayName: null,
        avatarUrl: null,
        settings: {},
        suspendedAt: new Date(),
      },
    }),
    prisma.session.deleteMany({ where: { userId: targetId } }),
    prisma.apiKey.deleteMany({ where: { userId: targetId } }),
    prisma.socialAccount.updateMany({
      where: { userId: targetId, disconnectedAt: null },
      data: { disconnectedAt: new Date(), status: "error" },
    }),
  ]);
}

/**
 * Hard-delete a user (doc 21 — only when legally required). Guards: 404 if missing, cannot
 * delete self (400) or a superadmin (403), and cannot delete a user with an active paid
 * subscription (`active`/`past_due`) until it is canceled (409). The delete cascades per the
 * Prisma relations. The reason is audited by the route (no PII).
 */
export async function deleteUser(
  actorId: string,
  targetId: string,
  reason: string,
): Promise<void> {
  if (actorId === targetId) {
    throw new AdminActionError(400, "You cannot delete your own account.");
  }
  const target = await requireGdprTarget(targetId);
  if (roleAtLeast(target.role, "superadmin")) {
    throw new AdminActionError(403, "A superadmin cannot be deleted.");
  }
  const status = target.subscription?.status;
  if (status && (ACTIVE_PAID_STATUSES as readonly string[]).includes(status)) {
    throw new AdminActionError(409, "Cancel the active subscription first.");
  }
  void reason; // recorded by the route's audit log, not stored

  await prisma.user.delete({ where: { id: targetId } });
}
