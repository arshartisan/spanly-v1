import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";

// Append-only admin audit trail (doc 15). Every mutating /api/admin/* handler calls
// this after a successful change. Reads are not logged (except impersonation start).
// NEVER pass secrets, tokens, or password hashes in `metadata`.

export interface LogAdminActionInput {
  actorId: string;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: Prisma.InputJsonValue;
  ip?: string;
}

export async function logAdminAction(input: LogAdminActionInput): Promise<void> {
  await prisma.auditLog.create({
    data: {
      actorId: input.actorId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      metadata: input.metadata ?? {},
      ip: input.ip,
    },
  });
}
