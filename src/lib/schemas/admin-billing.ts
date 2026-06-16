import { z } from "zod";
import { BillingInterval, PlanKey, RefundStatus, SubscriptionStatus } from "@prisma/client";

// Admin billing validation (doc 17). Shared by API routes and the admin UI.
// The list query is parsed from URLSearchParams, so every field is optional.

export const subscriptionListQuerySchema = z.object({
  status: z.nativeEnum(SubscriptionStatus).optional(),
  plan: z.nativeEnum(PlanKey).optional(),
  interval: z.nativeEnum(BillingInterval).optional(),
});

export type SubscriptionListQuery = z.infer<typeof subscriptionListQuerySchema>;

export const refundStatusFilterSchema = z.object({
  status: z.nativeEnum(RefundStatus).optional(),
});

export const approveRefundSchema = z.object({
  note: z.string().trim().max(2000).optional(),
  force: z.boolean().optional(),
});

export type ApproveRefundInput = z.infer<typeof approveRefundSchema>;

export const denyRefundSchema = z.object({
  note: z.string().trim().min(1, "A reason is required.").max(2000),
});

export type DenyRefundInput = z.infer<typeof denyRefundSchema>;

export const staffRefundSchema = z.object({
  userId: z.string().min(1),
  amount: z.number().int().positive(),
  reason: z.string().trim().min(1).max(2000),
});

export type StaffRefundInput = z.infer<typeof staffRefundSchema>;

// trialEndsAt: ISO string → Date, or null to clear. Other fields optional enums.
const isoDateOrNull = z
  .union([z.string().datetime(), z.null()])
  .transform((v) => (v === null ? null : new Date(v)));

export const overrideSubscriptionSchema = z
  .object({
    plan: z.nativeEnum(PlanKey).optional(),
    interval: z.nativeEnum(BillingInterval).optional(),
    status: z.nativeEnum(SubscriptionStatus).optional(),
    trialEndsAt: isoDateOrNull.optional(),
  })
  .refine(
    (v) =>
      v.plan !== undefined ||
      v.interval !== undefined ||
      v.status !== undefined ||
      v.trialEndsAt !== undefined,
    { message: "Provide at least one field to override." },
  );

export type OverrideSubscriptionInput = z.infer<typeof overrideSubscriptionSchema>;

export const grantCreditSchema = z.object({
  amount: z.number().int().positive(),
  reason: z.string().trim().min(1).max(2000),
});

export type GrantCreditInput = z.infer<typeof grantCreditSchema>;
