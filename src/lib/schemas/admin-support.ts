import { z } from "zod";

// Advanced support powers validation (doc 21). Shared by API routes and the admin UI.
// Every action here is superadmin-gated; GDPR/broadcast bodies are validated but never
// echoed into audit metadata.

// Audience grammar (matches resolveAudience / buildAudienceWhere in admin/support.ts):
//   all | trialing | plan:<planKey> | ids:<comma-separated user ids>
const audienceSchema = z
  .string()
  .trim()
  .min(1, "An audience is required.")
  .refine(
    (v) =>
      v === "all" ||
      v === "trialing" ||
      /^plan:[a-z0-9_-]+$/i.test(v) ||
      /^ids:[^,\s][^\s]*$/.test(v),
    {
      message:
        "Audience must be 'all', 'trialing', 'plan:<key>', or 'ids:<comma ids>'.",
    },
  );

export const broadcastSchema = z.object({
  audience: audienceSchema,
  subject: z.string().trim().min(1, "A subject is required.").max(200),
  body: z.string().trim().min(1, "A body is required.").max(5000),
  // Marketing/newsletter mode: only sends to users with marketingEmails=true and appends a
  // working one-click unsubscribe link + List-Unsubscribe header. Off = operational notice
  // (service status, price changes) that reaches the whole audience regardless of opt-in.
  marketing: z.boolean().default(false),
});

export type BroadcastInput = z.infer<typeof broadcastSchema>;

// GDPR anonymize / delete both require a typed reason (audited, never PII echoed back).
export const gdprActionSchema = z.object({
  reason: z.string().trim().min(1, "A reason is required.").max(500),
});

export type GdprActionInput = z.infer<typeof gdprActionSchema>;
