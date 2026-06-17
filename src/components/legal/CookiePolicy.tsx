import { ManageCookiesButton } from "@/components/consent/ManageCookiesButton";
import {
  COOKIE_CATEGORIES,
  COOKIE_POLICY,
  COOKIES,
  type CookieCategoryMeta,
} from "@/lib/cookie-content";

// Renders the Cookie Policy: intro, one section per category with a table of the actual
// cookies in that category, and a "manage choices" block. Server component; the only
// interactive piece is the ManageCookiesButton (client) which re-opens the preferences dialog.

function CategoryTable({ category }: { category: CookieCategoryMeta }) {
  const rows = COOKIES.filter((c) => c.category === category.key);

  return (
    <section className="flex flex-col gap-3 scroll-mt-24">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold tracking-tight">{category.title}</h2>
        <span
          className={
            category.required
              ? "rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground"
              : "rounded-full bg-primary/15 px-2.5 py-0.5 text-[11px] font-medium text-primary"
          }
        >
          {category.required ? "Always on" : "Optional — your choice"}
        </span>
      </div>
      <p className="text-sm leading-relaxed text-muted-foreground">{category.description}</p>

      {rows.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-border/70">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border/70 text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">Cookie</th>
                <th className="px-4 py-2.5 font-medium">Provider</th>
                <th className="px-4 py-2.5 font-medium">Purpose</th>
                <th className="px-4 py-2.5 font-medium">Duration</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.name} className="border-b border-border/40 last:border-0 align-top">
                  <td className="px-4 py-3 font-mono text-xs text-foreground">{row.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{row.provider}</td>
                  <td className="px-4 py-3 text-muted-foreground">{row.purpose}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{row.duration}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-border/70 px-4 py-3 text-sm text-muted-foreground">
          We don&apos;t currently set any cookies in this category. If that changes, they&apos;ll be
          listed here and will only load with your consent.
        </p>
      )}
    </section>
  );
}

export function CookiePolicy() {
  return (
    <article className="mx-auto w-full max-w-3xl">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">{COOKIE_POLICY.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Effective date: {COOKIE_POLICY.effectiveDate}
        </p>
      </header>

      <div className="mt-6 flex flex-col gap-3 border-b pb-6">
        {COOKIE_POLICY.intro.map((text, i) => (
          <p key={i} className="text-sm leading-relaxed text-muted-foreground">
            {text}
          </p>
        ))}
      </div>

      <div className="mt-8 flex flex-col gap-10">
        {COOKIE_CATEGORIES.map((category) => (
          <CategoryTable key={category.key} category={category} />
        ))}

        <section className="flex flex-col gap-3 scroll-mt-24">
          <h2 className="text-lg font-semibold tracking-tight">Managing your choices</h2>
          {COOKIE_POLICY.manage.map((text, i) => (
            <p key={i} className="text-sm leading-relaxed text-muted-foreground">
              {text}
            </p>
          ))}
          <div>
            <ManageCookiesButton className="inline-flex items-center rounded-md border border-input bg-background/40 px-4 py-2 text-sm font-medium text-foreground shadow-sm backdrop-blur-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
          </div>
        </section>
      </div>
    </article>
  );
}
