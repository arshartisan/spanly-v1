import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ChevronRight } from "lucide-react";
import {
  HELP_ARTICLES,
  HELP_CATEGORIES,
  articlesByCategory,
  getHelpArticle,
} from "@/lib/help-content";
import { ArticleBody } from "@/components/help/ArticleBody";

// Pre-render every help article at build time.
export function generateStaticParams() {
  return HELP_ARTICLES.map((a) => ({ slug: a.slug }));
}

export default async function HelpArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = getHelpArticle(slug);
  if (!article) notFound();

  const category = HELP_CATEGORIES.find((c) => c.key === article.category);
  const related = articlesByCategory(article.category).filter((a) => a.slug !== article.slug);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6 md:p-8">
      <Link href="/help" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Help Center
      </Link>

      <article className="rounded-xl border bg-background p-6">
        <p className="text-xs font-medium uppercase tracking-wide text-primary">{category?.label}</p>
        <h1 className="mt-1 text-2xl font-semibold">{article.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{article.excerpt}</p>
        <hr className="my-5" />
        <ArticleBody body={article.body} />
      </article>

      {related.length > 0 && (
        <section className="rounded-xl border bg-background">
          <div className="border-b p-4">
            <h2 className="text-sm font-semibold">Related articles</h2>
          </div>
          <ul className="divide-y">
            {related.map((a) => (
              <li key={a.slug}>
                <Link
                  href={`/help/${a.slug}`}
                  className="flex items-center justify-between gap-4 p-4 transition hover:bg-muted/50"
                >
                  <span className="text-sm font-medium">{a.title}</span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
