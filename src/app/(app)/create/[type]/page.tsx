import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth";
import { eligibleAccounts, getOwnedPost } from "@/server/posts";
import { requirePlan } from "@/server/plans";
import { isAiCaptionConfigured } from "@/server/ai-caption";
import { POST_TYPES, type PostTypeKey } from "@/lib/schemas/post";
import { Composer, type InitialPost } from "@/components/composer/Composer";

// /create/[type] (docs/implementation/06 + 07). One composer parameterized by post type.
// ?postId= loads an existing post for editing; ?date= prefills the schedule day (calendar).
export default async function CreatePostPage({
  params,
  searchParams,
}: {
  params: Promise<{ type: string }>;
  searchParams: Promise<{ postId?: string; date?: string }>;
}) {
  const { type } = await params;
  if (!POST_TYPES.includes(type as PostTypeKey)) notFound();

  const user = await getCurrentUser();
  if (!user) return null; // layout guards/redirects

  const { postId, date } = await searchParams;

  let initialPost: InitialPost | null = null;
  if (postId) {
    const post = await getOwnedPost(user.id, postId);
    if (post) {
      // Keep the URL type in sync with the post's actual type. A legacy "story" post
      // redirects to /create/story, which is no longer a valid type and 404s above.
      if (post.type !== type) redirect(`/create/${post.type}?postId=${postId}`);
      initialPost = {
        id: post.id,
        type: post.type as PostTypeKey,
        status: post.status,
        mainCaption: post.mainCaption,
        perPlatform: (post.perPlatform as Record<string, string>) ?? {},
        targets: post.targets.map((t) => t.socialAccountId),
        media: post.media.map((pm) => ({
          id: pm.media.id,
          kind: pm.media.kind,
          url: pm.media.url,
          width: pm.media.width,
          height: pm.media.height,
          order: pm.order,
          name: `media-${pm.order + 1}`,
        })),
      };
    }
  }

  const accounts = await eligibleAccounts(user.id, type as PostTypeKey);

  // AI caption assistant: shown only when the feature is configured AND the user's plan allows
  // it (paid tier). Server-side enforcement still happens in /api/ai/caption.
  const aiEnabled = isAiCaptionConfigured() && requirePlan(user.subscription, "creator").ok;

  return (
    <Composer
      type={type as PostTypeKey}
      accounts={accounts}
      timezone={user.timezone}
      initialPost={initialPost}
      initialDate={date}
      aiEnabled={aiEnabled}
    />
  );
}
