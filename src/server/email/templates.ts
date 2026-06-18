import "server-only";
import { renderEmail, escapeHtml, p, note } from "@/server/email/layout";

/**
 * Email templates. Each returns the subject + both body parts (text fallback + branded HTML).
 * Keep the plain-text version meaningful on its own - some clients show only that.
 */

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

const greeting = (name?: string | null) => (name ? `Hi ${escapeHtml(name)},` : "Hi there,");

// ─────────────────────────── Auth ───────────────────────────

export function verifyEmailTemplate(opts: { verifyUrl: string; displayName?: string | null }): RenderedEmail {
  return {
    subject: "Confirm your Spanlyfy email",
    text:
      `Welcome to Spanlyfy! Confirm your email to finish setting up your account:\n${opts.verifyUrl}\n\n` +
      `This link expires in 24 hours. If you didn't create an account, you can ignore this email.`,
    html: renderEmail({
      preheader: "Confirm your email to finish setting up your Spanlyfy account.",
      heading: "Confirm your email",
      bodyHtml:
        p(greeting(opts.displayName)) +
        p("Welcome to Spanlyfy! Confirm your email address to finish setting up your account.") +
        note("This link expires in 24 hours. If you didn't sign up, you can safely ignore this email."),
      action: { url: opts.verifyUrl, label: "Confirm email" },
    }),
  };
}

export function passwordResetTemplate(opts: { resetUrl: string; displayName?: string | null }): RenderedEmail {
  return {
    subject: "Reset your Spanlyfy password",
    text:
      `Use the link below to set a new password. It expires in 1 hour:\n${opts.resetUrl}\n\n` +
      `If you didn't request this, you can ignore this email - your password won't change.`,
    html: renderEmail({
      preheader: "Reset your Spanlyfy password. This link expires in 1 hour.",
      heading: "Reset your password",
      bodyHtml:
        p(greeting(opts.displayName)) +
        p("We received a request to reset your Spanlyfy password. Click below to choose a new one.") +
        note("This link expires in 1 hour. If you didn't request a reset, ignore this email - your password stays the same."),
      action: { url: opts.resetUrl, label: "Reset password" },
    }),
  };
}

export function emailChangeTemplate(opts: { verifyUrl: string; displayName?: string | null }): RenderedEmail {
  return {
    subject: "Confirm your new Spanlyfy email",
    text:
      `Confirm this address to finish changing your Spanlyfy email:\n${opts.verifyUrl}\n\n` +
      `This link expires in 24 hours.`,
    html: renderEmail({
      preheader: "Confirm this address to finish changing your Spanlyfy email.",
      heading: "Confirm your new email",
      bodyHtml:
        p(greeting(opts.displayName)) +
        p("Confirm this email address to finish changing the address on your Spanlyfy account.") +
        note("This link expires in 24 hours. If you didn't request this change, contact support right away."),
      action: { url: opts.verifyUrl, label: "Confirm new email" },
    }),
  };
}

export function loginOtpTemplate(opts: {
  code: string;
  minutes: number;
  displayName?: string | null;
  ip?: string | null;
}): RenderedEmail {
  const spaced = opts.code.split("").join(" ");
  const where = opts.ip ? ` from ${escapeHtml(opts.ip)}` : "";
  return {
    subject: `Your Spanlyfy login code: ${opts.code}`,
    text:
      `Your Spanlyfy verification code is ${opts.code}. It expires in ${opts.minutes} minutes.\n\n` +
      `We asked for this because you're signing in from a new device${opts.ip ? ` (${opts.ip})` : ""}. ` +
      `If this wasn't you, change your password.`,
    html: renderEmail({
      preheader: `Your login code is ${opts.code} (expires in ${opts.minutes} minutes).`,
      heading: "Your login code",
      bodyHtml:
        p(greeting(opts.displayName)) +
        p(`You're signing in from a new device${where}. Enter this code to continue:`) +
        `<div style="margin:8px 0 18px;padding:16px;text-align:center;background:#FBF7F4;border:1px solid #ECE4DD;border-radius:12px;">
           <span style="font-size:30px;font-weight:700;letter-spacing:8px;color:#171210;">${escapeHtml(spaced)}</span>
         </div>` +
        note(`This code expires in ${opts.minutes} minutes. If you didn't try to sign in, change your password as soon as you can.`),
    }),
  };
}

export function verifyEmailOtpTemplate(opts: {
  code: string;
  minutes: number;
  displayName?: string | null;
}): RenderedEmail {
  const spaced = opts.code.split("").join(" ");
  return {
    subject: `Your Spanlyfy verification code: ${opts.code}`,
    text:
      `Your Spanlyfy email verification code is ${opts.code}. It expires in ${opts.minutes} minutes.\n\n` +
      `Enter it on the settings page to confirm your email address. If you didn't request this, ignore this email.`,
    html: renderEmail({
      preheader: `Your email verification code is ${opts.code} (expires in ${opts.minutes} minutes).`,
      heading: "Confirm your email",
      bodyHtml:
        p(greeting(opts.displayName)) +
        p("Enter this code on the settings page to confirm your email address:") +
        `<div style="margin:8px 0 18px;padding:16px;text-align:center;background:#FBF7F4;border:1px solid #ECE4DD;border-radius:12px;">
           <span style="font-size:30px;font-weight:700;letter-spacing:8px;color:#171210;">${escapeHtml(spaced)}</span>
         </div>` +
        note(`This code expires in ${opts.minutes} minutes. If you didn't request it, you can ignore this email.`),
    }),
  };
}

