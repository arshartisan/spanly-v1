import { z } from "zod";
import { Platform, PostStatus, AccountStatus } from "@prisma/client";

// Admin content & connections validation (doc 18). Shared by API routes and the admin UI.
// The list queries are parsed from URLSearchParams, so every field is optional + coercible.

// from/to arrive as ISO date strings on the URL; coerce to Date for the pure where-builder.
const isoDate = z
  .string()
  .datetime({ message: "Expected an ISO date string." })
  .transform((v) => new Date(v));

export const postListQuerySchema = z.object({
  status: z.nativeEnum(PostStatus).optional(),
  platform: z.nativeEnum(Platform).optional(),
  userId: z.string().min(1).optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  query: z.string().trim().min(1).optional(),
  cursor: z.string().min(1).optional(),
  take: z.coerce.number().int().min(1).max(100).default(25),
});

export type PostListQuery = z.infer<typeof postListQuerySchema>;

export const connectionListQuerySchema = z.object({
  platform: z.nativeEnum(Platform).optional(),
  status: z.nativeEnum(AccountStatus).optional(),
  tokenHealth: z.enum(["expired", "expiring"]).optional(),
});

export type ConnectionListQuery = z.infer<typeof connectionListQuerySchema>;

export const moderationActionSchema = z.object({
  reason: z.string().trim().min(1, "A reason is required.").max(500),
});

export type ModerationActionInput = z.infer<typeof moderationActionSchema>;
