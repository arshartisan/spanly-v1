import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@/server/auth";

// support.ts imports "server-only" (a Next build alias, not a real module in a plain
// vitest run). Stub it. We mock @/server/db (prisma) so the service runs with no real DB,
// @/server/mailer so broadcast `send` is a spy we assert on (no SMTP), and @/server/auth so
// the impersonation/session helpers (createImpersonationSession/createSession/
// getSessionContext) are spies — letting us test the support service in isolation without
// touching next/headers cookies or a real session row.
vi.mock("server-only", () => ({}));

// ─────────────────────────── Prisma mock ───────────────────────────
const userFindUnique = vi.fn();
const userFindMany = vi.fn();
const userUpdate = vi.fn();
const userDelete = vi.fn();
const sessionDeleteMany = vi.fn();
const apiKeyDeleteMany = vi.fn();
const socialAccountUpdateMany = vi.fn();
const subscriptionDeleteMany = vi.fn();
const refundDeleteMany = vi.fn();
const auditLogDeleteMany = vi.fn();
// $transaction resolves the array of (already-invoked) operation results.
const txn = vi.fn((ops: unknown[]) => Promise.resolve(ops));

vi.mock("@/server/db", () => ({
  prisma: {
    user: {
      findUnique: (a: unknown) => userFindUnique(a),
      findMany: (a: unknown) => userFindMany(a),
      update: (a: unknown) => userUpdate(a),
      delete: (a: unknown) => userDelete(a),
    },
    session: { deleteMany: (a: unknown) => sessionDeleteMany(a) },
    apiKey: { deleteMany: (a: unknown) => apiKeyDeleteMany(a) },
    socialAccount: { updateMany: (a: unknown) => socialAccountUpdateMany(a) },
    subscription: { deleteMany: (a: unknown) => subscriptionDeleteMany(a) },
    refund: { deleteMany: (a: unknown) => refundDeleteMany(a) },
    auditLog: { deleteMany: (a: unknown) => auditLogDeleteMany(a) },
    $transaction: (ops: unknown[]) => txn(ops),
  },
}));

// ─────────────────────────── Mailer mock ───────────────────────────
const mailerSend = vi.fn();
vi.mock("@/server/mailer", () => ({
  mailer: { send: (a: unknown) => mailerSend(a) },
}));

// ─────────────────────────── Auth mock ───────────────────────────
// support.ts reuses the session machinery in auth.ts; mock the three helpers it calls so we
// assert on args without touching next/headers cookies or a real Session row.
const createImpersonationSession = vi.fn();
const createSession = vi.fn();
const getSessionContext = vi.fn();
vi.mock("@/server/auth", () => ({
  createImpersonationSession: (targetId: string, actorId: string) =>
    createImpersonationSession(targetId, actorId),
  createSession: (userId: string) => createSession(userId),
  getSessionContext: () => getSessionContext(),
}));

// Imported after the mocks above are registered.
import {
  startImpersonation,
  stopImpersonation,
  assertNotImpersonating,
  buildAudienceWhere,
  resolveAudience,
  sendBroadcast,
  anonymizeUser,
  deleteUser,
  AdminActionError,
} from "./support";
import { broadcastSchema, gdprActionSchema } from "@/lib/schemas/admin-support";

beforeEach(() => {
  userFindUnique.mockReset();
  userFindMany.mockReset();
  userUpdate.mockReset();
  userDelete.mockReset();
  sessionDeleteMany.mockReset();
  apiKeyDeleteMany.mockReset();
  socialAccountUpdateMany.mockReset();
  subscriptionDeleteMany.mockReset();
  refundDeleteMany.mockReset();
  auditLogDeleteMany.mockReset();
  txn.mockClear();
  mailerSend.mockReset();
  mailerSend.mockResolvedValue(undefined);
  createImpersonationSession.mockReset();
  createImpersonationSession.mockResolvedValue(undefined);
  createSession.mockReset();
  createSession.mockResolvedValue(undefined);
  getSessionContext.mockReset();
});

/** Run `fn`, returning the thrown value (or throwing if it unexpectedly resolves). */
async function catchThrown<T>(fn: () => Promise<T>): Promise<unknown> {
  try {
    await fn();
  } catch (err) {
    return err;
  }
  throw new Error("expected the call to throw, but it resolved");
}

