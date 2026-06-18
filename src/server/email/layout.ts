import "server-only";
import { appUrl } from "@/server/billing-config";

/**
 * Shared HTML email layout for all Spanlyfy transactional + newsletter mail.
 *
 * Email clients strip <style> blocks and ignore CSS variables, so everything here is inlined and
 * uses table-based structure for Outlook. The look mirrors the app's orange-glass brand: a deep
 * charcoal header wordmark + an orange action button, on a warm off-white body for readability.
 */

const BRAND_ORANGE = "#F56714";
const BRAND_ORANGE_DARK = "#D9560E";
const CHARCOAL = "#171210";
const BODY_BG = "#FBF7F4";
const CARD_BG = "#FFFFFF";
const TEXT = "#2A2422";
const MUTED = "#7A726C";
const BORDER = "#ECE4DD";

/** Escape user/dynamic content before interpolating into HTML. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface EmailLayoutOptions {
  /** Hidden inbox-preview text (the snippet shown next to the subject). */
  preheader: string;
  /** Large heading at the top of the card. */
  heading: string;
  /** Pre-rendered, trusted HTML for the message body (paragraphs, etc.). */
  bodyHtml: string;
  /** Optional primary call-to-action. */
  action?: { url: string; label: string };
  /** Optional extra HTML appended to the footer (e.g. an unsubscribe line). */
  footerExtraHtml?: string;
}

/** Wrap a paragraph of (already-escaped or trusted) HTML in the standard body style. */
export function p(html: string): string {
  return `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${TEXT};">${html}</p>`;
}

/** A muted "this code/link expires in N" style note. */
export function note(html: string): string {
  return `<p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:${MUTED};">${html}</p>`;
}

/** Render the full HTML document for an email. */
export function renderEmail(opts: EmailLayoutOptions): string {
  const year = "2026";
  const button = opts.action
    ? `
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 20px;">
        <tr>
          <td align="center" bgcolor="${BRAND_ORANGE}" style="border-radius:10px;">
            <a href="${opts.action.url}"
               style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px;background:${BRAND_ORANGE};border:1px solid ${BRAND_ORANGE_DARK};">
              ${escapeHtml(opts.action.label)}
            </a>
          </td>
        </tr>
      </table>`
    : "";

  // A copyable plain link under the button helps when the button doesn't render.
  const fallbackLink = opts.action
    ? `<p style="margin:0 0 16px;font-size:12px;line-height:1.5;color:${MUTED};word-break:break-all;">
         Or paste this link into your browser:<br/>
         <a href="${opts.action.url}" style="color:${BRAND_ORANGE_DARK};">${escapeHtml(opts.action.url)}</a>
       </p>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <meta name="color-scheme" content="light"/>
  <title>${escapeHtml(opts.heading)}</title>
</head>
<body style="margin:0;padding:0;background:${BODY_BG};-webkit-font-smoothing:antialiased;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(opts.preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BODY_BG};padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
          <tr>
            <td style="padding:8px 4px 20px;">
              <!-- Brand lockup: emblem PNG (SVG isn't supported in most email clients) + live-text
                   wordmark, so it still reads "Spanlyfy" even if images are blocked. -->
              <img
                src="${appUrl("/email-emblem.png")}"
                width="34"
                height="34"
                alt="Spanlyfy"
                style="display:inline-block;vertical-align:middle;border-radius:9px;border:0;"
              />
              <span style="display:inline-block;vertical-align:middle;margin-left:10px;font-size:20px;font-weight:700;letter-spacing:-0.02em;color:${CHARCOAL};">
                Spanly<span style="color:${BRAND_ORANGE};">fy</span>
              </span>
            </td>
          </tr>
          <tr>
            <td style="background:${CARD_BG};border:1px solid ${BORDER};border-radius:16px;padding:32px 28px;">
              <h1 style="margin:0 0 18px;font-size:21px;line-height:1.3;font-weight:700;color:${CHARCOAL};">${escapeHtml(opts.heading)}</h1>
              ${opts.bodyHtml}
              ${button}
              ${fallbackLink}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 8px;text-align:center;">
              <p style="margin:0 0 6px;font-size:12px;line-height:1.5;color:${MUTED};">
                Spanlyfy — schedule and publish across every social platform.
              </p>
              ${opts.footerExtraHtml ?? ""}
              <p style="margin:8px 0 0;font-size:11px;color:${MUTED};">© ${year} Spanlyfy. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
