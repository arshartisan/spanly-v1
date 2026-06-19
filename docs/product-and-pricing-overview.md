# Spanlyfy — Product & Pricing Overview

> **Purpose of this document**
> A single, complete picture of what Spanlyfy is and does today, structured so you can
> benchmark it feature-by-feature against competitors (Buffer, Hootsuite, Later,
> Publer, SocialBee, Metricool, Sprout Social, etc.) and finalize plan tiers and pricing.
>
> Last updated: 2026-06-18

---

## 1. What Spanlyfy Is

Spanlyfy is a **multi-platform social media scheduler and publisher**. Users compose
content once and publish or schedule it across six social networks from a single
dashboard, with per-platform caption customization, reliable exactly-once publishing,
and tools for planning at scale (calendar, recurring queue, bulk import).

**Core promise:** *Write once, publish everywhere, on schedule, reliably.*

**Supported platforms (6):** Facebook · Instagram · LinkedIn · TikTok · YouTube · X (Twitter)

**Billing model:** Account-based — each plan caps how many connected social accounts a
user can have. This is the primary lever for tier differentiation.

**Tech foundation (for reliability claims):** Next.js (App Router), PostgreSQL/Prisma,
Redis + BullMQ for the publishing worker, S3-compatible media storage, PayPal billing.

---

## 2. Feature Inventory (current state)

Legend: ✅ Shipped · 🔄 In progress / foundation laid · ❌ Planned / not built

### 2.1 Account & Authentication
| Feature | Status | Notes |
|---|---|---|
| Email/password signup & login | ✅ | bcrypt, DB-backed sessions (not JWT) |
| Google OAuth ("Continue with Google") | ✅ | |
| Email verification | ✅ | 6-digit OTP flow |
| Password reset | ✅ | Single-use hashed tokens |
| MFA / step-up auth on new device | ✅ | OTP + 30-day trusted-device exemption |
| Session management ("sign out all devices") | ✅ | Opaque httpOnly token |
| Timezone per user | ✅ | Applied across calendar/queue/scheduling |

### 2.2 Connections (social accounts)
| Feature | Status | Notes |
|---|---|---|
| Connect 6 platforms via OAuth | ✅ | FB, IG, LinkedIn, TikTok, YouTube, X |
| Instagram dual-connect (IG login or FB Page) | ✅ | |
| Encrypted token storage (AES-256-GCM) | ✅ | |
| Auto token refresh | ✅ | Marks account expired if unrecoverable |
| Soft-delete / reconnect (preserves history) | ✅ | No duplicate seats on reconnect |
| Account-limit enforcement per plan | ✅ | Core monetization gate |
| **Live publishing to real platforms** | 🔄 | Per-platform phase-in; MockProvider used in earlier phases |

> ⚠️ **Pricing-critical:** Confirm how many of the 6 platforms publish to **live** APIs
> today vs. still on mock. Competitors price on real, working integrations.

### 2.3 Composition & Scheduling
| Feature | Status | Notes |
|---|---|---|
| Post types: text, image, video, story | ✅ | |
| Multi-account targeting (capability-filtered) | ✅ | Only shows accounts that support the type |
| Per-platform caption overrides | ✅ | Main caption + per-platform tabs |
| Smart character counter | ✅ | Respects strictest selected platform |
| Media upload (drag/drop/paste, presigned S3) | ✅ | |
| Media library | ✅ | Tracks dimensions, duration, size, processed flag |
| Post now / pick a time / add to queue / draft | ✅ | |
| Edit, duplicate, delete, reschedule | ✅ | |

### 2.4 Planning at scale
| Feature | Status | Notes |
|---|---|---|
| Calendar (month + week views) | ✅ | DST-safe, platform filters, click-to-create |
| Post lists with filters (all/scheduled/posted/drafts) | ✅ | Sort, platform, type filters |
| Recurring queue (weekly time slots) | ✅ | Randomize window, DST-aware, no collisions |
| Bulk import via CSV | ✅ | Validate → commit, 3 modes (draft/schedule/queue) |
| Sample CSV download | ✅ | |

### 2.5 Publishing reliability (a real differentiator)
| Feature | Status | Notes |
|---|---|---|
| Exactly-once publishing (idempotency keys) | ✅ | Never double-posts |
| Async job dispatch via BullMQ worker | ✅ | |
| Auto-retry with exponential backoff | ✅ | Up to 5 attempts |
| Missed-run recovery sweep | ✅ | 60s maintenance re-enqueues due posts |
| Per-target status + error tracking | ✅ | Stores external post ID/URL on success |
| Retry single target / retry all failed | ✅ | Safe — never re-posts successes |
| Real-time publishing progress screen | ✅ | Per-account result cards |

