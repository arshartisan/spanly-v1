import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { issueToken } from "@/server/auth";
import { mailer } from "@/server/mailer";
import { roleAtLeast } from "@/server/admin/access";
import type { UserListQuery } from "@/lib/schemas/admin-users";

// User-management service layer (doc 16). Pure `buildUserWhere` for unit tests; the
// rest run Prisma queries. Reads NEVER select `passwordHash` or `encryptedTokens`.

const RESET_TTL_MS = 60 * 60 * 1000; // 1h, matches /api/auth/forgot (doc 03)

/** Typed guard failure; routes translate `.status` into the HTTP response code. */
export class AdminActionError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "AdminActionError";
    this.status = status;
  }
}

// ─────────────────────────── Filtering ───────────────────────────

/**
 * Pure mapping from a parsed list filter to a Prisma `UserWhereInput`. No DB calls —
 * unit-testable in isolation. `query` matches email/displayName (case-insensitive
 * contains) or an exact id.
 */
export function buildUserWhere(filter: UserListQuery): Prisma.UserWhereInput {
  const where: Prisma.UserWhereInput = {};
  const and: Prisma.UserWhereInput[] = [];

  if (filter.query) {
    const q = filter.query;
    and.push({
      OR: [
        { email: { contains: q, mode: "insensitive" } },
        { displayName: { contains: q, mode: "insensitive" } },
        { id: { equals: q } },
      ],
    });
  }

  if (filter.role) and.push({ role: filter.role });

  if (filter.suspended === "true") and.push({ suspendedAt: { not: null } });
  else if (filter.suspended === "false") and.push({ suspendedAt: null });

  if (filter.verified === "true") and.push({ emailVerified: { not: null } });
  else if (filter.verified === "false") and.push({ emailVerified: null });

  if (filter.plan || filter.status) {
    and.push({
      subscription: {
        is: {
          ...(filter.plan ? { plan: filter.plan } : {}),
          ...(filter.status ? { status: filter.status } : {}),
        },
      },
    });
  }

  if (and.length > 0) where.AND = and;
  return where;
}

// ─────────────────────────── Reads ───────────────────────────

const listSelect = {
  id: true,
  email: true,
  displayName: true,
  avatarUrl: true,
  role: true,
  suspendedAt: true,
  emailVerified: true,
  createdAt: true,
  subscription: {
    select: { plan: true, status: true, interval: true, currentPeriodEnd: true },
  },
  _count: {
    select: {
      accounts: { where: { disconnectedAt: null } },
      posts: true,
    },
  },
} satisfies Prisma.UserSelect;

export type AdminUserListItem = Prisma.UserGetPayload<{ select: typeof listSelect }>;

export interface UserListResult {
  users: AdminUserListItem[];
  nextCursor: string | null;
}

/** Cursor-paginated user list (take+1 lookahead, newest first). */
export async function listUsers(filter: UserListQuery): Promise<UserListResult> {
  const where = buildUserWhere(filter);
  const take = filter.take;

  const rows = await prisma.user.findMany({
    where,
    select: listSelect,
    orderBy: { createdAt: "desc" },
    take: take + 1,
    ...(filter.cursor ? { cursor: { id: filter.cursor }, skip: 1 } : {}),
  });

  let nextCursor: string | null = null;
  if (rows.length > take) {
    const next = rows.pop();
    nextCursor = next ? next.id : null;
  }

  return { users: rows, nextCursor };
}

