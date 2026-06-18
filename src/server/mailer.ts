import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

/**
 * Mailer abstraction (D-013). Two transports behind one interface:
 *   - SMTP (Gmail): used whenever SMTP_USER + SMTP_PASS are both set. See docs/email-setup.md.
 *   - console (dev): the fallback when SMTP isn't configured - logs the message (and any action
 *     link) to the server console so the full verify/reset/OTP loop works with zero email infra.
 *
 * Callers never pick a transport; `mailer.send()` routes to whichever is active. Higher-level
 * typed helpers (verification, reset, OTP, payment, newsletter) live in src/server/email/.
 */

export interface MailMessage {
  to: string;
  subject: string;
  /** Plain-text body. Always set - it's the fallback part and what the dev transport prints. */
  text: string;
  /** Optional HTML body. When present it's sent as the rich part (text stays as fallback). */
  html?: string;
  /** Optional primary action link, highlighted in the dev console output. */
  actionUrl?: string;
  /** Per-message Reply-To override (defaults to EMAIL_REPLY_TO). */
  replyTo?: string;
  /** Extra headers, e.g. List-Unsubscribe for newsletters. */
  headers?: Record<string, string>;
}

export interface Mailer {
  send(msg: MailMessage): Promise<void>;
}

/** True when real SMTP credentials are present. Drives transport selection + admin diagnostics. */
export function isSmtpConfigured(): boolean {
  return Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);
}

/** Default From address; falls back to the authenticated SMTP user so a bare config still sends. */
function fromAddress(): string {
  return process.env.EMAIL_FROM || process.env.SMTP_USER || "no-reply@localhost";
}

// ─────────────────────────── Console transport (dev) ───────────────────────────

const consoleMailer: Mailer = {
  async send(msg) {
    const lines = [
      "",
      "📧  ──────────────── DEV EMAIL ────────────────",
      `   To:      ${msg.to}`,
      `   Subject: ${msg.subject}`,
    ];
    if (msg.actionUrl) lines.push(`   Link:    ${msg.actionUrl}`);
    lines.push(`   Body:    ${msg.text}`);
    lines.push("   ──────────────────────────────────────────────", "");
    console.log(lines.join("\n"));
  },
};

// ─────────────────────────── SMTP transport (Gmail) ───────────────────────────

// Lazily created once and reused (pooled). Module-level so connections survive across requests.
let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT ?? 465),
    // secure=true => implicit TLS on 465; false => STARTTLS on 587.
    secure: (process.env.SMTP_SECURE ?? "true") !== "false",
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    pool: true,
    maxConnections: 3,
    maxMessages: 100,
    // Fail fast instead of hanging the request (which surfaces as a gateway 502 behind a proxy).
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
  return transporter;
}

const smtpMailer: Mailer = {
  async send(msg) {
    await getTransporter().sendMail({
      from: fromAddress(),
      to: msg.to,
      subject: msg.subject,
      text: msg.text,
      html: msg.html,
      replyTo: msg.replyTo ?? process.env.EMAIL_REPLY_TO ?? undefined,
      headers: msg.headers,
    });
  },
};

/** Verify the SMTP connection/credentials (used by an admin health check). No-op in console mode. */
export async function verifyMailer(): Promise<{ ok: boolean; transport: string; error?: string }> {
  if (!isSmtpConfigured()) return { ok: true, transport: "console" };
  try {
    await getTransporter().verify();
    return { ok: true, transport: "smtp" };
  } catch (err) {
    return { ok: false, transport: "smtp", error: err instanceof Error ? err.message : "verify failed" };
  }
}

export const mailer: Mailer = {
  send(msg) {
    return isSmtpConfigured() ? smtpMailer.send(msg) : consoleMailer.send(msg);
  },
};
