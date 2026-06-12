import { z } from "zod";

// Auth validation schemas (doc 03). Shared by API route handlers and client forms.
// bcrypt has a 72-byte cap, so passwords are bounded at 72.

export const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(72),
  displayName: z.string().min(1).max(60),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(72),
});

export const forgotSchema = z.object({
  email: z.string().email(),
});

export const resetSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8).max(72),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotInput = z.infer<typeof forgotSchema>;
export type ResetInput = z.infer<typeof resetSchema>;
