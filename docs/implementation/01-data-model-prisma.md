# 01 — Data Model (Prisma Schema)

## Goal
The authoritative database schema for MVP. This is a **contract**: services, API handlers,
and UI all conform to it. `workspaceId` is included on owned entities now (nullable / single
default workspace) so multi-workspace can be enabled later without a migration of intent.

## Design notes
- One **User** has one **Subscription**, many **SocialAccount**, **Post**, **Media**,
  **QueueSlot**.
- A **Post** fans out to many **PostTarget** (one per selected social account) — this is what
  powers per-platform success/failure result cards and retries.
- Media attaches to posts via **PostMedia** (ordered many-to-many).
- OAuth tokens live in **SocialAccount.encryptedTokens** (AES-256-GCM; never plaintext).
- Enums encode the state machines used across `06`/`08`/`09`.

## `prisma/schema.prisma`
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─────────────────────────── Enums ───────────────────────────
enum Platform {
  facebook
  instagram
  linkedin
  tiktok
  youtube
  x
}

enum AccountStatus {
  active
  expired
  error
}

enum PostType {
  text
  image
  video
  story
}

enum PostStatus {
  draft
  scheduled
  publishing
  posted
  failed
}

enum ScheduleMode {
  now
  time
  queue
}

enum TargetStatus {
  pending
  publishing
  success
  failed
}

enum MediaKind {
  image
  video
  pdf
}

enum PlanKey {
  creator
  growth
  pro
}

enum BillingInterval {
  month
  year
}

enum SubscriptionStatus {
  trialing
  active
  past_due
  paused
  canceled
}

enum IgConnectMethod {
  instagram
  facebook
}

// ─────────────────────────── Core ────────────────────────────
model User {
  id            String   @id @default(cuid())
  email         String   @unique
  passwordHash  String
  displayName   String?
  avatarUrl     String?
  timezone      String   @default("UTC")
  emailVerified DateTime?

  // settings (doc 11A): email + platform prefs, weekly goal, mcp
  settings      Json     @default("{}")

  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  subscription  Subscription?
  accounts      SocialAccount[]
  posts         Post[]
  media         Media[]
  queueSettings QueueSettings?
  sessions      Session[]
}

// Auth.js session table (Credentials + DB sessions). Token version
// enables "sign out of all devices".
model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}

