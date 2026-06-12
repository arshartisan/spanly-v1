import "server-only";
import { prisma } from "@/server/db";
import { createDraft, schedulePost, addToQueue, deletePost } from "@/server/posts";
import { validatePostTargets } from "@/lib/schemas/post";
import { zonedTimeToUtc } from "@/server/queue-slots";
import { PLATFORM_CONFIG, type Capability, type PlatformKey } from "@/lib/platforms";
import {
  DATE_RE,
  TIME_RE,
  parseType,
  resolvePlatformToken,
  splitPlatforms,
  type BulkCommitResult,
  type BulkMode,
  type BulkOptions,
  type BulkPreview,
  type BulkRowResult,
} from "@/lib/schemas/bulk";
import { parseCsvWithHeader } from "@/lib/csv";

/**
 * Bulk-import service (Phase 9). Parses a CSV into many posts, reusing the exact composer
 * rules (validatePostTargets) and the same create/schedule/queue paths as the single-post
 * flow — so a bulk import can never bypass per-platform limits, capability checks, or the
 * future-time rule. `validate` is a pure preview (no writes); `commit` performs the writes.
 */

type ActiveAccount = { id: string; platform: PlatformKey; capabilities: Capability[]; handle: string };

async function loadContext(userId: string): Promise<{ timezone: string; accounts: ActiveAccount[] }> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { timezone: true } });
  const rows = await prisma.socialAccount.findMany({
    where: { userId, disconnectedAt: null, status: "active" },
    select: { id: true, platform: true, capabilities: true, handle: true },
  });
  return {
    timezone: user?.timezone ?? "UTC",
    accounts: rows.map((a) => ({
      id: a.id,
      platform: a.platform as PlatformKey,
      capabilities: a.capabilities as Capability[],
      handle: a.handle,
    })),
  };
}

