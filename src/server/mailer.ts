/**
 * Mailer abstraction (D-013). The dev transport logs the message (and any action link)
 * to the server console so the full verify/reset loop works with zero email infra.
 * Swap in Resend behind this same interface once RESEND_API_KEY + a verified sender exist.
 */

export interface MailMessage {
  to: string;
  subject: string;
  /** Plain-text body. The dev transport prints this verbatim. */
  text: string;
  /** Optional primary action link, highlighted in the dev console output. */
  actionUrl?: string;
}

export interface Mailer {
  send(msg: MailMessage): Promise<void>;
}

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

// Future: when process.env.RESEND_API_KEY is set, return a Resend-backed mailer here.
export const mailer: Mailer = consoleMailer;
