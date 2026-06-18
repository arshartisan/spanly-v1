import { prisma } from "@/server/db";
import { verifyUnsubscribe } from "@/server/email/unsubscribe";
import { renderEmail } from "@/server/email/layout";

// Unsubscribe endpoint for newsletters (CAN-SPAM / RFC 8058). The token is a stateless HMAC of
// the userId, so links never expire and require no session. Two entry points:
//   GET  - the link a human clicks; flips the flag and returns a branded confirmation page.
//   POST - one-click unsubscribe fired automatically by Gmail/Apple Mail via List-Unsubscribe-Post.

async function optOut(userId: string, token: string): Promise<boolean> {
  if (!verifyUnsubscribe(userId, token)) return false;
  // updateMany so a stale/deleted user id is a silent no-op rather than a throw.
  await prisma.user.updateMany({ where: { id: userId }, data: { marketingEmails: false } });
  return true;
}

function page(title: string, message: string, status: number): Response {
  const html = renderEmail({
    preheader: title,
    heading: title,
    bodyHtml: `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#2A2422;">${message}</p>`,
    action: { url: "https://spanly.app", label: "Back to Spanlyfy" },
  });
  return new Response(html, { status, headers: { "content-type": "text/html; charset=utf-8" } });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const userId = url.searchParams.get("u") ?? "";
  const token = url.searchParams.get("t") ?? "";
  if (await optOut(userId, token)) {
    return page(
      "You're unsubscribed",
      "You won't receive marketing emails from Spanlyfy anymore. You'll still get important account and billing notifications. You can re-enable updates any time in your account settings.",
      200,
    );
  }
  return page("Link expired or invalid", "We couldn't process this unsubscribe link. Please update your email preferences from your account settings instead.", 400);
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  const userId = url.searchParams.get("u") ?? "";
  const token = url.searchParams.get("t") ?? "";
  const ok = await optOut(userId, token);
  // RFC 8058 expects a 200 on success; mail clients ignore the body.
  return new Response(null, { status: ok ? 200 : 400 });
}