/** Minimal CurrentUser actor — only `.id` is read by the service. */
function actor(id: string): CurrentUser {
  return { id } as CurrentUser;
}

// ═══════════════════════════ startImpersonation (guards) ═══════════════════════════
// Acceptance: a superadmin can impersonate a NON-admin user; cannot impersonate self,
// another superadmin, or any staff member; never mutates the target's email/password.

describe("startImpersonation (adversarial guards)", () => {
  it("self target → AdminActionError(400), never queries or creates a session", async () => {
    const err = await catchThrown(() => startImpersonation(actor("u_admin"), "u_admin"));
    expect(err).toBeInstanceOf(AdminActionError);
    expect((err as AdminActionError).status).toBe(400);
    expect(userFindUnique).not.toHaveBeenCalled();
    expect(createImpersonationSession).not.toHaveBeenCalled();
  });

  it("missing target → AdminActionError(404), no session created", async () => {
    userFindUnique.mockResolvedValue(null);
    const err = await catchThrown(() => startImpersonation(actor("u_admin"), "u_missing"));
    expect((err as AdminActionError).status).toBe(404);
    expect(createImpersonationSession).not.toHaveBeenCalled();
  });

  it("target is a superadmin → AdminActionError(403) (cannot impersonate another superadmin)", async () => {
    userFindUnique.mockResolvedValue({ id: "u_super", role: "superadmin" });
    const err = await catchThrown(() => startImpersonation(actor("u_admin"), "u_super"));
    expect((err as AdminActionError).status).toBe(403);
    expect(createImpersonationSession).not.toHaveBeenCalled();
  });

  it.each(["support", "admin"] as const)(
    "target is staff (%s, roleAtLeast support) → AdminActionError(403)",
    async (role) => {
      userFindUnique.mockResolvedValue({ id: "u_staff", role });
      const err = await catchThrown(() => startImpersonation(actor("u_admin"), "u_staff"));
      expect((err as AdminActionError).status).toBe(403);
      expect(createImpersonationSession).not.toHaveBeenCalled();
    },
  );

  it("valid non-staff target → createImpersonationSession(targetId, actorId); no email/password mutation", async () => {
    userFindUnique.mockResolvedValue({ id: "u_user", role: "user" });

    await startImpersonation(actor("u_admin"), "u_user");

    // Reuses the auth session machinery with the right (target, actor) args.
    expect(createImpersonationSession).toHaveBeenCalledTimes(1);
    expect(createImpersonationSession).toHaveBeenCalledWith("u_user", "u_admin");

    // Guardrail: impersonation never changes the target's password or email.
    expect(userUpdate).not.toHaveBeenCalled();
    expect(userDelete).not.toHaveBeenCalled();

    // The target lookup never selects secret credential fields.
    const sel = userFindUnique.mock.calls[0][0] as { select?: Record<string, unknown> };
    const serialized = JSON.stringify(sel.select ?? {});
    expect(serialized).not.toContain("passwordHash");
    expect(serialized).not.toContain("email");
  });
});

// ═══════════════════════════ stopImpersonation ═══════════════════════════
// Acceptance: "Exit" always returns to the staff identity; start + stop both audited (the
// route audits using this function's return value).

describe("stopImpersonation (restore the staff identity)", () => {
  it("no session context → returns null (route maps to 400), restores nothing", async () => {
    getSessionContext.mockResolvedValue(null);
    const result = await stopImpersonation();
    expect(result).toBeNull();
    expect(sessionDeleteMany).not.toHaveBeenCalled();
    expect(createSession).not.toHaveBeenCalled();
  });

  it("not an impersonation session (impersonatorId null) → returns null, no restore", async () => {
    getSessionContext.mockResolvedValue({
      user: { id: "u_user" },
      impersonatorId: null,
    });
    const result = await stopImpersonation();
    expect(result).toBeNull();
    expect(sessionDeleteMany).not.toHaveBeenCalled();
    expect(createSession).not.toHaveBeenCalled();
  });

  it("impersonating → deletes the impersonation row, restores staff via createSession, returns the span", async () => {
    getSessionContext.mockResolvedValue({
      user: { id: "u_target" },
      impersonatorId: "u_admin",
    });

    const result = await stopImpersonation();

    // Deletes ONLY the impersonation session(s) for this target carrying this impersonator.
    expect(sessionDeleteMany).toHaveBeenCalledTimes(1);
    expect(sessionDeleteMany).toHaveBeenCalledWith({
      where: { userId: "u_target", impersonatorId: "u_admin" },
    });
    // Restore path runs: a fresh normal session for the staff member.
    expect(createSession).toHaveBeenCalledTimes(1);
    expect(createSession).toHaveBeenCalledWith("u_admin");
    // Returns the start→stop span for the route to audit.
    expect(result).toEqual({ impersonatorId: "u_admin", targetId: "u_target" });
  });
});

