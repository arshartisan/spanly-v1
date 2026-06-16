import { z } from "zod";
import { QUEUE_NAMES } from "@/server/queue/names";

// Admin system & operations validation (doc 19). Shared by API routes and the admin UI.
// List queries are parsed from URLSearchParams, so every field is optional + coercible.

const QUEUE_VALUES = [
  QUEUE_NAMES.publish,
  QUEUE_NAMES.media,
  QUEUE_NAMES.maintenance,
] as const;

const MAINTENANCE_TASKS = [
  "missed-run-sweep",
  "drafts-cleanup",
  "token-refresh-sweep",
] as const;

const JOB_STATES = ["failed", "active", "delayed", "waiting"] as const;

/** `?queue=&state=failed` for the failed/active job list. */
export const jobListQuerySchema = z.object({
  queue: z.enum(QUEUE_VALUES),
  state: z.enum(JOB_STATES).default("failed"),
});

export type JobListQuery = z.infer<typeof jobListQuerySchema>;

/** `:task` path segment for the manual maintenance trigger. */
export const maintenanceTaskSchema = z.enum(MAINTENANCE_TASKS);

export type MaintenanceTaskInput = z.infer<typeof maintenanceTaskSchema>;

/** `?source=&cursor=&take=` for the webhook event log. */
export const webhookEventQuerySchema = z.object({
  source: z.string().trim().min(1).optional(),
  cursor: z.string().min(1).optional(),
  take: z.coerce.number().int().min(1).max(100).default(25),
});

export type WebhookEventQuery = z.infer<typeof webhookEventQuerySchema>;
