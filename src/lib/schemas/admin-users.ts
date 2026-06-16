import { z } from "zod";
import { PlanKey, Role, SubscriptionStatus } from "@prisma/client";

// Admin user-management validation (doc 16). Shared by API routes and the admin UI.
// The list query is parsed from URLSearchParams, so every field is optional + coercible.

const boolFlag = z.enum(["true", "false"]);

export const userListQuerySchema = z.object({
  query: z.string().trim().min(1).optional(),
  role: z.nativeEnum(Role).optional(),
  plan: z.nativeEnum(PlanKey).optional(),
  status: z.nativeEnum(SubscriptionStatus).optional(),
  suspended: boolFlag.optional(),
  verified: boolFlag.optional(),
  cursor: z.string().min(1).optional(),
  take: z.coerce.number().int().min(1).max(100).default(25),
});

export type UserListQuery = z.infer<typeof userListQuerySchema>;

export const suspendSchema = z.object({
  reason: z.string().trim().min(1, "A reason is required."),
});

export type SuspendInput = z.infer<typeof suspendSchema>;

export const noteSchema = z.object({
  body: z.string().trim().min(1).max(5000),
});

export type NoteInput = z.infer<typeof noteSchema>;

export const updateUserSchema = z
  .object({
    displayName: z.string().trim().min(1).max(60).optional(),
    email: z.string().trim().email().optional(),
  })
  .refine((v) => v.displayName !== undefined || v.email !== undefined, {
    message: "Provide at least one field to update.",
  });

export type UpdateUserInput = z.infer<typeof updateUserSchema>;
