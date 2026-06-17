import Link from "next/link";
import { format } from "date-fns";
import { ArrowRight, FileText } from "lucide-react";
import type { Platform } from "@prisma/client";
import { listPosts, type AdminPostListItem } from "@/server/admin/content";
import { requireStaff } from "@/server/admin/access";
import { postListQuerySchema } from "@/lib/schemas/admin-content";
import { Card } from "@/components/ui/card";
import { Reveal } from "@/components/motion/reveal";
import { ContentFilters } from "@/components/admin/content/ContentFilters";
import { PlatformChip, PostStatusBadge } from "@/components/admin/content/display";
import { TYPE_LABEL, snippet } from "@/lib/post-display";
import { cn } from "@/lib/utils";

// Admin cross-user content list (doc 18) - RSC. Parses the URL query with the shared Zod
// schema, reads via listPosts(), and renders the subscriptions-style glass table. Filters
// live in the client <ContentFilters/>; pagination is a plain "Load more" link that appends
// the returned cursor (mirrors the users list page).

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminContentPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireStaff();
  const raw = await searchParams;

  // Lenient parse: drop any invalid filter rather than 500 the page.
  const parsed = postListQuerySchema.safeParse({
    status: first(raw.status),
    platform: first(raw.platform),
    userId: first(raw.userId),
    from: first(raw.from),
    to: first(raw.to),
    query: first(raw.query),
    cursor: first(raw.cursor),
    take: first(raw.take),
  });
  const filter = parsed.success ? parsed.data : postListQuerySchema.parse({});

  const { posts, nextCursor } = await listPosts(filter);

  // Build the "Load more" href by carrying the current filters forward + the new cursor.
  const loadMoreParams = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) {
    const v = first(value);
    if (v && key !== "cursor") loadMoreParams.set(key, v);
  }
  if (nextCursor) loadMoreParams.set("cursor", nextCursor);
  const loadMoreHref = `/admin/content?${loadMoreParams.toString()}`;

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 p-6 md:p-8">
      <Reveal>
        <h1 className="text-2xl font-semibold tracking-tight">Content</h1>
        <p className="text-sm text-muted-foreground">
          Every post across all users, with the platforms it targets.
        </p>
      </Reveal>

      <Reveal delay={0.06}>
        <ContentFilters />
      </Reveal>

      <Reveal delay={0.12}>
        {posts.length === 0 ? (
          <EmptyState />
        ) : (
          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <Th>User</Th>
                    <Th>Type</Th>
                    <Th>Caption</Th>
                    <Th>Status</Th>
                    <Th>Platforms</Th>
                    <Th>Scheduled / Published</Th>
                    <Th className="sr-only">Open</Th>
                  </tr>
                </thead>
                <tbody>
                  {posts.map((p) => (
                    <ContentRow key={p.id} post={p} />
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </Reveal>

      {nextCursor ? (
        <div className="flex justify-center">
          <Link
            href={loadMoreHref}
            className="press glass inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-foreground/80 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Load more
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ) : null}
    </div>
  );
}

function ContentRow({ post }: { post: AdminPostListItem }) {
  // Dedupe target platforms, preserving first-seen order.
  const platforms: Platform[] = [];
  for (const t of post.targets) {
    if (!platforms.includes(t.account.platform)) platforms.push(t.account.platform);
  }

  const caption = post.mainCaption.trim();

  return (
    <tr className="group border-b border-border/40 transition-colors last:border-0 hover:bg-foreground/[0.03]">
      <Td>
        <Link
          href={`/admin/users/${post.user.id}`}
          className="flex min-w-0 flex-col focus-visible:outline-none"
        >
          <span className="truncate font-medium text-foreground group-hover:underline">
            {post.user.email}
          </span>
          {post.user.displayName ? (
            <span className="truncate text-xs text-muted-foreground">{post.user.displayName}</span>
          ) : null}
        </Link>
      </Td>
      <Td className="whitespace-nowrap text-muted-foreground">{TYPE_LABEL[post.type]}</Td>
      <Td className="max-w-[280px]">
        {caption ? (
          <span className="line-clamp-2 text-foreground/80">{snippet(caption, 120)}</span>
        ) : (
          <span className="text-xs text-muted-foreground">No caption</span>
        )}
      </Td>
      <Td>
        <PostStatusBadge status={post.status} />
      </Td>
      <Td>
        {platforms.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1">
            {platforms.map((p) => (
              <PlatformChip key={p} platform={p} />
            ))}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">-</span>
        )}
      </Td>
      <Td className="whitespace-nowrap text-muted-foreground">
        {post.publishedAt ? (
          <span>{format(new Date(post.publishedAt), "d MMM yyyy, HH:mm")}</span>
        ) : post.publishAt ? (
          <span>{format(new Date(post.publishAt), "d MMM yyyy, HH:mm")}</span>
        ) : (
          <span className="text-xs">-</span>
        )}
      </Td>
      <Td className="text-right">
        <Link
          href={`/admin/content/${post.id}`}
          aria-label="Open post detail"
          className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowRight className="h-4 w-4" />
        </Link>
      </Td>
    </tr>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return <th className={cn("px-4 py-3 font-medium", className)}>{children}</th>;
}

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn("px-4 py-3 align-middle", className)}>{children}</td>;
}

function EmptyState() {
  return (
    <Card className="border-dashed">
      <div className="flex flex-col items-center gap-4 px-6 py-14 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <FileText className="h-6 w-6" />
        </div>
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold">No posts match</h2>
          <p className="max-w-sm text-sm text-muted-foreground">
            Try a different filter, or clear them to widen the results.
          </p>
        </div>
      </div>
    </Card>
  );
}
