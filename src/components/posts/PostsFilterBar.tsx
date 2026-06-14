"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { PLATFORMS } from "@/lib/platforms";
import { PLATFORM_STYLE } from "@/lib/platform-style";
import { POST_TYPES } from "@/lib/schemas/post";
import { TYPE_LABEL } from "@/lib/post-display";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={params.get("sort") === "oldest" ? "oldest" : "newest"}
        onValueChange={(v) => update("sort", v === "newest" ? "all" : v)}
      >
        <SelectTrigger className="w-[150px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="newest">Newest first</SelectItem>
          <SelectItem value="oldest">Oldest first</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={params.get("platform") ?? "all"}
        onValueChange={(v) => update("platform", v)}
      >
        <SelectTrigger className="w-[160px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All platforms</SelectItem>
          {PLATFORMS.map((p) => (
            <SelectItem key={p} value={p}>
              {PLATFORM_STYLE[p].label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={params.get("type") ?? "all"} onValueChange={(v) => update("type", v)}>
        <SelectTrigger className="w-[150px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All types</SelectItem>
          {POST_TYPES.map((t) => (
            <SelectItem key={t} value={t}>
              {TYPE_LABEL[t]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button variant="outline" size="sm" className="ml-auto" onClick={() => router.refresh()}>
        <RefreshCw className="h-3.5 w-3.5" />
        Refresh
      </Button>
    </div>
  );
}
