import Link from "next/link";
import { ImageIcon } from "lucide-react";
import type { PostStatus, PostType, TargetStatus } from "@prisma/client";
import { PLATFORM_STYLE } from "@/lib/platform-style";
import type { PlatformKey } from "@/lib/platforms";
import { STATUS_META, TYPE_LABEL, formatDate, formatTime, snippet } from "@/lib/post-display";
import { cn } from "@/lib/utils";

export interface PostCardTarget {
  platform: PlatformKey;
  handle: string;
  status: TargetStatus;
}

export interface PostCardData {
  id: string;
  type: PostType;
  status: PostStatus;
  caption: string;
  mediaCount: number;
  when: Date;
  whenLabel: string;
  targets: PostCardTarget[];
}

/** A single post row in the lists (doc 07). Whole card links to the composer for edit/detail. */
export function PostCard({ post, tz }: { post: PostCardData; tz: string }) {
  const status = STATUS_META[post.status];
  return (
    <Link
      href={`/create/${post.type}?postId=${post.id}`}
      className="flex flex-col gap-3 rounded-xl border bg-background p-4 transition-colors hover:border-primary/40 hover:bg-muted/30"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>
            {post.whenLabel} {formatDate(post.when, tz)} · {formatTime(post.when, tz)}
          </span>
          <span className="rounded bg-muted px-1.5 py-0.5 font-medium text-foreground">
            {TYPE_LABEL[post.type]}
          </span>
        </div>
        <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", status.badge)}>
          {status.label}
        </span>
      </div>

      <p className="text-sm text-foreground/90">
        {post.caption.trim() ? snippet(post.caption) : <span className="text-muted-foreground italic">No caption</span>}
      </p>

      <div className="flex items-center justify-between">
        <div className="flex -space-x-2">
          {post.targets.length === 0 ? (
            <span className="text-xs text-muted-foreground">No accounts</span>
          ) : (
            post.targets.map((t, i) => {
              const style = PLATFORM_STYLE[t.platform];
              const Icon = style.Icon;
              return (
                <span
                  key={`${t.platform}-${i}`}
                  title={`${t.handle} · ${t.status}`}
                  className="flex h-6 w-6 items-center justify-center rounded-full text-white ring-2 ring-background"
                  style={{ backgroundColor: style.color }}
                >
                  <Icon className="h-3 w-3" />
                </span>
              );
            })
          )}
        </div>
        {post.mediaCount > 0 && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <ImageIcon className="h-3.5 w-3.5" />
            {post.mediaCount}
          </span>
        )}
      </div>
    </Link>
  );
}
