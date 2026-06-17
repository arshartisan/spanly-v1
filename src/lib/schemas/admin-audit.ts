import { z } from "zod";

// Admin audit-log validation (doc 15). Shared by the API route and the admin UI.
// The list query is parsed from URLSearchParams, so every field is optional + coercible.
// Audit rows are append-only - this is the only (read) schema; there is no edit/delete.

// from/to arrive as ISO date strings on the URL; coerce to Date for the pure where-builder.
const isoDate = z
  .string()
  .datetime({ message: "Expected an ISO date string." })
  .transform((v) => new Date(v));

export const auditLogQuerySchema = z.object({
  action: z.string().trim().min(1).optional(),
  actorId: z.string().min(1).optional(),
  actorQuery: z.string().trim().min(1).optional(),
  targetType: z.string().trim().min(1).optional(),
  targetId: z.string().trim().min(1).optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  cursor: z.string().min(1).optional(),
  take: z.coerce.number().int().min(1).max(100).default(50),
});

export type AuditLogQuery = z.infer<typeof auditLogQuerySchema>;
