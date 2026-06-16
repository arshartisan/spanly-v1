import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { ArrowLeft, ExternalLink, Play, ShieldAlert } from "lucide-react";
import { getPostDetail } from "@/server/admin/content";
import { requireStaff, roleAtLeast } from "@/server/admin/access";
import { Card } from "@/components/ui/card";
import { Reveal } from "@/components/motion/reveal";
import { ContentModeration } from "@/components/admin/content/ContentModeration";
import {
  PlatformChip,
  PostStatusBadge,
  TargetStatusBadge,
} from "@/components/admin/content/display";
import { TYPE_LABEL } from "@/lib/post-display";

// Admin post detail (doc 18) — RSC. Reads the full post via getPostDetail() and renders the
// author, caption, media thumbnails, and per-target status/URL/error. Admins additionally get
// the Cancel/Takedown moderation actions. 404s on a missing id. Never leaks tokens.

export const dynamic = "force-dynamic";

export default async function AdminPostDetailPage({
  params,
}: {
  params: Promise<{ postId: string }>;
}) {
  const { postId } = await params;
  const viewer = await requireStaff();
  const canModerate = roleAtLeast(viewer.role, "admin");

  const post = await getPostDetail(postId);
  if (!post) notFound();

  const pendingTargets = post.targets.filter((t) => t.status === "pending").length;
  const caption = post.mainCaption.trim();

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-6 md:p-8">
      <Reveal>
        <Link
          href="/admin/content"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to content
        </Link>
      </Reveal>

      <Reveal delay={0.04}>
        <div className="glass flex flex-col gap-4 rounded-2xl p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <PostStatusBadge status={post.status} />
                <span className="text-xs uppercase tracking-wide text-muted-foreground">
                  {TYPE_LABEL[post.type]} post
                </span>
              </div>
              <h1 className="text-xl font-semibold tracking-tight">
                {post.publishedAt ? (
                  <>Published {format(new Date(post.publishedAt), "d MMM yyyy, HH:mm")}</>
                ) : post.publishAt ? (
                  <>Scheduled for {format(new Date(post.publishAt), "d MMM yyyy, HH:mm")}</>
                ) : (
                  <>Created {format(new Date(post.createdAt), "d MMM yyyy, HH:mm")}</>
                )}
              </h1>
              <p className="text-sm text-muted-foreground">
                by{" "}
                <Link
                  href={`/admin/users/${post.user.id}`}
                  className="font-medium text-foreground hover:underline"
                >
                  {post.user.email}
                </Link>
                {post.user.displayName ? ` (${post.user.displayName})` : ""}
              </p>
            </div>
          </div>

          {post.moderatedAt ? (
            <div className="flex items-start gap-2 rounded-xl border border-status-failed/30 bg-status-failed/10 px-4 py-2.5 text-sm text-status-failed">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="flex flex-col gap-0.5">
                <span className="font-medium">
                  Moderated on {format(new Date(post.moderatedAt), "d MMM yyyy, HH:mm")}
                  {post.moderatedBy ? ` by ${post.moderatedBy.email}` : ""}
                </span>
                {post.moderationReason ? (
                  <span className="text-status-failed/90">{post.moderationReason}</span>
                ) : null}
              </div>
            </div>
          ) : null}

          <ContentModeration
            postId={post.id}
            status={post.status}
            canModerate={canModerate}
            pendingTargets={pendingTargets}
          />
        </div>
      </Reveal>

      <Reveal delay={0.1}>
        <Card className="flex flex-col gap-3 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Caption
          </h2>
          {caption ? (
            <p className="whitespace-pre-wrap text-sm text-foreground/90">{caption}</p>
          ) : (
            <p className="text-sm text-muted-foreground">No caption.</p>
          )}
        </Card>
      </Reveal>

      {post.media.length > 0 ? (
        <Reveal delay={0.14}>
          <Card className="flex flex-col gap-3 p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Media ({post.media.length})
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {post.media.map((m) => {
                const src = m.media.thumbnailUrl ?? m.media.url;
                const isVideo = m.media.kind === "video";
                return (
                  <div
                    key={m.media.id}
                    className="relative aspect-square overflow-hidden rounded-xl border border-border/60 bg-muted"
                  >
                    {src ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={src}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                        No preview
                      </div>
                    )}
                    {isVideo ? (
                      <span className="absolute inset-0 flex items-center justify-center bg-black/30">
                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white">
                          <Play className="h-4 w-4 fill-current" />
                        </span>
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </Card>
        </Reveal>
      ) : null}

      <Reveal delay={0.18}>
        <Card className="flex flex-col gap-3 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Targets ({post.targets.length})
          </h2>
          {post.targets.length === 0 ? (
            <p className="text-sm text-muted-foreground">No platform targets for this post.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {post.targets.map((t) => (
                <li
                  key={t.id}
                  className="glass flex flex-col gap-2 rounded-xl border border-border/50 p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <PlatformChip platform={t.account.platform} />
                      <span className="text-sm font-medium">{t.account.handle}</span>
                      {t.account.displayName ? (
                        <span className="text-xs text-muted-foreground">
                          {t.account.displayName}
                        </span>
                      ) : null}
                    </div>
                    <TargetStatusBadge status={t.status} />
                  </div>
                  {t.externalUrl ? (
                    <a
                      href={t.externalUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex w-fit items-center gap-1 text-xs text-primary hover:underline"
                    >
                      View on platform
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : null}
                  {t.error ? (
                    <p className="rounded-lg border border-status-failed/30 bg-status-failed/10 px-2.5 py-1.5 text-[11px] text-status-failed">
                      {t.error}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </Reveal>
    </div>
  );
}
