import { z } from "zod";

// Waitlist validation (doc 20 waitlist mode). Shared by the public POST /api/waitlist handler
// and the landing-page form. Email matches the auth schemas; source is an optional free-form
// hint (e.g. "landing") the client may attach for attribution.
export const waitlistJoinSchema = z.object({
  email: z.string().email(),
  source: z.string().min(1).max(60).optional(),
});

export type WaitlistJoinInput = z.infer<typeof waitlistJoinSchema>;