const detailSelect = {
  id: true,
  email: true,
  displayName: true,
  avatarUrl: true,
  timezone: true,
  emailVerified: true,
  role: true,
  suspendedAt: true,
  createdAt: true,
  updatedAt: true,
  subscription: true,
  accounts: {
    select: {
      id: true,
      platform: true,
      handle: true,
      displayName: true,
      avatarUrl: true,
      status: true,
      tokenExpiresAt: true,
      connectedAt: true,
      disconnectedAt: true,
    },
    orderBy: { connectedAt: "desc" },
  },
  posts: {
    select: {
      id: true,
      type: true,
      status: true,
      mainCaption: true,
      publishAt: true,
      publishedAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  },
  sessions: {
    select: { id: true, expires: true },
    orderBy: { expires: "desc" },
  },
  supportNotes: {
    select: {
      id: true,
      body: true,
      createdAt: true,
      author: { select: { id: true, displayName: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  },
} satisfies Prisma.UserSelect;

export type AdminUserDetail = Prisma.UserGetPayload<{ select: typeof detailSelect }> & {
  auditLogs: Prisma.AuditLogGetPayload<true>[];
};

/** Full user detail for the admin detail page; null if not found. Never leaks tokens. */
export async function getUserDetail(id: string): Promise<AdminUserDetail | null> {
  const user = await prisma.user.findUnique({ where: { id }, select: detailSelect });
  if (!user) return null;

  const auditLogs = await prisma.auditLog.findMany({
    where: { targetType: "user", targetId: id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return { ...user, auditLogs };
}

// ─────────────────────────── Mutations ───────────────────────────

/** Loads the target or throws 404; used by guarded mutations. */
async function requireTarget(targetId: string) {
  const target = await prisma.user.findUnique({
    where: { id: targetId },
    select: { id: true, role: true, email: true, emailVerified: true, suspendedAt: true },
  });
  if (!target) throw new AdminActionError(404, "User not found.");
  return target;
}

export async function suspendUser(actorId: string, targetId: string, reason: string) {
  if (actorId === targetId) {
    throw new AdminActionError(400, "You cannot suspend your own account.");
  }
  const target = await requireTarget(targetId);
  if (roleAtLeast(target.role, "superadmin")) {
    throw new AdminActionError(403, "A superadmin cannot be suspended.");
  }
  void reason; // recorded by the route's audit log, not stored on the user
  return prisma.user.update({
    where: { id: targetId },
    data: { suspendedAt: new Date() },
    select: { id: true, suspendedAt: true },
  });
}

export async function unsuspendUser(actorId: string, targetId: string) {
  await requireTarget(targetId);
  return prisma.user.update({
    where: { id: targetId },
    data: { suspendedAt: null },
    select: { id: true, suspendedAt: true },
  });
}

export async function forceVerifyEmail(targetId: string) {
  const target = await requireTarget(targetId);
  if (target.emailVerified) {
    return { id: target.id, emailVerified: target.emailVerified };
  }
  return prisma.user.update({
    where: { id: targetId },
    data: { emailVerified: new Date() },
    select: { id: true, emailVerified: true },
  });
}

/** Issue a reset token and email it to the target, mirroring /api/auth/forgot. */
export async function sendPasswordResetFor(targetId: string) {
  const target = await requireTarget(targetId);
  const token = await issueToken(target.id, "reset_password", RESET_TTL_MS);
  const resetUrl = `${process.env.APP_URL ?? "http://localhost:3000"}/reset?token=${token}`;
  await mailer.send({
    to: target.email,
    subject: "Reset your Spanly password",
    text: "Use the link below to set a new password. It expires in 1 hour.",
    actionUrl: resetUrl,
  });
  return { id: target.id };
}

/**
 * Admin-safe "sign out all devices": delete the target's Session rows directly.
 * Unlike `destroyAllSessions`, this never touches the acting admin's own cookie.
 */
export async function signOutAllFor(targetId: string) {
  await requireTarget(targetId);
  const { count } = await prisma.session.deleteMany({ where: { userId: targetId } });
  return { id: targetId, sessionsRevoked: count };
}

export interface UpdateUserProfileInput {
  displayName?: string;
  email?: string;
}

export async function updateUserProfile(targetId: string, input: UpdateUserProfileInput) {
  const target = await requireTarget(targetId);

  const data: Prisma.UserUpdateInput = {};
  if (input.displayName !== undefined) data.displayName = input.displayName;

  if (input.email !== undefined) {
    const nextEmail = input.email.toLowerCase();
    if (nextEmail !== target.email) {
      data.email = nextEmail;
      // Email changed by staff → force re-verification so the new address is proven.
      data.emailVerified = null;
    }
  }

  try {
    return await prisma.user.update({
      where: { id: targetId },
      data,
      select: { id: true, email: true, displayName: true, emailVerified: true },
    });
  } catch (err) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: unknown }).code === "P2002"
    ) {
      throw new AdminActionError(409, "That email is already in use.");
    }
    throw err;
  }
}

export async function addSupportNote(authorId: string, userId: string, body: string) {
  await requireTarget(userId);
  return prisma.supportNote.create({
    data: { authorId, userId, body },
    select: {
      id: true,
      body: true,
      createdAt: true,
      author: { select: { id: true, displayName: true, email: true } },
    },
  });
}
