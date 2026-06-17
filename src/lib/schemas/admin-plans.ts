import { z } from "zod";

// Admin plan-catalog + editable-defaults validation (DB-backed plan CRUD). Shared by the
// API routes and the admin UI. Account limit uses -1 = unlimited everywhere on the wire
// (JSON-safe); the catalog layer maps -1 ↔ Infinity for enforcement.

/** Slug shape for a plan `key`: lowercase alnum + internal hyphens, 1–32 chars. */
const planKey = z
  .string()
  .trim()
  .min(1, "A key is required.")
  .max(32, "Key must be at most 32 characters.")
  .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, "Key must be a slug (lowercase letters, numbers, hyphens).");

/** A single feature bullet - non-empty after trim. */
const feature = z.string().trim().min(1, "Feature text cannot be empty.").max(120);

const features = z.array(feature).max(20, "At most 20 features.");

/** accountLimit: integer ≥ -1, where -1 means unlimited. */
const accountLimit = z
  .number()
  .int("Account limit must be a whole number.")
  .gte(-1, "Account limit must be -1 (unlimited) or greater.");

/** POST /api/admin/plans - create a plan tier. */
export const planCreateSchema = z.object({
  key: planKey,
  name: z.string().trim().min(1, "A name is required.").max(60),
  tagline: z.string().trim().max(120).default(""),
  monthly: z.number().int("Monthly price must be a whole number.").gte(0),
  yearly: z.number().int("Yearly price must be a whole number.").gte(0),
  accountLimit,
  features: features.default([]),
  rank: z.number().int("Rank must be a whole number.").gte(0),
  isPublic: z.boolean().default(true),
  active: z.boolean().default(true),
});

export type PlanCreateInput = z.infer<typeof planCreateSchema>;

/** PATCH /api/admin/plans/:key - every create field EXCEPT `key` (immutable), all optional. */
export const planUpdateSchema = z
  .object({
    name: z.string().trim().min(1, "A name is required.").max(60),
    tagline: z.string().trim().max(120),
    monthly: z.number().int("Monthly price must be a whole number.").gte(0),
    yearly: z.number().int("Yearly price must be a whole number.").gte(0),
    accountLimit,
    features,
    rank: z.number().int("Rank must be a whole number.").gte(0),
    isPublic: z.boolean(),
    active: z.boolean(),
  })
  .partial();

export type PlanUpdateInput = z.infer<typeof planUpdateSchema>;

/** PATCH /api/admin/settings/defaults - edit the platform default scalars. */
export const defaultsUpdateSchema = z.object({
  trialDays: z.number().int("Trial days must be a whole number.").gte(0).lte(90).optional(),
  refundWindowDays: z
    .number()
    .int("Refund window must be a whole number.")
    .gte(0)
    .lte(90)
    .optional(),
  signupsDefault: z.boolean().optional(),
});

export type DefaultsUpdateInput = z.infer<typeof defaultsUpdateSchema>;