// ═══════════════════════════ assertNotImpersonating ═══════════════════════════
// Guardrail: destructive billing actions are blocked while impersonating.

describe("assertNotImpersonating (blocks destructive actions while impersonating)", () => {
  it("impersonating → AdminActionError(403)", async () => {
    getSessionContext.mockResolvedValue({ user: { id: "u_t" }, impersonatorId: "u_admin" });
    const err = await catchThrown(() => assertNotImpersonating());
    expect((err as AdminActionError).status).toBe(403);
  });

  it("not impersonating → resolves (no throw)", async () => {
    getSessionContext.mockResolvedValue({ user: { id: "u_t" }, impersonatorId: null });
    await expect(assertNotImpersonating()).resolves.toBeUndefined();
  });

  it("no session at all → resolves (no throw)", async () => {
    getSessionContext.mockResolvedValue(null);
    await expect(assertNotImpersonating()).resolves.toBeUndefined();
  });
});

// ═══════════════════════════ PURE: buildAudienceWhere ═══════════════════════════
// Source of truth for the audience grammar → Prisma.UserWhereInput. Unknown/malformed
// shapes MUST throw (400) — a match-everyone where on bad input would be a broadcast defect.

describe("buildAudienceWhere (pure → Prisma.UserWhereInput)", () => {
  it('"all" → {} (matches everyone, intentionally)', () => {
    expect(buildAudienceWhere("all")).toEqual({});
  });

  it('"trialing" → subscription status trialing', () => {
    expect(buildAudienceWhere("trialing")).toEqual({
      subscription: { is: { status: "trialing" } },
    });
  });

  it('"plan:growth" → subscription plan growth', () => {
    expect(buildAudienceWhere("plan:growth")).toEqual({
      subscription: { is: { plan: "growth" } },
    });
  });

  it('"ids:a,b,c" → { id: { in: [...] } } (trimmed, blanks dropped)', () => {
    expect(buildAudienceWhere("ids:a, b ,c")).toEqual({ id: { in: ["a", "b", "c"] } });
  });

  it('an empty plan key ("plan:") throws 400 — never a match-everyone where', () => {
    const err = (() => {
      try {
        buildAudienceWhere("plan:");
      } catch (e) {
        return e;
      }
    })();
    expect(err).toBeInstanceOf(AdminActionError);
    expect((err as AdminActionError).status).toBe(400);
  });

  it('an empty id list ("ids:") throws 400 — never matches everyone', () => {
    const err = (() => {
      try {
        buildAudienceWhere("ids:");
      } catch (e) {
        return e;
      }
    })();
    expect((err as AdminActionError).status).toBe(400);
  });

  it("an unrecognized audience throws 400 (defence-in-depth past the Zod guard)", () => {
    for (const bad of ["bogus", "", "everyone", "plan", "ids"]) {
      let thrown: unknown;
      try {
        buildAudienceWhere(bad);
      } catch (e) {
        thrown = e;
      }
      expect(thrown).toBeInstanceOf(AdminActionError);
      expect((thrown as AdminActionError).status).toBe(400);
    }
  });

  it("malformed/bogus audiences NEVER resolve to {} (the match-everyone where)", () => {
    for (const bad of ["bogus", "everyone", "trial"]) {
      let where: unknown;
      try {
        where = buildAudienceWhere(bad);
      } catch {
        where = undefined; // threw → good, definitely not {}
      }
      expect(where).not.toEqual({});
    }
  });
});

// ═══════════════════════════ resolveAudience ═══════════════════════════

describe("resolveAudience (where → recipients, id+email only)", () => {
  it("passes buildAudienceWhere output to findMany, selecting only id + email", async () => {
    userFindMany.mockResolvedValue([{ id: "u1", email: "a@x.com" }]);
    const recipients = await resolveAudience("trialing");
    const arg = userFindMany.mock.calls[0][0] as {
      where: unknown;
      select: Record<string, unknown>;
    };
    expect(arg.where).toEqual({ subscription: { is: { status: "trialing" } } });
    expect(arg.select).toEqual({ id: true, email: true });
    expect(recipients).toEqual([{ id: "u1", email: "a@x.com" }]);
  });
});

