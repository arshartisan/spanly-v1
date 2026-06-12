import { z } from "zod";

// Settings + queue validation (docs/implementation/11). Shared by API routes and client forms.

// ─────────────────────────── User.settings (General tab) ───────────────────────────

export const emailPrefsSchema = z.object({
  automation: z.boolean(),
  failureAlerts: z.boolean(),
  summary: z.boolean(),
});

export const platformPrefsSchema = z.object({
  filenameAsCaption: z.boolean(),
  use24h: z.boolean(),
  processVideosServerSide: z.boolean(),
});

export const userSettingsSchema = z.object({
  emailPrefs: emailPrefsSchema,
  platformPrefs: platformPrefsSchema,
  weeklyPostingGoal: z.number().int().min(0).max(1000),
  mcpUrl: z.string().url().optional(),
});

export type UserSettings = z.infer<typeof userSettingsSchema>;

export const DEFAULT_SETTINGS: UserSettings = {
  emailPrefs: { automation: true, failureAlerts: true, summary: false },
  platformPrefs: { filenameAsCaption: false, use24h: false, processVideosServerSide: true },
  weeklyPostingGoal: 0,
};

// PATCH /api/settings — partial update of profile columns + settings JSON. All optional.
export const settingsPatchSchema = z.object({
  displayName: z.string().min(1).max(60).optional(),
  avatarUrl: z.string().url().nullable().optional(),
  timezone: z.string().min(1).max(64).optional(),
  weeklyPostingGoal: z.number().int().min(0).max(1000).optional(),
  emailPrefs: emailPrefsSchema.partial().optional(),
  platformPrefs: platformPrefsSchema.partial().optional(),
  mcpUrl: z.string().url().nullable().optional(),
});

export type SettingsPatch = z.infer<typeof settingsPatchSchema>;

// ─────────────────────────── Queue (Queue tab) ───────────────────────────

export const queueSlotSchema = z.object({
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Time must be HH:mm (24h)."),
  days: z.array(z.boolean()).length(7), // Mon..Sun
});

export const queuePutSchema = z.object({
  timezone: z.string().min(1).max(64),
  randomizeWithinMinutes: z.number().int().min(0).max(60),
  slots: z.array(queueSlotSchema).max(50),
});

export type QueuePut = z.infer<typeof queuePutSchema>;
