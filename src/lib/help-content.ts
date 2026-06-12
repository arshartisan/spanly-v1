/**
 * Help center content (Phase 13). Static, structured articles grouped by category. Kept as
 * typed data (not MDX) so it's trivially searchable on the client and rendered by a small block
 * renderer — no markdown pipeline or extra dependency. Articles map 1:1 to shipped features.
 *
 * Topic coverage is modeled on a mature social-scheduler help center but written originally for
 * Spanly: only the six supported platforms (Facebook, Instagram, LinkedIn, TikTok, YouTube, X),
 * our actual limits, and our real flows. Features Spanly doesn't have are deliberately omitted.
 */

export type HelpBlock =
  | { type: "p"; text: string }
  | { type: "h"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "code"; text: string };

export type HelpCategory =
  | "getting-started"
  | "connections"
  | "posting"
  | "media"
  | "account-billing"
  | "troubleshooting"
  | "developers";

export interface HelpArticle {
  slug: string;
  title: string;
  category: HelpCategory;
  excerpt: string;
  body: HelpBlock[];
}

export const HELP_CATEGORIES: { key: HelpCategory; label: string; description: string }[] = [
  { key: "getting-started", label: "Getting started", description: "Set up Spanly and learn the core workflow." },
  { key: "connections", label: "Connections", description: "Connect and manage your social accounts." },
  { key: "posting", label: "Creating & scheduling", description: "Compose, schedule, queue, and publish posts." },
  { key: "media", label: "Media & limits", description: "Upload sizes, formats, and per-platform limits." },
  { key: "account-billing", label: "Account & billing", description: "Plans, payments, and managing your account." },
  { key: "troubleshooting", label: "Troubleshooting", description: "Fix failed posts, connections, and sign-in." },
  { key: "developers", label: "Developers", description: "API keys, webhooks, and the MCP server." },
];