// ═══════════════════════════ sendBroadcast (mock prisma + mailer) ═══════════════════════════
// Acceptance: audited with audience + recipient count; never leaks addresses in the return.

describe("sendBroadcast (mailer fan-out + recipient count)", () => {
  it("sends once per recipient and returns only the count (no addresses leaked)", async () => {
    userFindMany.mockResolvedValue([
      { id: "u1", email: "a@x.com" },
      { id: "u2", email: "b@x.com" },
      { id: "u3", email: "c@x.com" },
    ]);

    const result = await sendBroadcast(actor("u_admin"), {
      audience: "all",
      subject: "Heads up",
      body: "Publishing degraded.",
    });

    expect(mailerSend).toHaveBeenCalledTimes(3);
    // Each send addresses exactly one recipient with the subject/body.
    expect(mailerSend).toHaveBeenCalledWith({
      to: "a@x.com",
      subject: "Heads up",
      text: "Publishing degraded.",
    });

    // The audit-relevant return is JUST the count — no email addresses.
    expect(result).toEqual({ recipientCount: 3 });
    expect(JSON.stringify(result)).not.toContain("@x.com");
  });

  it("empty audience → 0 sends, recipientCount 0 (no throw)", async () => {
    userFindMany.mockResolvedValue([]);
    const result = await sendBroadcast(actor("u_admin"), {
      audience: "ids:nobody",
      subject: "s",
      body: "b",
    });
    expect(mailerSend).not.toHaveBeenCalled();
    expect(result).toEqual({ recipientCount: 0 });
  });

  it("sends across chunk boundaries (>50 recipients → still one send each)", async () => {
    const recipients = Array.from({ length: 120 }, (_, i) => ({
      id: `u${i}`,
      email: `u${i}@x.com`,
    }));
    userFindMany.mockResolvedValue(recipients);
    const result = await sendBroadcast(actor("u_admin"), {
      audience: "all",
      subject: "s",
      body: "b",
    });
    expect(mailerSend).toHaveBeenCalledTimes(120);
    expect(result).toEqual({ recipientCount: 120 });
  });
});

// ═══════════════════════════ anonymizeUser (mock prisma + $transaction) ═══════════════════════════
// Acceptance: scrub PII + revoke access while PRESERVING audit/financial records; never
// reads/logs encrypted OAuth tokens; cannot anonymize self or a superadmin.