/** Confirm the constructed instant's wall-clock in `tz` matches the requested Y-M-D (catches Feb 30 rollovers). */
function dateExistsInTz(y: number, m1: number, d: number, instant: Date, tz: string): boolean {
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return dtf.format(instant) === `${y}-${String(m1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Per-row resolution + validation shared by validate() and commit(). No DB writes. */
function resolveRow(
  rec: Record<string, string>,
  index: number,
  ctx: { timezone: string; accounts: ActiveAccount[] },
  mode: BulkMode,
  defaultAccountIds: string[],
  now: Date,
): BulkRowResult & { accountIds: string[]; accounts: ActiveAccount[]; publishAt: Date | null } {
  const errors: string[] = [];
  const warnings: string[] = [];

  const caption = (rec.caption ?? "").trim();
  const typeRaw = rec.type ?? "";
  const platformsCell = rec.platforms ?? "";
  let mediaUrl: string | null = (rec.media_url ?? "").trim() || null;
  const date = (rec.date ?? "").trim() || null;
  const time = (rec.time ?? "").trim() || null;

  const parsedType = parseType(typeRaw);
  const type = parsedType ?? "text";
  if (parsedType === null) errors.push(`Unknown type "${typeRaw.trim()}"`);

  // ── Resolve target accounts ──────────────────────────────────────────────
  let accountIds: string[] = [];
  let platforms: PlatformKey[] = [];

  if (platformsCell.trim() === "") {
    accountIds = ctx.accounts.filter((a) => defaultAccountIds.includes(a.id)).map((a) => a.id);
    if (accountIds.length === 0) {
      errors.push("No platforms column and no default accounts selected");
    }
  } else {
    const unknown: string[] = [];
    const keys = new Set<PlatformKey>();
    for (const tok of splitPlatforms(platformsCell)) {
      const key = resolvePlatformToken(tok);
      if (key) keys.add(key);
      else unknown.push(tok);
    }
    if (unknown.length > 0) errors.push(`Unknown platform(s): ${unknown.join(", ")}`);
    for (const key of keys) {
      const onPlatform = ctx.accounts.filter((a) => a.platform === key);
      if (onPlatform.length === 0) {
        errors.push(`No connected ${PLATFORM_CONFIG[key].label} account`);
      } else {
        accountIds.push(...onPlatform.map((a) => a.id));
      }
    }
  }

  const accounts = ctx.accounts.filter((a) => accountIds.includes(a.id));
  platforms = [...new Set(accounts.map((a) => a.platform))];

  // ── Media ────────────────────────────────────────────────────────────────
  let mediaCount = 0;
  if (type === "image" || type === "video" || type === "story") {
    if (!mediaUrl) errors.push(`${type} posts require a media_url`);
    else mediaCount = 1;
  } else if (mediaUrl) {
    warnings.push("media_url is ignored for text posts");
    mediaUrl = null;
  }

  // ── Per-account composer validation (caption limits, capability, story rules) ──
  if (accounts.length > 0) {
    const vErrors = validatePostTargets({
      type,
      mainCaption: caption,
      perPlatform: {},
      mediaCount,
      accounts: accounts.map((a) => ({ id: a.id, platform: a.platform, capabilities: a.capabilities })),
    });
    for (const ve of vErrors) {
      errors.push(`${PLATFORM_CONFIG[ve.platform].label}: ${ve.errors.join("; ")}`);
    }
  }

  // ── Schedule resolution ────────────────────────────────────────────────────
  let publishAt: Date | null = null;
  if (mode === "schedule") {
    if (!date || !time) {
      errors.push("Scheduled mode requires date and time");
    } else if (!DATE_RE.test(date)) {
      errors.push("date must be YYYY-MM-DD");
    } else if (!TIME_RE.test(time)) {
      errors.push("time must be HH:MM (24-hour)");
    } else {
      const [y, m, d] = date.split("-").map(Number);
      const [hh, mm] = time.split(":").map(Number);
      const instant = zonedTimeToUtc(y, m - 1, d, hh, mm, ctx.timezone);
      if (!dateExistsInTz(y, m, d, instant, ctx.timezone)) {
        errors.push("date is not a real calendar date");
      } else if (instant.getTime() <= now.getTime()) {
        errors.push("Scheduled time must be in the future");
      } else {
        publishAt = instant;
      }
    }
  } else if (date || time) {
    warnings.push(`date/time are ignored in ${mode} mode`);
  }

  return {
    index,
    caption,
    type,
    platforms,
    accountIds,
    accounts,
    mediaUrl,
    date,
    time,
    publishAt,
    publishAtIso: publishAt ? publishAt.toISOString() : null,
    errors,
    warnings,
  };
}

function summarize(rows: { errors: string[] }[]) {
  const valid = rows.filter((r) => r.errors.length === 0).length;
  return { total: rows.length, valid, invalid: rows.length - valid };
}

export type BulkAccount = { id: string; platform: PlatformKey; label: string; handle: string };

/** Active accounts for the default-account picker on the bulk page. */
export async function listBulkAccounts(userId: string): Promise<BulkAccount[]> {
  const { accounts } = await loadContext(userId);
  return accounts.map((a) => ({
    id: a.id,
    platform: a.platform,
    label: PLATFORM_CONFIG[a.platform].label,
    handle: a.handle,
  }));
}

/** Parse + validate a CSV without writing anything. */
export async function validateImport(
  userId: string,
  input: { csv: string } & BulkOptions,
): Promise<BulkPreview> {
  const ctx = await loadContext(userId);
  const { headers, records } = parseCsvWithHeader(input.csv);
  const now = new Date();
  const rows = records.map((rec, i) =>
    resolveRow(rec, i + 1, ctx, input.mode, input.defaultAccountIds, now),
  );
  // Project to the public shape, dropping internal-only fields (accounts, publishAt Date).
  const publicRows: BulkRowResult[] = rows.map((r) => ({
    index: r.index,
    caption: r.caption,
    type: r.type,
    platforms: r.platforms,
    accountIds: r.accountIds,
    mediaUrl: r.mediaUrl,
    date: r.date,
    time: r.time,
    publishAtIso: r.publishAtIso,
    errors: r.errors,
    warnings: r.warnings,
  }));
  return {
    timezone: ctx.timezone,
    mode: input.mode,
    headers,
    rows: publicRows,
    summary: summarize(publicRows),
  };
}

/** Validate, then create + dispatch every valid row. Invalid rows are skipped. */
export async function commitImport(
  userId: string,
  input: { csv: string } & BulkOptions,
): Promise<BulkCommitResult> {
  const ctx = await loadContext(userId);
  const { records } = parseCsvWithHeader(input.csv);
  const now = new Date();
  const rows = records.map((rec, i) =>
    resolveRow(rec, i + 1, ctx, input.mode, input.defaultAccountIds, now),
  );

  const outcomes: BulkCommitResult["rows"] = [];
  let created = 0;

  for (const row of rows) {
    if (row.errors.length > 0) continue; // only valid rows are committed

    let mediaRef: { mediaId: string; order: number }[] = [];
    let mediaId: string | null = null;
    if (row.mediaUrl) {
      const media = await prisma.media.create({
        data: { userId, kind: row.type === "video" ? "video" : "image", url: row.mediaUrl, processed: true },
      });
      mediaId = media.id;
      mediaRef = [{ mediaId: media.id, order: 0 }];
    }

    const draft = await createDraft(userId, {
      type: row.type,
      mainCaption: row.caption,
      perPlatform: {},
      targets: [],
      media: mediaRef,
    });

    // Dispatch according to the chosen mode. Draft mode leaves the post as a draft.
    let dispatchError: string | null = null;
    if (input.mode === "schedule" && row.publishAt) {
      const r = await schedulePost(userId, draft.id, row.accountIds, row.publishAt, ctx.timezone);
      if (!r.ok) dispatchError = typeof r.errors === "string" ? r.errors : "Validation failed";
    } else if (input.mode === "queue") {
      const r = await addToQueue(userId, draft.id, row.accountIds);
      if (!r.ok) dispatchError = typeof r.errors === "string" ? r.errors : "Validation failed";
    }

    if (dispatchError) {
      // Roll back the orphaned draft (and its media) so a failed dispatch leaves nothing behind.
      await deletePost(userId, draft.id);
      if (mediaId) await prisma.media.deleteMany({ where: { id: mediaId, userId } });
      outcomes.push({ index: row.index, ok: false, postId: null, status: null, error: dispatchError });
      continue;
    }

    created++;
    outcomes.push({
      index: row.index,
      ok: true,
      postId: draft.id,
      status: input.mode === "draft" ? "draft" : input.mode === "queue" ? "queued" : "scheduled",
      error: null,
    });
  }

  const attempted = rows.filter((r) => r.errors.length === 0).length;
  return { attempted, created, failed: attempted - created, rows: outcomes };
}