export const HELP_ARTICLES: HelpArticle[] = [
  // ─────────────────────────── Getting started ───────────────────────────
  {
    slug: "welcome",
    title: "Welcome to Spanly",
    category: "getting-started",
    excerpt: "What Spanly does and how the core workflow fits together.",
    body: [
      { type: "p", text: "Spanly is a social media scheduler. You connect your accounts, compose a post once, and publish it now or schedule it across all six supported platforms." },
      { type: "h", text: "The supported platforms" },
      { type: "ul", items: ["Facebook", "Instagram", "LinkedIn", "TikTok", "YouTube", "X"] },
      { type: "h", text: "The basic workflow" },
      { type: "ol", items: [
        "Connect one or more social accounts under Connections.",
        "Create a post and pick the accounts to publish to.",
        "Publish now, schedule a time, or add it to your queue.",
        "Track results on the post's publishing screen and the calendar.",
      ] },
    ],
  },
  {
    slug: "plan-ahead",
    title: "Planning your content in advance",
    category: "getting-started",
    excerpt: "Three ways to schedule ahead: pick a time, use a queue, or bulk import.",
    body: [
      { type: "p", text: "Spanly gives you three ways to line up content before it goes live, so you can batch your work and stay consistent." },
      { type: "ul", items: [
        "Pick a time — schedule any post for a specific date and time.",
        "Queue — define recurring weekly slots and drop posts into the next open one.",
        "Bulk import — upload a CSV to create many scheduled posts at once.",
      ] },
      { type: "p", text: "Everything you schedule shows up on the calendar in month or week view, so you can see your whole plan at a glance and spot gaps." },
    ],
  },
  {
    slug: "per-platform-captions",
    title: "Customizing captions for each platform",
    category: "getting-started",
    excerpt: "Write one main caption, then override it per platform where needed.",
    body: [
      { type: "p", text: "By default every selected account uses your main caption. When you want a different message for one platform — say a shorter line for X — you can override just that account." },
      { type: "ol", items: [
        "Select two or more accounts in the composer.",
        "A tab appears for each platform above the caption.",
        "Switch to a platform's tab and edit its caption to create an override.",
      ] },
      { type: "p", text: "Accounts you don't override keep using the main caption. The character counter always follows the strictest limit among the platforms you've selected." },
    ],
  },

  // ─────────────────────────── Connections ───────────────────────────
  {
    slug: "connect-accounts",
    title: "Connecting your social accounts",
    category: "connections",
    excerpt: "Link Facebook, Instagram, LinkedIn, TikTok, YouTube, and X.",
    body: [
      { type: "p", text: "Open Connections from the sidebar. Each platform has a Connect button that takes you through a secure authorization flow; once you approve, the account appears with its handle." },
      { type: "p", text: "Spanly never sees or stores your social passwords — you authorize access on the platform's own screen, and we keep only the access tokens needed to publish on your behalf, encrypted at rest." },
      { type: "h", text: "Reconnecting" },
      { type: "p", text: "If an account's access expires, reconnect it from the same row. Reconnecting an existing platform never uses an extra account slot." },
    ],
  },
  {
    slug: "connect-instagram",
    title: "Connecting Instagram (two methods)",
    category: "connections",
    excerpt: "Connect directly via Instagram or through a linked Facebook Page.",
    body: [
      { type: "p", text: "When you connect Instagram, Spanly asks which method to use:" },
      { type: "ul", items: [
        "Instagram — authorize directly with your Instagram account.",
        "Facebook Page — connect an Instagram account that's managed through a linked Facebook Page.",
      ] },
      { type: "p", text: "Pick whichever matches how your account is set up. If you manage the account from Facebook's business tools, use the Facebook Page method; otherwise connect directly." },
      { type: "p", text: "Instagram supports image, video, and story posts. Stories require exactly one media item." },
    ],
  },
  {
    slug: "connect-facebook",
    title: "Connecting a Facebook Page",
    category: "connections",
    excerpt: "Spanly publishes to Facebook Pages you manage.",
    body: [
      { type: "p", text: "Spanly connects to Facebook Pages — the business/brand presences you manage — rather than a personal timeline. During authorization, grant access to the Page you want to post to." },
      { type: "p", text: "If a Page doesn't appear, make sure your account has a manager or admin role on it, then try connecting again." },
      { type: "p", text: "Facebook supports text, image, and video posts, with the most generous caption length of any platform." },
    ],
  },
  {
    slug: "connect-linkedin",
    title: "Connecting LinkedIn",
    category: "connections",
    excerpt: "Post to your LinkedIn profile or a company page.",
    body: [
      { type: "p", text: "Connect LinkedIn from the Connections page and authorize the profile or page you want to publish to. Spanly supports text, image, and video posts on LinkedIn." },
      { type: "p", text: "If you manage a company page, make sure you have a posting role on it before connecting." },
    ],
  },
  {
    slug: "connect-tiktok-youtube",
    title: "Connecting TikTok and YouTube",
    category: "connections",
    excerpt: "Video-first platforms — what each one accepts.",
    body: [
      { type: "h", text: "TikTok" },
      { type: "p", text: "TikTok accepts image and video posts. Some accounts may need to be a Business or Creator account to allow third-party publishing — if a connection or post is rejected, check your account type in TikTok." },
      { type: "h", text: "YouTube" },
      { type: "p", text: "YouTube is video-only in Spanly. Connect the channel you want to upload to and authorize access. Each YouTube post is a single video." },
    ],
  },
  {
    slug: "connect-x",
    title: "Connecting X",
    category: "connections",
    excerpt: "Post text, images, and short video to X.",
    body: [
      { type: "p", text: "Connect X from the Connections page and authorize the account. X supports text, image, and video posts." },
      { type: "p", text: "X has the shortest caption limit of the supported platforms (280 characters), so when X is one of several selected accounts the composer's counter will reflect that limit. Use a per-platform override to write a longer caption for the others." },
    ],
  },
  {
    slug: "connection-limits",
    title: "Connection limits and platform capabilities",
    category: "connections",
    excerpt: "How many accounts your plan allows and what each platform supports.",
    body: [
      { type: "p", text: "Your plan sets how many social accounts you can connect at once:" },
      { type: "ul", items: [
        "Creator — up to 15 connected accounts.",
        "Growth — up to 50 connected accounts.",
        "Pro — unlimited connected accounts.",
      ] },
      { type: "p", text: "Reconnecting an account you already have never counts as a new connection. If you're at your limit, disconnect an account or upgrade to add more." },
      { type: "h", text: "What each platform supports" },
      { type: "ul", items: [
        "X — text, image, video. Up to 4 media; 280-character captions.",
        "LinkedIn — text, image, video. Up to 9 media; 3,000-character captions.",
        "Facebook — text, image, video. Up to 10 media; 5,000-character captions.",
        "Instagram — image, video, story. Up to 10 media; 2,200-character captions.",
        "TikTok — image, video. Up to 35 media; 2,200-character captions.",
        "YouTube — video only. One video; 5,000-character captions.",
      ] },
    ],
  },
  {
    slug: "cross-posting",
    title: "Cross-posting to multiple platforms at once",
    category: "connections",
    excerpt: "Publish the same post to several accounts in one step.",
    body: [
      { type: "p", text: "Select as many accounts as you like in the composer and Spanly fans the post out to each one. Every account publishes independently, so a problem with one never blocks the others." },
      { type: "p", text: "Only accounts that can handle your post type are selectable — for example, a text post won't offer YouTube, which is video-only." },
      { type: "p", text: "On the publishing screen you'll see a separate result for each account, with its own link or error." },
    ],
  },
  {
    slug: "duplicate-content",
    title: "Posting the same content to multiple accounts on one platform",
    category: "connections",
    excerpt: "Why some platforms discourage identical posts to several accounts.",
    body: [
      { type: "p", text: "You can connect more than one account on the same platform and post to all of them. Be aware that some platforms detect and limit identical content published to multiple accounts in a short window, which can reduce reach." },
      { type: "p", text: "If you're posting to several accounts on the same platform, consider giving each one a slightly different caption using per-platform overrides, and spacing the posts out with the queue rather than firing them all at once." },
    ],
  },

  // ─────────────────────────── Creating & scheduling ───────────────────────────
  {
    slug: "create-post",
    title: "Creating and scheduling a post",
    category: "posting",
    excerpt: "Compose once, target multiple accounts, and choose when it goes out.",
    body: [
      { type: "p", text: "From Create post, write your caption and select the accounts to publish to. The character counter follows the strictest limit among the platforms you've selected." },
      { type: "h", text: "When to publish" },
      { type: "ul", items: [
        "Post now — publishes immediately.",
        "Pick a time — schedules for a specific date and time in your timezone.",
        "Add to queue — drops it into your next open queue slot.",
        "Save to drafts — keep it to finish later.",
      ] },
      { type: "p", text: "You can edit or reschedule a post any time before it publishes from the calendar or your posts lists." },
    ],
  },
  {
    slug: "post-types",
    title: "Post types and platform limits",
    category: "posting",
    excerpt: "Text, image, video, and story — and what each platform allows.",
    body: [
      { type: "p", text: "Each post has a type, and each platform supports a different mix. The composer only lets you select accounts that can handle the chosen type." },
      { type: "ul", items: [
        "Text — supported on X, LinkedIn, and Facebook.",
        "Image — all platforms except YouTube.",
        "Video — every platform.",
        "Story — Instagram only, exactly one media item.",
      ] },
      { type: "p", text: "Caption length and media counts are enforced per platform when you publish, so you'll see an error before anything goes out if a target can't accept the post." },
    ],
  },
  {
    slug: "multi-image-posts",
    title: "Multi-image and carousel posts",
    category: "posting",
    excerpt: "Attach several images to a single post where the platform allows it.",
    body: [
      { type: "p", text: "For image and video posts you can attach multiple media items, and the platform renders them as a gallery or carousel. The maximum number of items depends on the platform." },
      { type: "ul", items: [
        "Instagram & Facebook — up to 10 items.",
        "LinkedIn — up to 9 items.",
        "TikTok — up to 35 items.",
        "X — up to 4 items.",
        "YouTube — a single video.",
      ] },
      { type: "p", text: "Drag to reorder media in the composer; the order you set is the order followers see." },
    ],
  },
  {
    slug: "stories",
    title: "Publishing Instagram stories",
    category: "posting",
    excerpt: "Stories are Instagram-only and take exactly one media item.",
    body: [
      { type: "p", text: "Choose the Story type to publish to Instagram stories. A story must have exactly one media item — one image or one video — and only Instagram supports it." },
      { type: "p", text: "If you select the Story type, other platforms are filtered out of the account picker automatically." },
    ],
  },
  {
    slug: "drafts",
    title: "Saving and managing drafts",
    category: "posting",
    excerpt: "Keep work-in-progress posts and finish them later.",
    body: [
      { type: "p", text: "Use Save to drafts to keep a post you're not ready to publish. Drafts don't have a scheduled time and don't appear on the calendar." },
      { type: "p", text: "Find them under Posts → Drafts, where you can open, edit, duplicate, or delete them. When a draft is ready, open it and choose Post now, Pick a time, or Add to queue." },
      { type: "p", text: "Drafts you never publish are automatically cleaned up after 90 days." },
    ],
  },
  {
    slug: "queue",
    title: "Using your posting queue",
    category: "posting",
    excerpt: "Define recurring time slots and let Spanly fill them in order.",
    body: [
      { type: "p", text: "A queue is a weekly set of time slots. Instead of picking a date for every post, add posts to the queue and Spanly assigns each one to the next open slot." },
      { type: "ol", items: [
        "Open Settings → Queue.",
        "Add the times and days you want to post.",
        "Set your timezone (slots are interpreted in it).",
        "Use Add to queue from the composer or bulk import.",
      ] },
      { type: "p", text: "Two queued posts never land on the same slot — each takes the next available one." },
    ],
  },
  {
    slug: "calendar",
    title: "The content calendar",
    category: "posting",
    excerpt: "See everything scheduled across platforms at a glance.",
    body: [
      { type: "p", text: "The calendar shows your scheduled and published posts by day, in month or week view. Each post appears as a single chip with stacked platform icons and a status dot." },
      { type: "p", text: "Click an empty day to start a post for that date, or click a chip to open it. Drafts (with no scheduled time) don't appear on the calendar." },
    ],
  },
  {
    slug: "bulk-import",
    title: "Bulk importing posts from CSV",
    category: "posting",
    excerpt: "Create many posts at once by uploading a spreadsheet.",
    body: [
      { type: "p", text: "Bulk Import turns a CSV into many posts in one step. Upload or paste your file, validate it to preview every row, then import." },
      { type: "h", text: "Columns" },
      { type: "code", text: "caption,type,platforms,date,time,media_url" },
      { type: "ul", items: [
        "caption — the post text (required).",
        "type — text, image, video, or story (defaults to text).",
        "platforms — platform names like \"x, linkedin\"; leave blank to use your default accounts.",
        "date / time — used in Schedule mode, interpreted in your timezone.",
        "media_url — a link to an image or video for media posts.",
      ] },
      { type: "h", text: "Modes" },
      { type: "ul", items: [
        "Save as drafts — create drafts to finish later.",
        "Schedule — each row needs a date and time.",
        "Add to queue — fill your next open queue slots in order.",
      ] },
      { type: "p", text: "The preview flags any invalid rows with a reason; only valid rows are imported, and you can download a sample CSV to start from." },
    ],
  },
  {
    slug: "publishing",
    title: "How publishing works (and retries)",
    category: "posting",
    excerpt: "What happens after you hit publish, and how failures are handled.",
    body: [
      { type: "p", text: "When a post goes out, Spanly publishes to each selected account independently and shows a live progress screen with a result card per account." },
      { type: "h", text: "If a target fails" },
      { type: "p", text: "A failed account shows the error and a Retry button. Retrying only re-sends the failed account — accounts that already succeeded are never re-posted, so you can't accidentally double-post." },
      { type: "p", text: "If an account's access expired, you'll see a Reconnect prompt instead; reconnect it and retry." },
    ],
  },

  // ─────────────────────────── Media & limits ───────────────────────────
  {
    slug: "media-upload-limits",
    title: "Video and image upload limits",
    category: "media",
    excerpt: "Supported formats and the per-platform video length caps.",
    body: [
      { type: "p", text: "Upload images and videos directly in the composer. Each platform caps video length, so the same clip may be fine on one network and too long on another:" },
      { type: "ul", items: [
        "X — up to ~140 seconds.",
        "YouTube (Shorts-style) — up to ~60 seconds.",
        "Instagram — up to ~90 seconds.",
        "TikTok — up to ~10 minutes.",
        "LinkedIn — up to ~10 minutes.",
        "Facebook — up to ~20 minutes.",
      ] },
      { type: "p", text: "If a video exceeds a selected platform's limit, you'll see an error before the post goes out — trim it or deselect that platform." },
    ],
  },
  {
    slug: "image-sizes",
    title: "Image sizes and cropping",
    category: "media",
    excerpt: "How aspect ratios are handled across platforms.",
    body: [
      { type: "p", text: "Different platforms favor different aspect ratios — square and portrait for Instagram and TikTok, landscape for YouTube, and flexible ratios for X, Facebook, and LinkedIn." },
      { type: "p", text: "Some platforms crop images that don't match their preferred ratio. To keep the important part of an image visible everywhere, use a centered composition or upload a version sized for the platform that matters most." },
    ],
  },
  {
    slug: "limits-by-platform",
    title: "Caption and media limits by platform",
    category: "media",
    excerpt: "A quick reference table for every supported platform.",
    body: [
      { type: "p", text: "Spanly enforces each platform's limits when you publish. For reference:" },
      { type: "ul", items: [
        "X — 280-character caption, up to 4 media.",
        "LinkedIn — 3,000-character caption, up to 9 media.",
        "Facebook — 5,000-character caption, up to 10 media.",
        "Instagram — 2,200-character caption, up to 10 media (stories: 1).",
        "TikTok — 2,200-character caption, up to 35 media.",
        "YouTube — 5,000-character caption, a single video.",
      ] },
      { type: "p", text: "When several platforms are selected, the composer's character counter uses the strictest caption limit among them." },
    ],
  },

  // ─────────────────────────── Account & billing ───────────────────────────
  {
    slug: "billing",
    title: "Plans, billing, and the API add-on",
    category: "account-billing",
    excerpt: "Pricing, account limits, trials, and the API add-on.",
    body: [
      { type: "h", text: "Plans" },
      { type: "ul", items: [
        "Creator — $29/mo, up to 15 connected accounts.",
        "Growth — $49/mo, up to 50 connected accounts.",
        "Pro — $99/mo, unlimited connected accounts.",
      ] },
      { type: "p", text: "Plans are billed by the number of connected accounts. Every plan starts with a 7-day trial, and there's a 7-day money-back window." },
      { type: "h", text: "API add-on" },
      { type: "p", text: "Programmatic access (API keys, webhooks, and the MCP server) is a $5/mo add-on you can enable from Billing." },
    ],
  },
  {
    slug: "change-plan",
    title: "Changing or downgrading your plan",
    category: "account-billing",
    excerpt: "Upgrade, downgrade, and what happens to your accounts.",
    body: [
      { type: "p", text: "Open Settings → Plans to switch plans or toggle between monthly and yearly billing. Upgrades take effect immediately so you can connect more accounts." },
      { type: "h", text: "Downgrading below your account count" },
      { type: "p", text: "If a downgrade would leave you with more connected accounts than the new plan allows, nothing is deleted — your accounts stay connected. You simply can't add new ones until you're under the new limit, and the Plans screen shows an over-limit notice." },
    ],
  },
  {
    slug: "cancel-subscription",
    title: "Cancelling your subscription or trial",
    category: "account-billing",
    excerpt: "Stop future billing while keeping access until the period ends.",
    body: [
      { type: "p", text: "Go to Settings → Billing and open Manage subscription to cancel. Cancelling stops future charges; you keep access until the end of the current billing period or trial." },
      { type: "p", text: "Your posts, drafts, and connected accounts remain in your account if you resubscribe later." },
    ],
  },
  {
    slug: "refund",
    title: "Requesting a refund",
    category: "account-billing",
    excerpt: "How the 7-day money-back window works.",
    body: [
      { type: "p", text: "Spanly offers a 7-day money-back window on new subscriptions. To request a refund, open Settings → Billing and choose Request refund." },
      { type: "ol", items: [
        "If you're within 7 days of the charge, Spanly records your request and notifies support to process it.",
        "If you're outside the window, the request is declined with an explanation.",
      ] },
      { type: "p", text: "You'll get a confirmation either way." },
    ],
  },
  {
    slug: "account-email",
    title: "Fixing or changing your email address",
    category: "account-billing",
    excerpt: "Update the email you use to sign in.",
    body: [
      { type: "p", text: "If you mistyped your email at signup or simply want to change it, open Settings → General → Email Address and choose Change Email." },
      { type: "ol", items: [
        "Enter the new email and your current password.",
        "We send a confirmation link to the new address.",
        "Click the link to confirm — your sign-in email updates once verified.",
      ] },
    ],
  },
  {
    slug: "billing-troubleshooting",
    title: "Billing problems: double charges and access after payment",
    category: "account-billing",
    excerpt: "What to do if a payment didn't unlock your account.",
    body: [
      { type: "p", text: "If you were charged but your plan didn't activate, first sign out and back in — the subscription state refreshes on sign-in. Then check Settings → Billing to confirm the plan and status." },
      { type: "p", text: "If you see a duplicate charge or the plan still isn't active, contact support at support@spanly.app with the email on your account and we'll sort it out, including reversing any duplicate." },
    ],
  },

  // ─────────────────────────── Troubleshooting ───────────────────────────
  {
    slug: "troubleshooting",
    title: "Troubleshooting failed posts",
    category: "troubleshooting",
    excerpt: "Common reasons a post fails and how to fix it.",
    body: [
      { type: "h", text: "An account shows 'expired'" },
      { type: "p", text: "The platform revoked access (often after a password change). Reconnect the account from Connections, then retry the failed target." },
      { type: "h", text: "Caption or media rejected" },
      { type: "p", text: "The post likely exceeded a platform's caption length or media count. Check the limits, edit the post, and retry." },
      { type: "h", text: "A scheduled post didn't go out" },
      { type: "p", text: "Make sure the scheduled time was in the future when you saved it. Spanly automatically recovers missed runs, so a brief delay usually resolves on its own." },
    ],
  },
  {
    slug: "connection-errors",
    title: "Fixing account connection and 'expired' errors",
    category: "troubleshooting",
    excerpt: "When a platform reports an invalid session or revoked access.",
    body: [
      { type: "p", text: "Connections can break when you change your social password, revoke Spanly's access on the platform, or the platform's token simply expires." },
      { type: "ol", items: [
        "Open Connections and find the affected account.",
        "Click Reconnect and complete the authorization again.",
        "Return to any failed post and choose Retry.",
      ] },
      { type: "p", text: "Reconnecting reuses the same account slot, so it won't count against your plan limit." },
    ],
  },
  {
    slug: "login-issues",
    title: "Login and email verification issues",
    category: "troubleshooting",
    excerpt: "Can't sign in, reset a password, or verify your email.",
    body: [
      { type: "h", text: "Forgot your password" },
      { type: "p", text: "On the login screen choose Forgot password. We email a reset link; opening it lets you set a new password and signs out other sessions." },
      { type: "h", text: "Didn't get the verification or reset email" },
      { type: "p", text: "Check spam, and confirm you used the right address. You can resend from the login or settings screens." },
      { type: "h", text: "Sign out everywhere" },
      { type: "p", text: "If you think someone else has access, use Settings → General → Security → Sign Out All Devices to invalidate every active session." },
    ],
  },

  // ─────────────────────────── Developers ───────────────────────────
  {
    slug: "api-keys",
    title: "API keys and the public API",
    category: "developers",
    excerpt: "Create keys and call the Spanly API programmatically.",
    body: [
      { type: "p", text: "With the API add-on enabled, create a key under API Keys. The full key is shown once at creation — copy it then; afterwards only a masked preview is stored." },
      { type: "h", text: "Authenticating" },
      { type: "p", text: "Send your key as a bearer token:" },
      { type: "code", text: "Authorization: Bearer spb_live_…" },
      { type: "h", text: "Endpoints" },
      { type: "ul", items: [
        "GET /api/v1/me — your account and plan.",
        "GET /api/v1/accounts — your connected accounts.",
        "POST /api/v1/posts — create and publish or schedule a text post.",
      ] },
      { type: "p", text: "Revoke a key at any time from the same screen; revoked keys stop working immediately." },
    ],
  },
  {
    slug: "webhooks",
    title: "Post-completion webhooks",
    category: "developers",
    excerpt: "Get notified when a post finishes publishing.",
    body: [
      { type: "p", text: "Set a webhook URL under API Keys. When a post reaches a final state, Spanly sends a signed POST to your URL with the post and per-account results." },
      { type: "h", text: "Verifying the signature" },
      { type: "p", text: "Each delivery includes an HMAC-SHA256 signature of the raw body in the X-Spanly-Signature header. Compute the same HMAC with your signing secret and compare to verify the request is genuinely from Spanly." },
      { type: "p", text: "Each post is delivered once. A slow or failing endpoint never blocks or delays publishing." },
    ],
  },
  {
    slug: "mcp",
    title: "Connecting Spanly to Claude (MCP)",
    category: "developers",
    excerpt: "Manage Spanly from an AI agent via the MCP server.",
    body: [
      { type: "p", text: "Spanly exposes a Model Context Protocol (MCP) server so AI agents can list your accounts and create posts on your behalf. It uses the same API-key authentication as the public API, so it requires the API add-on." },
      { type: "h", text: "Endpoint" },
      { type: "p", text: "Add this Streamable-HTTP MCP endpoint to your client (the exact URL is shown in Settings → General):" },
      { type: "code", text: "POST {your-app-url}/api/mcp\nAuthorization: Bearer spb_live_…" },
      { type: "h", text: "Available tools" },
      { type: "ul", items: [
        "list_accounts — your connected accounts.",
        "create_post — publish or schedule a text post.",
        "get_post_status — check a post's per-account results.",
      ] },
      { type: "p", text: "Create an API key under API Keys, enable the API add-on if you haven't, and point your MCP client at the endpoint with the key as a bearer token." },
    ],
  },
];

export function getHelpArticle(slug: string): HelpArticle | undefined {
  return HELP_ARTICLES.find((a) => a.slug === slug);
}

export function articlesByCategory(category: HelpCategory): HelpArticle[] {
  return HELP_ARTICLES.filter((a) => a.category === category);
}