model Subscription {
  id               String             @id @default(cuid())
  userId           String             @unique
  plan             PlanKey            @default(creator)
  interval         BillingInterval    @default(month)
  status           SubscriptionStatus @default(trialing)
  trialEndsAt      DateTime?
  currentPeriodEnd DateTime?
  apiAddonActive   Boolean            @default(false)
  stripeCustomerId String?
  stripeSubId      String?
  createdAt        DateTime           @default(now())
  updatedAt        DateTime           @updatedAt

  user             User               @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model SocialAccount {
  id              String         @id @default(cuid())
  userId          String
  platform        Platform
  handle          String                         // @name shown on chips
  displayName     String?
  avatarUrl       String?
  externalId      String                         // provider's user/page id
  pageId          String?                        // Meta Page id when applicable
  igConnectMethod IgConnectMethod?
  status          AccountStatus  @default(active)
  capabilities    String[]                       // ['text','image','video','story']
  scopes          String[]
  encryptedTokens String                         // AES-256-GCM blob (access+refresh+expiry)
  tokenExpiresAt  DateTime?
  connectedAt     DateTime       @default(now())
  updatedAt       DateTime       @updatedAt

  user            User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  targets         PostTarget[]

  @@unique([userId, platform, externalId])
  @@index([userId, platform])
}

model Post {
  id            String       @id @default(cuid())
  userId        String
  type          PostType
  mainCaption   String       @default("")
  // map socialAccountId -> caption override (doc 06)
  perPlatform   Json         @default("{}")
  status        PostStatus   @default(draft)
  scheduleMode  ScheduleMode @default(now)
  publishAt     DateTime?                    // UTC; null for now/draft
  timezone      String       @default("UTC")
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt
  publishedAt   DateTime?

  user          User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  targets       PostTarget[]
  media         PostMedia[]

  @@index([userId, status])
  @@index([status, publishAt])             // scheduler "due posts" query
}

model PostTarget {
  id              String        @id @default(cuid())
  postId          String
  socialAccountId String
  status          TargetStatus  @default(pending)
  caption         String                    // resolved caption used for THIS account
  externalPostId  String?
  externalUrl     String?
  error           String?
  attempts        Int           @default(0)
  // idempotency key so retries never double-post (doc 08)
  idempotencyKey  String        @unique
  publishedAt     DateTime?

  post            Post          @relation(fields: [postId], references: [id], onDelete: Cascade)
  account         SocialAccount @relation(fields: [socialAccountId], references: [id], onDelete: Cascade)

  @@index([postId])
  @@index([status])
}

model Media {
  id           String      @id @default(cuid())
  userId       String
  kind         MediaKind
  url          String
  thumbnailUrl String?
  width        Int?
  height       Int?
  durationSec  Float?
  sizeBytes    Int?
  mimeType     String?
  processed    Boolean     @default(false)   // server-side re-encode done
  createdAt    DateTime    @default(now())

  user         User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  posts        PostMedia[]

  @@index([userId])
}

model PostMedia {
  postId  String
  mediaId String
  order   Int

  post    Post  @relation(fields: [postId], references: [id], onDelete: Cascade)
  media   Media @relation(fields: [mediaId], references: [id], onDelete: Cascade)

  @@id([postId, mediaId])
  @@index([postId])
}

// Queue (doc 11B): slots that "Add to queue" fills.
model QueueSettings {
  id                    String      @id @default(cuid())
  userId                String      @unique
  timezone              String      @default("UTC")
  randomizeWithinMinutes Int        @default(0)
  slots                 QueueSlot[]
  user                  User        @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model QueueSlot {
  id         String        @id @default(cuid())
  settingsId String
  time       String                       // "HH:mm" 24h
  days       Boolean[]                     // length 7, Mon..Sun
  settings   QueueSettings @relation(fields: [settingsId], references: [id], onDelete: Cascade)

  @@index([settingsId])
}

// Single-use tokens for email verification + password reset (doc 03).
model VerificationToken {
  id        String   @id @default(cuid())
  userId    String
  type      String                         // 'verify_email' | 'reset_password'
  token     String   @unique
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime @default(now())

  @@index([userId, type])
}
```

## Capabilities reference (used to filter the composer account row, doc 06)
| Platform | text | image | video | story |
|---|---|---|---|---|
| X | ✅ | ✅ | ✅ | — |
| LinkedIn | ✅ | ✅ | ✅ | — |
| Facebook | ✅ | ✅ | ✅ | — |
| Instagram | — | ✅ | ✅ | ✅ |
| TikTok | — | ✅ | ✅ | — |
| YouTube | — | — | ✅ | — |

> Capabilities are also encoded per-provider in `02`. The DB column is the per-account copy
> (a provider could expose fewer caps for a given account type).

## Migrations & seed
- `npx prisma migrate dev --name init`.
- `prisma/seed.ts` creates: one demo user (`demo@spanly.app` / `password`), a `creator`
  trialing subscription, 6 mock `SocialAccount` rows (one per platform), default
  `QueueSettings` with two slots (11:00, 16:00, Mon–Fri).

## Acceptance criteria
- Schema migrates cleanly; `prisma studio` shows all tables.
- Seed produces a fully usable demo account (can compose + schedule against mock accounts).
- `@@index([status, publishAt])` exists (scheduler depends on it).
- `PostTarget.idempotencyKey` is unique (publish safety).

## Verification
1. `npx prisma migrate reset` → migrates + seeds without error.
2. In Prisma Studio, confirm the demo user has 6 accounts and a subscription.
3. Query `SELECT * FROM "Post" WHERE status='scheduled' AND "publishAt" < now()` plan uses
   the composite index (`EXPLAIN`).
