import { HELP_ARTICLES } from "@/lib/help-content";
import { HelpIndex } from "@/components/help/HelpIndex";

// Help Center index (Phase 13). Static content; the list is searchable client-side.
export default function HelpPage() {
  const items = HELP_ARTICLES.map((a) => ({
    slug: a.slug,
    title: a.title,
    category: a.category,
    excerpt: a.excerpt,
  }));
  return <HelpIndex articles={items} />;
}