### 2.6 Analytics
| Feature | Status | Notes |
|---|---|---|
| Analytics dashboard | 🔄 | UI shell + data model ready; **no live metrics yet** |

> ⚠️ **Pricing-critical gap.** Analytics is a major buying factor and tiering lever for
> every competitor. Currently a placeholder. This is the #1 thing to weigh before
> charging premium prices.

### 2.7 Developer / integrations
| Feature | Status | Notes |
|---|---|---|
| Public REST API (`/api/v1/*`) | ✅ | Bearer tokens, hashed keys, one-time reveal |
| MCP server (AI agent tooling) | ✅ | list_accounts, create_post, get_post_status |
| Webhooks (post-completion callbacks) | ✅ | HMAC-SHA256 signed |
| API access gated as paid add-on | ✅ | ~$5/mo add-on |

> The **MCP server** is a genuine differentiator — very few competitors expose native
> AI-agent tooling. Worth highlighting in positioning.

### 2.8 Support & self-serve
| Feature | Status | Notes |
|---|---|---|
| Help center (36 articles, searchable) | ✅ | |
| Transactional + newsletter email | ✅ | Branded templates, one-click unsubscribe |
| In-app announcements/banners | ✅ | Targetable by audience/plan |

### 2.9 Admin / staff operations (internal)
| Feature | Status | Notes |
|---|---|---|
| Role-based admin dashboard | ✅ | user/support/admin/superadmin |
| User management + suspend + impersonation | ✅ | Audited |
| Subscription & plan overrides | ✅ | |
| Refund request queue | ✅ | |
| Content moderation | ✅ | |
| Admin-editable plan catalog | ✅ | Change tiers/prices without redeploy |
| Feature flags, platform config, announcements | ✅ | |
| Job queue / webhook / system health tools | ✅ | |
| Immutable audit log | ✅ | |

### 2.10 Not built yet (notable gaps vs. market)
| Missing feature | Competitors that have it |
|---|---|
| **Live analytics & reporting** | All major players |
| **Team / workspace collaboration** (multi-user, roles, approvals) | Hootsuite, Sprout, SocialBee, Publer |
| **Approval workflows / client management** | Sprout, SocialBee, agencies tools |
| **Social inbox / engagement (comments, DMs)** | Hootsuite, Sprout, Metricool |
| **Link-in-bio / landing page** | Later, Buffer |
| **AI content generation / caption assistant** | Buffer, Publer, SocialBee, Metricool |
| **Hashtag suggestions / first-comment** | Most |
| **More platforms** (Pinterest, Threads, Bluesky, Google Business, Mastodon) | Publer, Metricool, Buffer |
| **Best-time-to-post recommendations** | Later, Buffer, Sprout |

---

## 3. Current Plan Tiers (as built)

These are the tiers defined in the code today. Treat them as a **starting draft**, not final.

| | **Creator** | **Growth** | **Pro** |
|---|---|---|---|
| **Monthly** | $29 | $49 | $99 |
| **Yearly** | $319 (~$26.6/mo) | $529 (~$44/mo) | $1069 (~$89/mo) |
| **Connected accounts** | 15 | 50 | Unlimited |
| Unlimited posts | ✅ | ✅ | ✅ |
| Schedule & queue | ✅ | ✅ | ✅ |
| Carousels / bulk tools | ✅ | ✅ | ✅ |
| Content studio | ✅ | ✅ | ✅ |
| Analytics (beta) | ✅ | ✅ | ✅ |
| API add-on available | ✅ | ✅ | ✅ |
| Viral content tools | — | ✅ | ✅ |
| Priority support | — | ✅ | ✅ |
| Viral consulting | — | — | ✅ |
| Team members (later) | — | — | ✅ (planned) |

**Cross-cutting:**
- 7-day free trial
- 7-day money-back guarantee
- API access as a paid add-on (~$5/mo)
- Billing via PayPal (mock mode for dev/testing)

> ⚠️ **Reality check on the tiers:** The account limits are unusually high for the price
> (15 accounts at $29 is generous vs. market — Buffer/Later often cap entry plans at a
> handful of channels). The tiers differentiate mostly on **account count + soft
> "viral"/support perks** rather than on hard features. Before finalizing, decide whether
> your moat is **price-per-account** (undercut the market) or **feature depth** (match it).

---

## 4. Competitor Benchmarking Framework

Use this template when you compare Spanlyfy to each rival. Fill one column per competitor.

