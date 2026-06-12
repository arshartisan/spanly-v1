import { notFound } from "next/navigation";
import Link from "next/link";
import { FileText } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { getCurrentUser } from "@/server/auth";
import { prisma } from "@/server/db";
import { PLATFORMS, type PlatformKey } from "@/lib/platforms";
import { POST_TYPES, type PostTypeKey } from "@/lib/schemas/post";
import { Button } from "@/components/ui/button";
import { PostsFilterBar } from "@/components/posts/PostsFilterBar";
import { PostCard, type PostCardData } from "@/components/posts/PostCard";

const FILTERS = ["all", "scheduled", "posted", "drafts"] as const;
type Filter = (typeof FILTERS)[number];

const TITLE: Record<Filter, string> = {
  all: "All Posts",
  scheduled: "Scheduled",
  posted: "Posted",
  drafts: "Drafts",
};

const EMPTY: Record<Filter, string> = {
  all: "No posts yet.",
  scheduled: "No scheduled posts yet.",
  posted: "Nothing published yet.",
  drafts: "No drafts saved.",
};

function whenFor(post: {
  status: string;
  createdAt: Date;
  publishAt: Date | null;
  publishedAt: Date | null;
}): { when: Date; whenLabel: string } {
  switch (post.status) {
    case "draft":
      return { when: post.createdAt, whenLabel: "Created" };
    case "scheduled":
      return { when: post.publishAt ?? post.createdAt, whenLabel: "Scheduled" };
    case "publishing":
      return { when: post.publishAt ?? post.createdAt, whenLabel: "Publishing" };
    case "posted":
      return { when: post.publishedAt ?? post.publishAt ?? post.createdAt, whenLabel: "Posted" };
    default:
      return { when: post.publishAt ?? post.createdAt, whenLabel: "Attempted" };
  }
}

// /posts/[filter] (docs/implementation/07). One list, four filters via the route param.
export default async function PostsPage({
  params,
  searchParams,
}: {
  params: Promise<{ filter: string }>;
  searchParams: Promise<{ platform?: string; type?: string; sort?: string }>;
}) {
  const { filter } = await params;
  if (!FILTERS.includes(filter as Filter)) notFound();
  const f = filter as Filter;

  const user = await getCurrentUser();
  if (!user) return null;

  const sp = await searchParams;
  const where: Prisma.PostWhereInput = { userId: user.id };
  if (f === "scheduled") where.status = "scheduled";
  else if (f === "posted") where.status = "posted";
  else if (f === "drafts") where.status = "draft";

  if (sp.platform && PLATFORMS.includes(sp.platform as PlatformKey)) {
    where.targets = { some: { account: { platform: sp.platform as PlatformKey } } };
  }
  if (sp.type && POST_TYPES.includes(sp.type as PostTypeKey)) {
    where.type = sp.type as PostTypeKey;
  }

  const posts = await prisma.post.findMany({
    where,
    orderBy: { createdAt: sp.sort === "oldest" ? "asc" : "desc" },
    take: 100,
    include: { targets: { include: { account: true } }, media: true },
  });

  const cards: PostCardData[] = posts.map((post) => {
    const { when, whenLabel } = whenFor(post);
    return {
      id: post.id,
      type: post.type,
      status: post.status,
      caption: post.mainCaption,
      mediaCount: post.media.length,
      when,
      whenLabel,
      targets: post.targets.map((t) => ({
        platform: t.account.platform as PlatformKey,
        handle: t.account.handle,
        status: t.status,
      })),
    };
  });

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5 p-6 md:p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">{TITLE[f]}</h1>
        <Button asChild size="sm">
          <Link href="/create/text">Create post</Link>
        </Button>
      </div>

      <PostsFilterBar />

      {cards.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-12 text-center">
          <FileText className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{EMPTY[f]}</p>
          <Button asChild variant="outline" size="sm">
            <Link href="/create/text">Create your first post</Link>
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {cards.map((post) => (
            <PostCard key={post.id} post={post} tz={user.timezone} />
          ))}
        </div>
      )}
    </div>
  );
}
