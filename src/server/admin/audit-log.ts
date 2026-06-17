import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import type { AuditLogQuery } from "@/lib/schemas/admin-audit";

// Read surface for the append-only admin audit trail (doc 15). The WRITER lives in
// `audit.ts` (`logAdminAction`); this file only reads. Pure `buildAuditWhere` for unit
// tests; `listAuditLogs` runs the cursor-paginated query. The select NEVER reaches into
// the actor's secrets (passwordHash / tokens) - only id/email/displayName.

// ─────────────────────────── Filtering ───────────────────────────

/**
 * Pure mapping from a parsed audit filter to a Prisma `AuditLogWhereInput`. No DB calls -
 * unit-testable in isolation. Combined with AND so every supplied filter narrows.
 *
 * `action` uses case-insensitive `contains` (NOT exact) on purpose: the actions are
 * dotted namespaces ("user.suspend", "user.impersonate.start", …), so a query of "user."
 * matches every user-scoped action - far more useful as a filter than exact match.
 *
 * `actorId` (exact) and `actorQuery` (email/displayName contains via the `actor` relation)
 * are independent; if both are supplied both constraints apply.
 */
export function buildAuditWhere(filter: AuditLogQuery): Prisma.AuditLogWhereInput {
  const where: Prisma.AuditLogWhereInput = {};
  const and: Prisma.AuditLogWhereInput[] = [];

  if (filter.action) {
    and.push({ action: { contains: filter.action, mode: "insensitive" } });
  }

  if (filter.actorId) and.push({ actorId: filter.actorId });

  if (filter.actorQuery) {
    const q = filter.actorQuery;
    and.push({
      actor: {
        is: {
          OR: [
            { email: { contains: q, mode: "insensitive" } },
            { displayName: { contains: q, mode: "insensitive" } },
          ],
        },
      },
    });
  }

  if (filter.targetType) and.push({ targetType: filter.targetType });
  if (filter.targetId) and.push({ targetId: filter.targetId });

  if (filter.from || filter.to) {
    and.push({
      createdAt: {
        ...(filter.from ? { gte: filter.from } : {}),
        ...(filter.to ? { lte: filter.to } : {}),
      },
    });
  }

  if (and.length > 0) where.AND = and;
  return where;
}

// ─────────────────────────── Reads ───────────────────────────

const auditListSelect = {
  id: true,
  action: true,
  targetType: true,
  targetId: true,
  metadata: true,
  ip: true,
  createdAt: true,
  // Only non-secret actor fields - NEVER passwordHash / encryptedTokens / reset tokens.
  actor: { select: { id: true, email: true, displayName: true } },
} satisfies Prisma.AuditLogSelect;

export type AuditLogEntry = Prisma.AuditLogGetPayload<{ select: typeof auditListSelect }>;

export interface AuditLogListResult {
  entries: AuditLogEntry[];
  nextCursor: string | null;
}

/** Cursor-paginated audit log (take+1 lookahead, newest `createdAt` first). */
export async function listAuditLogs(filter: AuditLogQuery): Promise<AuditLogListResult> {
  const where = buildAuditWhere(filter);
  const take = filter.take;

  const rows = await prisma.auditLog.findMany({
    where,
    select: auditListSelect,
    orderBy: { createdAt: "desc" },
    take: take + 1,
    ...(filter.cursor ? { cursor: { id: filter.cursor }, skip: 1 } : {}),
  });

  let nextCursor: string | null = null;
  if (rows.length > take) {
    const next = rows.pop();
    nextCursor = next ? next.id : null;
  }

  return { entries: rows, nextCursor };
}