// ─────────────────────────── Billing ───────────────────────────

function formatMoney(amount: number, currency = "USD"): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
  } catch {
    return `$${amount}`;
  }
}

export function paymentConfirmationTemplate(opts: {
  planName: string;
  interval: string;
  amount: number;
  currency?: string;
  nextBillingDate?: string | null;
  manageUrl: string;
  displayName?: string | null;
  trialing?: boolean;
}): RenderedEmail {
  const price = `${formatMoney(opts.amount, opts.currency)}/${opts.interval}`;
  const detail = opts.trialing
    ? `Your free trial of the <strong>${escapeHtml(opts.planName)}</strong> plan is active.` +
      (opts.nextBillingDate ? ` Your first payment of ${escapeHtml(price)} is on ${escapeHtml(opts.nextBillingDate)}.` : "")
    : `Your <strong>${escapeHtml(opts.planName)}</strong> subscription (${escapeHtml(price)}) is active.` +
      (opts.nextBillingDate ? ` Your next payment is on ${escapeHtml(opts.nextBillingDate)}.` : "");
  return {
    subject: opts.trialing ? "Your Spanlyfy trial is active" : "Payment confirmed — your Spanlyfy plan is active",
    text:
      `${opts.trialing ? "Your free trial" : "Thanks for your payment"}! ` +
      `Plan: ${opts.planName} (${price}).` +
      (opts.nextBillingDate ? ` Next billing: ${opts.nextBillingDate}.` : "") +
      `\n\nManage your subscription: ${opts.manageUrl}`,
    html: renderEmail({
      preheader: opts.trialing ? "Your Spanlyfy trial is active." : "Your Spanlyfy subscription is active.",
      heading: opts.trialing ? "Your trial is active" : "Payment confirmed",
      bodyHtml: p(greeting(opts.displayName)) + p(detail) + p("Thanks for choosing Spanlyfy."),
      action: { url: opts.manageUrl, label: "Manage subscription" },
    }),
  };
}

export function paymentFailedTemplate(opts: {
  planName: string;
  manageUrl: string;
  displayName?: string | null;
}): RenderedEmail {
  return {
    subject: "Action needed: your Spanlyfy payment failed",
    text:
      `We couldn't process the payment for your ${opts.planName} plan. ` +
      `Please update your payment method to avoid losing access:\n${opts.manageUrl}`,
    html: renderEmail({
      preheader: "We couldn't process your latest Spanlyfy payment.",
      heading: "Your payment didn't go through",
      bodyHtml:
        p(greeting(opts.displayName)) +
        p(`We couldn't process the payment for your <strong>${escapeHtml(opts.planName)}</strong> plan.`) +
        p("Update your payment method to keep your subscription active. We'll retry automatically in the meantime."),
      action: { url: opts.manageUrl, label: "Update payment method" },
    }),
  };
}

export function subscriptionCanceledTemplate(opts: {
  planName: string;
  resubscribeUrl: string;
  displayName?: string | null;
}): RenderedEmail {
  return {
    subject: "Your Spanlyfy subscription was canceled",
    text:
      `Your ${opts.planName} subscription has been canceled. You can resubscribe any time:\n${opts.resubscribeUrl}`,
    html: renderEmail({
      preheader: "Your Spanlyfy subscription has been canceled.",
      heading: "Subscription canceled",
      bodyHtml:
        p(greeting(opts.displayName)) +
        p(`Your <strong>${escapeHtml(opts.planName)}</strong> subscription has been canceled. We're sorry to see you go.`) +
        p("You can resubscribe any time - your data stays put."),
      action: { url: opts.resubscribeUrl, label: "Resubscribe" },
    }),
  };
}

// ─────────────────────────── Newsletter ───────────────────────────

export function newsletterTemplate(opts: {
  heading: string;
  /** Trusted HTML body (composed by staff). */
  bodyHtml: string;
  unsubscribeUrl: string;
  action?: { url: string; label: string };
  /** Optional plain-text override; falls back to a stripped note. */
  text?: string;
}): RenderedEmail {
  const footer = `<p style="margin:6px 0 0;font-size:11px;color:#7A726C;">
      You're receiving this because you opted in to Spanlyfy updates.
      <a href="${opts.unsubscribeUrl}" style="color:#7A726C;text-decoration:underline;">Unsubscribe</a>.
    </p>`;
  return {
    subject: opts.heading,
    text:
      (opts.text ?? `${opts.heading}\n\nView this email in an HTML-capable client.`) +
      `\n\nUnsubscribe: ${opts.unsubscribeUrl}`,
    html: renderEmail({
      preheader: opts.heading,
      heading: opts.heading,
      bodyHtml: opts.bodyHtml,
      action: opts.action,
      footerExtraHtml: footer,
    }),
  };
}
