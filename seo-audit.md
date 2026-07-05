# 🔍 SEO Audit — Spanlyfy (spanlyfy.com)

**Date:** 2026-06-25
**Type:** SaaS (social-media scheduling tool)
**Stack:** Next.js 15 App Router / nginx / Polar billing
**Method:** Live HTTP inspection + full source-code review at `C:\Projects\spanly-v1` (every finding verified against actual files, not guessed)

> **Context that frames everything below:** This is a **pre-launch / day-one site**. The low scores are not a failing grade — they map the gap between "technically built" and "ready to earn organic traffic." The product is well-engineered; the SEO and content program is the work ahead.

---

## 📊 SEO Health Score: **34 / 100**

| Category | Weight | Score | Weighted |
|----------|:------:|:-----:|:--------:|
| Technical SEO | 22% | 31 | 6.8 |
| Content Quality | 23% | 31 | 7.1 |
| On-Page SEO | 20% | 35 | 7.0 |
| Schema / Structured Data | 10% | 15* | 1.5 |
| Performance (CWV) | 10% | 30 | 3.0 |
| AI Search Readiness | 10% | 45 | 4.5 |
| Images | 5% | 35 | 1.8 |
| **TOTAL** | | | **≈ 34** |

\* *Schema scored on the **live** site (zero JSON-LD). A subagent drafted the fix in the working tree during the audit — see the note below.*

---

## ⚠️ Uncommitted changes made during the audit

During this audit the schema subagent **created and edited 4 files** (it generates code by editing, not just suggesting). These are **local, uncommitted, and NOT live**:

```
?? src/components/schema/OrganizationSchema.tsx   (new)
?? src/components/schema/HomepageSchema.tsx        (new)
 M src/app/layout.tsx                              (added <OrganizationSchema/> in <head>)
 M src/app/(marketing)/page.tsx                    (added <HomepageSchema/>)
```

**Review before keeping.** Two things to verify:
1. The `SoftwareApplication` JSON-LD includes `Offer` prices ($29/$49/$99) but **no `aggregateRating`** — do not add fake ratings.
2. The agent placed `<OrganizationSchema/>` inside a manual `<head>` in the root layout — confirm it actually renders (Next.js App Router normally hoists `<script>` from the body; `git diff` and load the page to verify).

To discard: `git checkout src/app/layout.tsx src/app/(marketing)/page.tsx && rm -r src/components/schema`

---

## 🔴 Critical (fix before / at launch — blocks indexing or trust)

1. **`robots.txt` returns 404** — no `src/app/robots.ts`, no `public/robots.txt`. Crawlers get zero guidance.
2. **`sitemap.xml` returns 404** — no `src/app/sitemap.ts`. Google must rely on link discovery alone.
3. **Private routes have no `noindex`** — `grep` across `src/app` finds zero `robots`/`noindex` metadata. `/login`, `/signup`, `/forgot`, `/reset`, `/verify` all return 200 and are indexable. `/dashboard` 307-redirects to `/login`, which Google will then index. Wastes crawl budget on the auth shell.
4. **Hero image is a 1.47 MB raw PNG** — `HeroArt.tsx:8` → `/hero-emblem-3d.png`, served as `<img>` with `next/image` deliberately disabled via eslint-disable. It is the **LCP element** and is **preloaded on every page**. Will push mobile LCP into the "Poor" band. `next/image` would cut it to ~200–400 KB WebP/AVIF.
5. **Placeholder testimonials are live** — `Testimonials.tsx` ships three cards literally named **"Placeholder Name"**, and the source comment says *"do not ship fabricated attributions."* The "Loved by busy posters" section is currently **fabricated social proof** — a direct hit to Trust (Google QRG) and a potential FTC issue. **Remove or replace before launch.**
6. **No structured data on the live site** — zero JSON-LD (the draft fix is in the working tree, not deployed).

---

## 🟠 High (fix within ~1 week)