### 4.1 Comparison matrix (copy per competitor)
| Dimension | Spanlyfy | Competitor A | Competitor B |
|---|---|---|---|
| Entry price / mo | $29 | | |
| Channels on entry plan | 15 | | |
| Price per extra channel | n/a (tiered) | | |
| # supported platforms | 6 | | |
| Posts limit | Unlimited | | |
| Scheduling + queue | ✅ | | |
| Bulk upload | ✅ | | |
| Calendar | ✅ | | |
| **Analytics depth** | 🔄 none live | | |
| **Engagement / inbox** | ❌ | | |
| **AI caption tools** | ❌ | | |
| **Team / approvals** | ❌ | | |
| Link-in-bio | ❌ | | |
| API access | ✅ (add-on) | | |
| AI-agent / MCP | ✅ (rare) | | |
| Publishing reliability claims | ✅ strong | | |
| Free plan | ❌ (trial only) | | |

### 4.2 Suggested competitor set
- **Budget / SMB:** Buffer, Publer, SocialBee, Metricool
- **Mid-market / agency:** Later, Sprout Social, Hootsuite
- **AI-first newcomers:** worth scanning for AI-generation parity

### 4.3 Questions the comparison should answer
1. At $29 with 15 accounts, are we **underpricing**? (Likely yes vs. market — confirm.)
2. Which **missing features** (analytics, AI, inbox, teams) are *table stakes* vs. *premium*?
3. Do competitors gate by **channels, users, posts, or features**? Match the axis buyers expect.
4. Is there room for a **Free** tier or a cheaper **Starter** to capture top-of-funnel?
5. What justifies the **Pro** jump to $99 if it's mostly "consulting + unlimited accounts"?

---

## 5. Pricing Decision Worksheet

Fill these in after the competitor scan to lock down final plans.

### 5.1 Open decisions
- [ ] **Pricing axis:** accounts only, or accounts + features + seats?
- [ ] **Free tier:** yes/no? (e.g., 1–2 accounts, limited scheduling)
- [ ] **Starter tier:** add a sub-$29 entry point?
- [ ] **Account limits per tier:** keep generous (15/50/∞) or tighten to match market?
- [ ] **Analytics:** is it a tier gate, an add-on, or required-for-launch baseline?
- [ ] **AI features:** build before charging premium? Add-on or bundled?
- [ ] **Team/workspaces:** make this the real "Pro/Business" justification?
- [ ] **API add-on price:** keep at ~$5/mo or bundle into top tier?
- [ ] **Annual discount:** standardize the % (currently varies per tier).
- [ ] **Trial length / refund window:** keep 7 + 7 days?

### 5.2 Proposed positioning hypotheses (to validate)
- **Hypothesis A — Price disruptor:** Lean into generous account limits, undercut Buffer/Later
  on price-per-channel, accept thinner features. Win on cost for multi-account creators/SMBs.
- **Hypothesis B — Feature parity:** Hold prices, but **build analytics + AI + teams** before
  raising tiers, so each plan maps to real capability gates buyers recognize.
- **Hypothesis C — Developer/AI niche:** Lean on the **API + MCP** edge; position as the
  "automation-friendly / AI-agent-ready" scheduler and charge for programmatic access.

### 5.3 Recommended next steps
1. Confirm **how many platforms publish live** today (this caps what you can honestly sell).
2. Run the §4 matrix for 5–6 named competitors.
3. Decide the **pricing axis** (§5.1) — everything else follows from it.
4. Decide whether **analytics** ships before monetizing premium tiers.
5. Re-draft the final tier table and update `src/lib/plan-defaults.ts` / admin plan catalog.

---

## 6. Strengths & Risks Summary (for the pitch)

**Strengths to lead with**
- Reliable, exactly-once publishing with auto-retry and missed-run recovery (engineering depth)
- Per-platform caption customization done well
- Strong planning tools: calendar + recurring queue + CSV bulk import
- Native **REST API + MCP** for automation/AI agents (rare in this market)
- Full self-serve admin/ops, refunds, audit — operationally mature for a young product

**Risks / gaps to close before premium pricing**
- **No live analytics** (biggest gap vs. every competitor)
- **No engagement/inbox**, **no AI generation**, **no team collaboration**
- Live publishing maturity per platform must be confirmed
- Only 6 platforms (several rivals support 8–12+)
- No free tier — relies on 7-day trial for acquisition

---

*Source: derived from the Spanlyfy codebase (Prisma schema, `src/server`, `src/app`,
`src/lib/plan-defaults.ts`, `src/lib/platforms.ts`, help content) as of 2026-06-18.*