describe("anonymizeUser (PII scrub, access revoke, financial/audit retained)", () => {
  it("self → AdminActionError(400), never loads or transacts", async () => {
    const err = await catchThrown(() => anonymizeUser("u_admin", "u_admin", "gdpr"));
    expect((err as AdminActionError).status).toBe(400);
    expect(userFindUnique).not.toHaveBeenCalled();
    expect(txn).not.toHaveBeenCalled();
  });

  it("superadmin target → AdminActionError(403), no transaction", async () => {
    userFindUnique.mockResolvedValue({ id: "u_super", role: "superadmin", subscription: null });
    const err = await catchThrown(() => anonymizeUser("u_admin", "u_super", "gdpr"));
    expect((err as AdminActionError).status).toBe(403);
    expect(txn).not.toHaveBeenCalled();
  });

  it("missing target → AdminActionError(404)", async () => {
    userFindUnique.mockResolvedValue(null);
    const err = await catchThrown(() => anonymizeUser("u_admin", "u_missing", "gdpr"));
    expect((err as AdminActionError).status).toBe(404);
    expect(txn).not.toHaveBeenCalled();
  });

  it("valid → scrubs PII, suspends, revokes sessions/keys, soft-deletes connections in ONE transaction", async () => {
    userFindUnique.mockResolvedValue({ id: "u_user", role: "user", subscription: null });

    await anonymizeUser("u_admin", "u_user", "erasure request #42");

    // One atomic transaction.
    expect(txn).toHaveBeenCalledTimes(1);

    // user.update: email scrubbed to the @deleted.invalid placeholder, name/avatar nulled, suspended.
    const updArg = userUpdate.mock.calls[0][0] as {
      where: { id: string };
      data: {
        email: string;
        displayName: null;
        avatarUrl: null;
        settings: unknown;
        suspendedAt: Date;
      };
    };
    expect(updArg.where).toEqual({ id: "u_user" });
    expect(updArg.data.email).not.toBe("u_user"); // not the original identifier
    expect(updArg.data.email).toMatch(/@deleted\.invalid$/);
    expect(updArg.data.displayName).toBeNull();
    expect(updArg.data.avatarUrl).toBeNull();
    expect(updArg.data.suspendedAt).toBeInstanceOf(Date);

    // Access revoked: all sessions + api keys deleted.
    expect(sessionDeleteMany).toHaveBeenCalledWith({ where: { userId: "u_user" } });
    expect(apiKeyDeleteMany).toHaveBeenCalledWith({ where: { userId: "u_user" } });

    // Social connections soft-deleted (disconnectedAt + status error), not hard-deleted.
    const saArg = socialAccountUpdateMany.mock.calls[0][0] as {
      where: { userId: string; disconnectedAt: null };
      data: { disconnectedAt: Date; status: string };
    };
    expect(saArg.where.userId).toBe("u_user");
    expect(saArg.data.disconnectedAt).toBeInstanceOf(Date);
    expect(saArg.data.status).toBe("error");
  });

  it("PRESERVES financial + audit records — no deleteMany on subscription/refund/auditLog", async () => {
    userFindUnique.mockResolvedValue({ id: "u_user", role: "user", subscription: null });
    await anonymizeUser("u_admin", "u_user", "gdpr");
    expect(subscriptionDeleteMany).not.toHaveBeenCalled();
    expect(refundDeleteMany).not.toHaveBeenCalled();
    expect(auditLogDeleteMany).not.toHaveBeenCalled();
    // And the user row is updated, never deleted.
    expect(userDelete).not.toHaveBeenCalled();
  });

  it("never reads/selects/logs encryptedTokens (no PII/token leak)", async () => {
    userFindUnique.mockResolvedValue({ id: "u_user", role: "user", subscription: null });
    await anonymizeUser("u_admin", "u_user", "gdpr");

    // The target lookup must not select encrypted tokens.
    const sel = userFindUnique.mock.calls[0][0] as { select?: Record<string, unknown> };
    expect(JSON.stringify(sel.select ?? {})).not.toContain("encryptedTokens");

    // The social-account soft-delete neither selects nor writes token material.
    const saArg = socialAccountUpdateMany.mock.calls[0][0];
    expect(JSON.stringify(saArg)).not.toContain("encryptedTokens");
    expect(JSON.stringify(saArg)).not.toContain("accessToken");
  });

  it("anonymized email is deterministic per user id and differs across users", async () => {
    userFindUnique.mockResolvedValue({ id: "u_a", role: "user", subscription: null });
    await anonymizeUser("u_admin", "u_a", "g");
    const emailA = (userUpdate.mock.calls[0][0] as { data: { email: string } }).data.email;

    userUpdate.mockClear();
    userFindUnique.mockResolvedValue({ id: "u_b", role: "user", subscription: null });
    await anonymizeUser("u_admin", "u_b", "g");
    const emailB = (userUpdate.mock.calls[0][0] as { data: { email: string } }).data.email;

    expect(emailA).not.toBe(emailB);
    expect(emailA).toMatch(/@deleted\.invalid$/);
    expect(emailB).toMatch(/@deleted\.invalid$/);
  });
});

// ═══════════════════════════ deleteUser (mock prisma) ═══════════════════════════
// Acceptance: hard delete blocked until an active paid subscription is canceled; cannot
// delete self or a superadmin.

