import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Role } from "@prisma/client";
import type { CurrentUser } from "@/server/auth";

// access.ts pulls in `server-only` (Next supplies this alias at build time; it
// isn't a real installable module in a plain node/vitest run) and
// `next/navigation` (whose real `redirect` throws in an RSC). We stub both, and
// mock `@/server/auth` so we can drive `getCurrentUser` per-test.
vi.mock("server-only", () => ({}));

const redirect = vi.fn((_path: string): never => {
  // The real next/navigation redirect throws a special NEXT_REDIRECT error to
  // abort rendering. We mimic "control never returns" so callers downstream of
  // a redirect() don't keep executing - the throw is caught in each test.
  throw new Error(`NEXT_REDIRECT:${_path}`);
});
vi.mock("next/navigation", () => ({
  redirect: (path: string) => redirect(path),
}));

const getCurrentUser = vi.fn<() => Promise<CurrentUser | null>>();
vi.mock("@/server/auth", () => ({
  getCurrentUser: () => getCurrentUser(),
}));

// Imported after the mocks above are registered.
import { roleAtLeast, requireRole, requireStaff } from "./access";

const ROLES: Role[] = ["user", "support", "admin", "superadmin"];

/** Minimal typed fake user - only role/suspendedAt matter to the unit. */
function makeUser(role: Role, opts: { suspendedAt?: Date | null } = {}): CurrentUser {
  return {
    id: `u_${role}`,
    email: `${role}@example.com`,
    role,
    suspendedAt: opts.suspendedAt ?? null,
    subscription: null,
  } as unknown as CurrentUser;
}

beforeEach(() => {
  getCurrentUser.mockReset();
  redirect.mockClear();
});

describe("roleAtLeast (pure rank ordering)", () => {
  it("ranks user < support < admin < superadmin", () => {
    // Every role is >= itself and every lower role, and < every higher role.
    for (let i = 0; i < ROLES.length; i++) {
      for (let j = 0; j < ROLES.length; j++) {
        const role = ROLES[i];
        const min = ROLES[j];
        // i = rank of `role`, j = rank of `min`. role meets min iff i >= j.
        expect(roleAtLeast(role, min)).toBe(i >= j);
      }
    }
  });

  it("matches the spot-check cases from the doc", () => {
    expect(roleAtLeast("support", "admin")).toBe(false);
    expect(roleAtLeast("admin", "support")).toBe(true);
    expect(roleAtLeast("user", "support")).toBe(false);
    expect(roleAtLeast("support", "support")).toBe(true);
  });

  it("superadmin satisfies every minimum", () => {
    for (const min of ROLES) {
      expect(roleAtLeast("superadmin", min)).toBe(true);
    }
  });

  it("user satisfies only the `user` minimum", () => {
    expect(roleAtLeast("user", "user")).toBe(true);
    expect(roleAtLeast("user", "support")).toBe(false);
    expect(roleAtLeast("user", "admin")).toBe(false);
    expect(roleAtLeast("user", "superadmin")).toBe(false);
  });
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

describe("requireRole (API gate - throws Response on deny)", () => {
  it("throws a 401 Response when there is no session", async () => {
    getCurrentUser.mockResolvedValue(null);
    const err = await catchThrown(() => requireRole("support"));
    expect(err).toBeInstanceOf(Response);
    expect((err as Response).status).toBe(401);
    expect(await (err as Response).json()).toEqual({ error: "Unauthorized." });
  });

  it("throws a 403 when a support user requests admin", async () => {
    getCurrentUser.mockResolvedValue(makeUser("support"));
    const err = await catchThrown(() => requireRole("admin"));
    expect(err).toBeInstanceOf(Response);
    expect((err as Response).status).toBe(403);
    expect(await (err as Response).json()).toEqual({ error: "Forbidden." });
  });

  it("throws a 403 for a suspended staff user even when the role is high enough", async () => {
    getCurrentUser.mockResolvedValue(makeUser("admin", { suspendedAt: new Date() }));
    const err = await catchThrown(() => requireRole("admin"));
    expect(err).toBeInstanceOf(Response);
    expect((err as Response).status).toBe(403);
  });

  it("returns the user when an admin requests admin or support", async () => {
    const admin = makeUser("admin");
    getCurrentUser.mockResolvedValue(admin);
    await expect(requireRole("admin")).resolves.toBe(admin);

    getCurrentUser.mockResolvedValue(admin);
    await expect(requireRole("support")).resolves.toBe(admin);
  });

  it("lets a superadmin pass every level", async () => {
    for (const min of ROLES) {
      const su = makeUser("superadmin");
      getCurrentUser.mockResolvedValue(su);
      await expect(requireRole(min)).resolves.toBe(su);
    }
  });

  it("denies a support user requesting support is allowed but requesting admin is not", async () => {
    const support = makeUser("support");
    getCurrentUser.mockResolvedValue(support);
    await expect(requireRole("support")).resolves.toBe(support);

    getCurrentUser.mockResolvedValue(support);
    const err = await catchThrown(() => requireRole("admin"));
    expect((err as Response).status).toBe(403);
  });
});

describe("requireStaff (RSC gate - redirects on deny)", () => {
  it("redirects to /login when there is no user", async () => {
    getCurrentUser.mockResolvedValue(null);
    await catchThrown(() => requireStaff());
    expect(redirect).toHaveBeenCalledWith("/login");
    expect(redirect).toHaveBeenCalledTimes(1);
  });

  it("redirects a plain user to /dashboard (never reveals admin exists)", async () => {
    getCurrentUser.mockResolvedValue(makeUser("user"));
    await catchThrown(() => requireStaff());
    expect(redirect).toHaveBeenCalledWith("/dashboard");
  });

  it("redirects a suspended staff user to /dashboard", async () => {
    getCurrentUser.mockResolvedValue(makeUser("support", { suspendedAt: new Date() }));
    await catchThrown(() => requireStaff());
    expect(redirect).toHaveBeenCalledWith("/dashboard");
  });

  it("redirects a support user away from an admin-min surface", async () => {
    getCurrentUser.mockResolvedValue(makeUser("support"));
    await catchThrown(() => requireStaff("admin"));
    expect(redirect).toHaveBeenCalledWith("/dashboard");
  });

  it("returns the user and does NOT redirect for a valid support+ user", async () => {
    const support = makeUser("support");
    getCurrentUser.mockResolvedValue(support);
    await expect(requireStaff()).resolves.toBe(support);
    expect(redirect).not.toHaveBeenCalled();
  });

  it("returns a superadmin and does NOT redirect", async () => {
    const su = makeUser("superadmin");
    getCurrentUser.mockResolvedValue(su);
    await expect(requireStaff("admin")).resolves.toBe(su);
    expect(redirect).not.toHaveBeenCalled();
  });
});
