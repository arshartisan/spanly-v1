import { z } from "zod";
import { PLATFORMS, PLATFORM_CONFIG, type PlatformKey } from "@/lib/platforms";
import { POST_TYPES, type PostTypeKey } from "@/lib/schemas/post";

/**
 * Bulk-import contracts (Phase 9). Isomorphic helpers shared by the API route, the bulk
 * service, and the client preview so CSV parsing/normalisation can't drift between them.
 * Per-account caption/media validation is delegated to validatePostTargets (server-side,
 * once accounts are resolved against the DB).
 */

export const BULK_MODES = ["draft", "schedule", "queue"] as const;
export type BulkMode = (typeof BULK_MODES)[number];

export const bulkOptionsSchema = z.object({
  mode: z.enum(BULK_MODES).default("draft"),
  // Accounts used for rows that don't name their own `platforms` column.
  defaultAccountIds: z.array(z.string().min(1)).default([]),
});

export const bulkValidateSchema = bulkOptionsSchema.extend({
  // Cap the payload so a giant paste can't exhaust memory; ~1MB is thousands of rows.
  csv: z.string().min(1).max(1_000_000),
});

export type BulkOptions = z.infer<typeof bulkOptionsSchema>;

/** Canonical CSV columns. Extra columns are ignored; only `caption` is structurally required. */
export const BULK_COLUMNS = ["caption", "type", "platforms", "date", "time", "media_url"] as const;

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

// platform key OR human label (lowercased) -> key, e.g. "x", "linkedin", "x (twitter)".
const PLATFORM_BY_TOKEN: Record<string, PlatformKey> = (() => {
  const map: Record<string, PlatformKey> = {};
  for (const key of PLATFORMS) {
    map[key] = key;
    map[PLATFORM_CONFIG[key].label.toLowerCase()] = key;
  }
  map["twitter"] = "x"; // common alias
  return map;
})();

/** Resolve one platform token (key or label) to a PlatformKey, or null if unknown. */
export function resolvePlatformToken(token: string): PlatformKey | null {
  return PLATFORM_BY_TOKEN[token.trim().toLowerCase()] ?? null;
}

/** Split a `platforms` cell on , ; or | into trimmed non-empty tokens. */
export function splitPlatforms(cell: string): string[] {
  return cell
    .split(/[,;|]/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

/** Parse the `type` cell. Empty defaults to "text"; unknown returns null. */
export function parseType(raw: string): PostTypeKey | null {
  const v = raw.trim().toLowerCase();
  if (v === "") return "text";
  return (POST_TYPES as readonly string[]).includes(v) ? (v as PostTypeKey) : null;
}

/** A single resolved/validated import row, returned to the client preview. */
export interface BulkRowResult {
  index: number; // 1-based data-row number (excludes the header)
  caption: string;
  type: PostTypeKey;
  platforms: PlatformKey[];
  accountIds: string[];
  mediaUrl: string | null;
  date: string | null;
  time: string | null;
  publishAtIso: string | null; // resolved UTC instant (schedule mode only)
  errors: string[];
  warnings: string[];
}

export interface BulkPreview {
  timezone: string;
  mode: BulkMode;
  headers: string[];
  rows: BulkRowResult[];
  summary: { total: number; valid: number; invalid: number };
}

export type BulkCommitRowOutcome = {
  index: number;
  ok: boolean;
  postId: string | null;
  status: string | null;
  error: string | null;
};

export interface BulkCommitResult {
  attempted: number;
  created: number;
  failed: number;
  rows: BulkCommitRowOutcome[];
}

/** A ready-to-download example file, surfaced in the UI. */
export const SAMPLE_CSV = [
  "caption,type,platforms,date,time,media_url",
  '"Hello world from Spanly 👋",text,"x,linkedin",,,',
  '"New blog post is live — link in bio",text,facebook,2026-06-20,09:30,',
  '"Behind the scenes shot",image,"instagram,facebook",2026-06-21,14:00,https://example.com/photo.jpg',
  '"Launch teaser",video,youtube,,,https://example.com/teaser.mp4',
].join("\n");
