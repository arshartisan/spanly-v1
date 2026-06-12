import { notFound } from "next/navigation";
import { getCurrentUser } from "@/server/auth";
import { eligibleAccounts } from "@/server/posts";
import { POST_TYPES, type PostTypeKey } from "@/lib/schemas/post";
import { Composer } from "@/components/composer/Composer";

// /create/[type] (docs/implementation/06). One composer parameterized by post type; the
// eligible-accounts set is filtered by capability server-side.
export default async function CreatePostPage({ params }: { params: Promise<{ type: string }> }) {
  const { type } = await params;
  if (!POST_TYPES.includes(type as PostTypeKey)) notFound();

  const user = await getCurrentUser();
  if (!user) return null; // layout guards/redirects

  const accounts = await eligibleAccounts(user.id, type as PostTypeKey);

  return <Composer type={type as PostTypeKey} accounts={accounts} timezone={user.timezone} />;
}
