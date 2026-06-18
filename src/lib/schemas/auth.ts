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

// New-device login step-up: a 6-digit code emailed after a correct password (doc 03).
export const verifyOtpSchema = z.object({
  email: z.string().email(),
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code."),
});

export const resendOtpSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(72),
});

// Email-verification step-up from settings: a 6-digit code sent to the current user's address.
export const emailOtpVerifySchema = z.object({
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code."),
});

export const resetSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8).max(72),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(72),
  newPassword: z.string().min(8).max(72),
});

export const changeEmailSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(72),
});

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type ChangeEmailInput = z.infer<typeof changeEmailSchema>;

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotInput = z.infer<typeof forgotSchema>;
export type ResetInput = z.infer<typeof resetSchema>;
