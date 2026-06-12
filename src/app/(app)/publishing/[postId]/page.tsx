import { notFound } from "next/navigation";
import { getCurrentUser } from "@/server/auth";
import { getPublishingState } from "@/server/posts";
import { PublishingView } from "@/components/publishing/PublishingView";
import type { PublishingStateView } from "@/components/publishing/types";

// /publishing/[postId] (docs/implementation/09). Server-loads the initial publish state, then
// the client view polls until terminal and renders per-target result cards with retry.
export default async function PublishingPage({
  params,
}: {
  params: Promise<{ postId: string }>;
}) {
  const { postId } = await params;
  const user = await getCurrentUser();
  if (!user) return null;

  const state = await getPublishingState(user.id, postId);
  if (!state) notFound();

  // A post that never dispatched (draft/scheduled with no targets) has nothing to show here.
  if (state.targets.length === 0) notFound();

  const initial: PublishingStateView = {
    id: state.id,
    type: state.type,
    status: state.status,
    publishAt: state.publishAt?.toISOString() ?? null,
    publishedAt: state.publishedAt?.toISOString() ?? null,
    targets: state.targets,
  };

  return <PublishingView initial={initial} />;
}