describe("deleteUser (guards + active-paid-sub block)", () => {
  it("self → AdminActionError(400), never loads or deletes", async () => {
    const err = await catchThrown(() => deleteUser("u_admin", "u_admin", "gdpr"));
    expect((err as AdminActionError).status).toBe(400);
    expect(userFindUnique).not.toHaveBeenCalled();
    expect(userDelete).not.toHaveBeenCalled();
  });

  it("superadmin target → AdminActionError(403), no delete", async () => {
    userFindUnique.mockResolvedValue({ id: "u_super", role: "superadmin", subscription: null });
    const err = await catchThrown(() => deleteUser("u_admin", "u_super", "gdpr"));
    expect((err as AdminActionError).status).toBe(403);
    expect(userDelete).not.toHaveBeenCalled();
  });

  it("missing target → AdminActionError(404)", async () => {
    userFindUnique.mockResolvedValue(null);
    const err = await catchThrown(() => deleteUser("u_admin", "u_missing", "gdpr"));
    expect((err as AdminActionError).status).toBe(404);
    expect(userDelete).not.toHaveBeenCalled();
  });

  it.each(["active", "past_due"] as const)(
    "active paid subscription (%s) → AdminActionError(409), delete blocked",
    async (status) => {
      userFindUnique.mockResolvedValue({
        id: "u_user",
        role: "user",
        subscription: { status },
      });
      const err = await catchThrown(() => deleteUser("u_admin", "u_user", "gdpr"));
      expect((err as AdminActionError).status).toBe(409);
      expect(userDelete).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["canceled", { status: "canceled" } as const],
    ["trialing", { status: "trialing" } as const],
    ["no subscription", null],
  ])("%s → prisma.user.delete is called", async (_label, subscription) => {
    userFindUnique.mockResolvedValue({ id: "u_user", role: "user", subscription });
    userDelete.mockResolvedValue({ id: "u_user" });
    await deleteUser("u_admin", "u_user", "gdpr");
    expect(userDelete).toHaveBeenCalledTimes(1);
    expect(userDelete).toHaveBeenCalledWith({ where: { id: "u_user" } });
  });
});

// ═══════════════════════════ Zod: broadcastSchema ═══════════════════════════

describe("broadcastSchema", () => {
  const valid = { audience: "all", subject: "Hi", body: "There" };

  it("accepts a valid all/trialing/plan/ids audience", () => {
    for (const audience of [
      "all",
      "trialing",
      "plan:creator",
      "plan:growth",
      "plan:pro",
      "ids:u1,u2,u3",
    ]) {
      expect(broadcastSchema.safeParse({ ...valid, audience }).success).toBe(true);
    }
  });

  it("rejects a malformed audience grammar", () => {
    for (const audience of ["", "everyone", "plan:", "ids:", "ids: ,", "trial"]) {
      expect(broadcastSchema.safeParse({ ...valid, audience }).success).toBe(false);
    }
  });

  it("requires a non-empty subject and rejects an over-200-char subject", () => {
    expect(broadcastSchema.safeParse({ ...valid, subject: "" }).success).toBe(false);
    expect(broadcastSchema.safeParse({ ...valid, subject: "   " }).success).toBe(false);
    expect(broadcastSchema.safeParse({ ...valid, subject: "x".repeat(201) }).success).toBe(false);
    expect(broadcastSchema.parse({ ...valid, subject: "x".repeat(200) }).subject.length).toBe(200);
  });

  it("requires a non-empty body and rejects an over-5000-char body", () => {
    expect(broadcastSchema.safeParse({ ...valid, body: "" }).success).toBe(false);
    expect(broadcastSchema.safeParse({ ...valid, body: "   " }).success).toBe(false);
    expect(broadcastSchema.safeParse({ ...valid, body: "x".repeat(5001) }).success).toBe(false);
    expect(broadcastSchema.parse({ ...valid, body: "x".repeat(5000) }).body.length).toBe(5000);
  });

  it("trims subject and body", () => {
    const parsed = broadcastSchema.parse({ ...valid, subject: "  s  ", body: "  b  " });
    expect(parsed.subject).toBe("s");
    expect(parsed.body).toBe("b");
  });
});

// ═══════════════════════════ Zod: gdprActionSchema ═══════════════════════════

describe("gdprActionSchema (typed reason, audited)", () => {
  it("rejects an empty / whitespace-only / missing reason", () => {
    expect(gdprActionSchema.safeParse({ reason: "" }).success).toBe(false);
    expect(gdprActionSchema.safeParse({ reason: "   " }).success).toBe(false);
    expect(gdprActionSchema.safeParse({}).success).toBe(false);
  });

  it("rejects a reason over 500 chars", () => {
    expect(gdprActionSchema.safeParse({ reason: "x".repeat(501) }).success).toBe(false);
    expect(gdprActionSchema.parse({ reason: "x".repeat(500) }).reason.length).toBe(500);
  });

  it("trims a valid reason", () => {
    expect(gdprActionSchema.parse({ reason: "  erasure request  " })).toEqual({
      reason: "erasure request",
    });
  });
});
