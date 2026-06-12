import type { PostStatus, PostType } from "@prisma/client";

// Shared display helpers for posts lists + calendar (docs/implementation/07). Client-safe.

export const STATUS_META: Record<PostStatus, { label: string; badge: string; dot: string }> = {
  draft: { label: "Draft", badge: "bg-amber-500/10 text-amber-600", dot: "bg-amber-500" },
  scheduled: { label: "Scheduled", badge: "bg-blue-500/10 text-blue-600", dot: "bg-blue-500" },
  publishing: { label: "Publishing", badge: "bg-indigo-500/10 text-indigo-600", dot: "bg-indigo-500" },
  posted: { label: "Posted", badge: "bg-emerald-500/10 text-emerald-700", dot: "bg-emerald-500" },
  failed: { label: "Failed", badge: "bg-destructive/10 text-destructive", dot: "bg-destructive" },
};

export const TYPE_LABEL: Record<PostType, string> = {
  text: "Text",
  image: "Image",
  video: "Video",
  story: "Story",
};

export function snippet(text: string, max = 140): string {
  const clean = text.trim().replace(/\s+/g, " ");
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max).trimEnd()}…`;
}

export function formatDate(date: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function formatTime(date: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}
