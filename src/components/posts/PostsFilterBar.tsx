"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { PLATFORMS } from "@/lib/platforms";
import { PLATFORM_STYLE } from "@/lib/platform-style";
import { POST_TYPES } from "@/lib/schemas/post";
import { TYPE_LABEL } from "@/lib/post-display";

/** Filter bar for the posts lists (doc 07). URL-driven so the server page does the querying. */
export function PostsFilterBar() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function update(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (!value || value === "all") next.delete(key);
    else next.set(key, value);
    router.replace(`${pathname}?${next.toString()}`);
  }

  const select =
    "rounded-md border border-input bg-background px-2.5 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        className={select}
        value={params.get("sort") ?? "newest"}
        onChange={(e) => update("sort", e.target.value === "newest" ? "all" : e.target.value)}
      >
        <option value="newest">Newest first</option>
        <option value="oldest">Oldest first</option>
      </select>

      <select
        className={select}
        value={params.get("platform") ?? "all"}
        onChange={(e) => update("platform", e.target.value)}
      >
        <option value="all">All platforms</option>
        {PLATFORMS.map((p) => (
          <option key={p} value={p}>
            {PLATFORM_STYLE[p].label}
          </option>
        ))}
      </select>

      <select
        className={select}
        value={params.get("type") ?? "all"}
        onChange={(e) => update("type", e.target.value)}
      >
        <option value="all">All types</option>
        {POST_TYPES.map((t) => (
          <option key={t} value={t}>
            {TYPE_LABEL[t]}
          </option>
        ))}
      </select>

      <button
        type="button"
        onClick={() => router.refresh()}
        className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-2.5 py-1.5 text-sm hover:bg-muted"
      >
        <RefreshCw className="h-3.5 w-3.5" />
        Refresh
      </button>
    </div>
  );
}
