import { z } from "zod";
import { PlanKey } from "@prisma/client";

// Admin platform-settings validation (doc 20). Shared by the API routes and the admin UI.

// from/to arrive as ISO date strings on the wire; coerce to Date for the store layer.
const isoDate = z
  .string()
  .datetime({ message: "Expected an ISO date string." })
  .transform((v) => new Date(v));

const planKeys = Object.values(PlanKey) as [string, ...string[]];

/**
 * `audience` is `all` | `trialing` | `plan:<planKey>`. Validate the `plan:` prefix carries
 * a real plan key so an audience can never silently target no one.
 */
const audience = z
  .string()
  .trim()
  .refine(
    (v) => v === "all" || v === "trialing" || planKeys.includes(v.replace(/^plan:/, "")) && v.startsWith("plan:"),
    { message: "Audience must be 'all', 'trialing', or 'plan:<planKey>'." },
  );

/** PATCH /api/admin/settings/flags/:key — `{ enabled, value? }`. */
export const flagPatchSchema = z.object({
  enabled: z.boolean(),
  value: z.unknown().optional(),
});

export type FlagPatchInput = z.infer<typeof flagPatchSchema>;

const SEVERITIES = ["info", "warning", "critical"] as const;

/** POST /api/admin/settings/announcements body. */
export const announcementCreateSchema = z.object({
  message: z.string().trim().min(1, "A message is required.").max(500),
  severity: z.enum(SEVERITIES).default("info"),
  audience: audience.default("all"),
  startsAt: isoDate.optional(),
  endsAt: isoDate.optional(),
  active: z.boolean().optional(),
});

export type AnnouncementCreateInput = z.infer<typeof announcementCreateSchema>;

/** PATCH /api/admin/settings/announcements/:id — every field optional, incl. `active`. */
export const announcementUpdateSchema = z.object({
  message: z.string().trim().min(1).max(500).optional(),
  severity: z.enum(SEVERITIES).optional(),
  audience: audience.optional(),
  startsAt: isoDate.nullable().optional(),
  endsAt: isoDate.nullable().optional(),
  active: z.boolean().optional(),
});

export type AnnouncementUpdateInput = z.infer<typeof announcementUpdateSchema>;