| # | Issue | Evidence |
|---|-------|----------|
| 7 | **No canonical tag** anywhere — root `layout.tsx` has no `metadataBase` or `alternates`, so Next can't build absolute canonicals | `src/app/layout.tsx` |
| 8 | **No Open Graph / Twitter Card** — links shared on social render bare. Ironic for a *social-media* tool | `src/app/layout.tsx` — no `openGraph`/`twitter` |
| 9 | **`Cache-Control: no-store` on the homepage** — caused by `getCurrentUser()` making the marketing page fully dynamic. (`/privacy` correctly returns `s-maxage=31536000`, so it's isolated to `/`.) Fix: move the auth-redirect into a `<Suspense>` child so the shell stays static/CDN-cacheable | live header + `(marketing)/page.tsx` |
| 10 | **No security headers** — no HSTS, CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy. `next.config.ts` has no `headers()` block | `next.config.ts` |
| 11 | **The entire organic surface is ONE page** — no blog, no `/pricing` URL (it's a `#pricing` anchor), no per-platform pages, no comparison pages. Can't build topical authority on a single URL against Buffer/Hootsuite/Later | route map |
| 12 | **Category keywords absent from body copy** — "social media scheduler", "Instagram scheduler", "schedule social media posts" appear in **no heading or paragraph**. Copy is punchy brand voice ("Schedule once. Publish everywhere.") that matches no search intent | source copy |
| 13 | **No contact / About / security page** — no email, no team, no "how we store your OAuth tokens" statement (critical when asking users to connect 6 social accounts) | route map |

**Verified positives (structural basics are sound):**
- ✅ Exactly **one true `<h1>`** (the "multiple H1s" was a misread — section eyebrows are styled `<p>` labels)
- ✅ Clean h1→h2 hierarchy
- ✅ Marketing page is **server-rendered** (Googlebot sees content without JS)
- ✅ Viewport + Tailwind responsive = mobile is the strongest area
- ✅ Full legal set (`terms`/`privacy`/`cookies`/`data-deletion`)

---

## 🟡 Medium (within ~1 month)

- **Move pricing to a standalone `/pricing` page** (keep `#pricing` as a secondary anchor) — currently no indexable pricing URL and can't rank for "Spanlyfy pricing."
- **Narrow `"use client"` boundaries** on `Pricing.tsx` / `FAQ.tsx` — content does SSR today, but extracting only the toggle/accordion into small client children is cleaner for indexing + INP.
- **Build the first per-platform page** — `/instagram-scheduler` has the highest search volume in this category; ideal first standalone page and best Expertise signal (platform-specific depth: aspect ratios, char limits, best post times).
- **Add an About page** — fastest single E-E-A-T win (founder name + origin paragraph + contact email).
- **Fix "Invite team members (later)"** in the public pricing table — "(later)" signals an unfinished product.

---

## 🟢 Low (backlog)

- `display: "swap"` on the Neue Machina display font → minor CLS on the hero headline. Consider `"optional"`/`"block"`.
- `X-Powered-By: Next.js` header exposed → add `poweredByHeader: false`.
- **IndexNow** not configured (low value at 5 pages; revisit once the blog exists).
- `llms.txt` missing → add once there is real content worth steering LLMs toward.

---

## 🤖 AI Search Readiness (GEO)

Tested live: **GPTBot, ClaudeBot, PerplexityBot, and Googlebot all get HTTP 200** — because there's no robots.txt, content is fully open to AI crawlers. Accidental, but advantageous for a brand-new SaaS.

> **⚠️ Conflict to resolve:** The technical agent's draft `robots.ts` **blocks** `GPTBot`, `Google-Extended`, and `CCBot`. For an unknown, pre-launch product that needs every discovery channel, the **recommendation is the opposite — keep AI crawlers open** so ChatGPT/Perplexity/AI Overviews can surface and cite the site. Only block them for a specific reason (e.g., not wanting content used for model *training* — in which case block `CCBot`/`Google-Extended` but **keep** `GPTBot`/`PerplexityBot`, which serve live answers). The `robots.ts` to ship should omit the AI-blocking rules.

AI-citation readiness itself is weak (~45): copy is short marketing fragments, not the definitions/lists/comparisons LLMs quote. The **FAQ is the one citable asset** — expand it.

---

## 🗺️ Prioritized Action Plan (dependency-sequenced)

### Phase 0 — Decide on the working-tree schema changes *(blocks nothing; do first)*
Review/keep or revert the 4 files the audit created. Verify the `<head>` injection renders.

### Phase 1 — Indexing foundation *(unblocks everything; ~1 day)*
1. Add `src/app/robots.ts` (AI crawlers **open** — recommended) + `src/app/sitemap.ts`
2. Add `robots: { index:false, follow:false }` to `(auth)`, `(app)`, `(admin)` layouts
3. Add `metadataBase` + `alternates.canonical` + `openGraph`/`twitter` to root `layout.tsx` (needs a `public/og-image.png`, 1200×630)

> *How you'll know it worked:* `curl https://spanlyfy.com/robots.txt` and `/sitemap.xml` return 200; GSC "Pages" shows the 5 public URLs indexed and the auth pages dropping out within ~2 weeks.

### Phase 2 — Performance + Security *(independent of Phase 1; same week)*
4. Swap hero `<img>` → `next/image` (`priority`, `fill`, `sizes`) + `images.formats:["image/avif","image/webp"]`
5. Add the `headers()` security block to `next.config.ts` (ship CSP in `report-only` first)
6. Move `getCurrentUser()` into a `<Suspense>` child to restore homepage caching

> *Leading indicator:* PageSpeed mobile LCP drops below 2.5 s; securityheaders.com grade goes from F → A.

### Phase 3 — Trust + Content surface *(depends on nothing technical; highest long-term ROI)*
7. **Remove/replace placeholder testimonials** (do this *before* any launch push)
8. Add About + contact email + a one-line security statement
9. Standalone `/pricing` page
10. First per-platform page (`/instagram-scheduler`), then comparison pages (`vs Buffer/Hootsuite/Later`), then a blog

> *Leading indicator:* GSC impressions begin appearing for non-branded queries ("instagram scheduler", "schedule tiktok posts") within 4–8 weeks of each page shipping.

**Highest-leverage takeaway:** the *technical* gaps are a few hours of code (robots/sitemap/metadata/image/headers). The *organic-growth* gap — one indexable page in one of the most competitive SaaS niches — is the real multi-month project. Ship Phase 1–2 this week; treat Phase 3 as the roadmap.

---

## 📎 Appendix — Ready-to-paste code

### `src/app/robots.ts` (recommended version — AI crawlers OPEN)

```ts
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.APP_URL ?? "https://spanlyfy.com";

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/privacy", "/terms", "/cookies", "/data-deletion"],
        disallow: [
          "/dashboard", "/calendar", "/bulk", "/create/", "/posts/",
          "/publishing/", "/connections", "/settings/", "/api-keys", "/help/",
          "/login", "/signup", "/forgot", "/reset", "/verify",
          "/admin/", "/billing/", "/connect/", "/api/",
        ],
      },
      // NOTE: AI crawlers intentionally left OPEN for GEO discovery.
      // To opt out of model *training* only, block CCBot + Google-Extended
      // but keep GPTBot + PerplexityBot (they serve live answers/citations).
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
```

### `src/app/sitemap.ts`

```ts
import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.APP_URL ?? "https://spanlyfy.com";

  return [
    { url: base, lastModified: new Date(), changeFrequency: "weekly", priority: 1.0 },
    { url: `${base}/privacy`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.3 },
    { url: `${base}/terms`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.3 },
    { url: `${base}/cookies`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.2 },
    { url: `${base}/data-deletion`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.1 },
  ];
}
```

### `noindex` for private layouts

Add to `src/app/(auth)/layout.tsx`, `src/app/(app)/layout.tsx`, and `src/app/(admin)/layout.tsx`:

```ts
import type { Metadata } from "next";
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};
```

### Root `layout.tsx` metadata (canonical + OG/Twitter)

```ts
export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? "https://spanlyfy.com"),
  title: "Spanlyfy - Social scheduling, simplified",
  description:
    "Schedule and publish content across Facebook, Instagram, LinkedIn, TikTok, YouTube, and X from one place.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "Spanlyfy",
    title: "Spanlyfy - Social scheduling, simplified",
    description:
      "Schedule and publish content across Facebook, Instagram, LinkedIn, TikTok, YouTube, and X from one place.",
    url: "/",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Spanlyfy - Social scheduling, simplified",
    description:
      "Schedule and publish content across Facebook, Instagram, LinkedIn, TikTok, YouTube, and X from one place.",
    images: ["/og-image.png"],
  },
};
```

### `next.config.ts` (security headers + image optimization)

```ts
import type { NextConfig } from "next";

const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self'",
      "connect-src 'self' https://api.polar.sh",
      "frame-ancestors 'none'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  serverExternalPackages: ["bullmq", "ioredis", "@prisma/client"],
  images: { formats: ["image/avif", "image/webp"] },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
```

> CSP note: ship `Content-Security-Policy-Report-Only` first, watch for violations, then switch to enforcing.

### Hero image → `next/image` (`src/components/marketing/HeroArt.tsx`)

```tsx
import Image from "next/image";
import heroEmblem from "../../../public/hero-emblem-3d.png";

export function HeroArt() {
  const mask = "radial-gradient(72% 76% at 52% 50%, #000 64%, transparent 100%)";

  return (
    <Image
      src={heroEmblem}
      alt="Spanlyfy 3D emblem"
      priority
      fill
      sizes="(max-width: 640px) 60vw, (max-width: 768px) 52vw, (max-width: 1024px) 46vw, 62vw"
      className="select-none object-contain object-center"
      style={{ WebkitMaskImage: mask, maskImage: mask }}
      draggable={false}
    />
  );
}
```

### Homepage caching fix (`src/app/(marketing)/page.tsx`)

```tsx
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth";

async function AuthRedirect() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");
  return null;
}

export default function Home() {
  return (
    <>
      <Suspense fallback={null}>
        <AuthRedirect />
      </Suspense>
      <Hero />
      {/* ...rest of sections... */}
    </>
  );
}
```
