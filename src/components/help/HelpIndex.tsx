"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { HELP_CATEGORIES, type HelpArticle } from "@/lib/help-content";

type Item = Pick<HelpArticle, "slug" | "title" | "category" | "excerpt">;

// Help center index (Phase 13): client-side search over titles/excerpts, grouped by category.
export function HelpIndex({ articles }: { articles: Item[] }) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return articles;
    return articles.filter(
      (a) => a.title.toLowerCase().includes(term) || a.excerpt.toLowerCase().includes(term),
    );
  }, [q, articles]);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6 md:p-8">
      <div>
        <h1 className="text-2xl font-semibold">Help Center</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Guides for connecting accounts, scheduling, billing, and the API.
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search help articles…"
          className="pl-9"
        />
      </div>

      {HELP_CATEGORIES.map((cat) => {
        const items = filtered.filter((a) => a.category === cat.key);
        if (items.length === 0) return null;
        return (
          <section key={cat.key} className="rounded-xl border bg-background">
            <div className="border-b p-4">
              <h2 className="text-sm font-semibold">{cat.label}</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">{cat.description}</p>
            </div>
            <ul className="divide-y">
              {items.map((a) => (
                <li key={a.slug}>
                  <Link
                    href={`/help/${a.slug}`}
                    className="flex items-center justify-between gap-4 p-4 transition hover:bg-muted/50"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{a.title}</p>
                      <p className="truncate text-xs text-muted-foreground">{a.excerpt}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      {filtered.length === 0 && (
        <p className="rounded-xl border bg-background p-8 text-center text-sm text-muted-foreground">
          No articles match “{q}”.
        </p>
      )}
    </div>
  );
}
