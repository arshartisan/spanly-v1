import "server-only";
import { mailer, type MailMessage } from "@/server/mailer";
import {
  verifyEmailTemplate,
  passwordResetTemplate,
  emailChangeTemplate,
  loginOtpTemplate,
  verifyEmailOtpTemplate,
  paymentConfirmationTemplate,
  paymentFailedTemplate,
  subscriptionCanceledTemplate,
  newsletterTemplate,
  type RenderedEmail,
} from "@/server/email/templates";

/**
 * Typed email senders - the single front door the rest of the app uses. Each composes a template
 * and hands it to the transport-agnostic mailer. Routes/services should call these rather than
 * building MailMessages by hand, so subject/markup stay consistent.
 */

async function send(to: string, email: RenderedEmail, extra?: Partial<MailMessage>): Promise<void> {
  await mailer.send({ to, subject: email.subject, text: email.text, html: email.html, ...extra });
}

export function sendVerificationEmail(to: string, verifyUrl: string, displayName?: string | null) {
  return send(to, verifyEmailTemplate({ verifyUrl, displayName }));
}

export function sendPasswordResetEmail(to: string, resetUrl: string, displayName?: string | null) {
  return send(to, passwordResetTemplate({ resetUrl, displayName }));
}

export function sendEmailChangeEmail(to: string, verifyUrl: string, displayName?: string | null) {
  return send(to, emailChangeTemplate({ verifyUrl, displayName }));
}

export function sendLoginOtpEmail(
  to: string,
  opts: { code: string; minutes: number; displayName?: string | null; ip?: string | null },
) {
  return send(to, loginOtpTemplate(opts));
}

export function sendEmailVerificationOtp(
  to: string,
  opts: { code: string; minutes: number; displayName?: string | null },
) {
  return send(to, verifyEmailOtpTemplate(opts));
}

export function sendPaymentConfirmationEmail(
  to: string,
  opts: Parameters<typeof paymentConfirmationTemplate>[0],
) {
  return send(to, paymentConfirmationTemplate(opts));
}

export function sendPaymentFailedEmail(to: string, opts: Parameters<typeof paymentFailedTemplate>[0]) {
  return send(to, paymentFailedTemplate(opts));
}

export function sendSubscriptionCanceledEmail(
  to: string,
  opts: Parameters<typeof subscriptionCanceledTemplate>[0],
) {
  return send(to, subscriptionCanceledTemplate(opts));
}

/** Newsletter send carries a List-Unsubscribe header for one-click unsubscribe (RFC 8058). */
export function sendNewsletterEmail(
  to: string,
  opts: Parameters<typeof newsletterTemplate>[0],
) {
  return send(to, newsletterTemplate(opts), {
    headers: {
      "List-Unsubscribe": `<${opts.unsubscribeUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  });
}
