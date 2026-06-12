import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PLATFORM_CONFIG, PLATFORMS } from "@/lib/platforms";
import { PLAN_LIST } from "@/server/plans";

// Phase 1 foundation landing page. Confirms the theme + stack render correctly.
// The full marketing + app shell arrive in Phase 2.
export default function Home() {
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-10 px-6 py-16">
      <header className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
            S
          </div>
          <span className="text-2xl font-bold tracking-tight">Spanly</span>
          <span className="ml-2 rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium text-accent-foreground">
            Phase 1 · Foundation
          </span>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">
          Social scheduling, simplified.
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          Upload once and publish everywhere. Foundation scaffold is live — auth, composer,
          scheduling, and publishing land in the next phases.
        </p>
        <div className="flex gap-3">
          <Button asChild>
            <Link href="/api/health">Check API health</Link>
          </Button>
          <Button variant="outline" asChild>
            <a href="https://github.com" rel="noreferrer">
              Docs
            </a>
          </Button>
        </div>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Supported platforms</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {PLATFORMS.map((p) => {
            const cfg = PLATFORM_CONFIG[p];
            return (
              <Card key={p}>
                <CardHeader className="p-4">
                  <CardTitle className="text-base">{cfg.label}</CardTitle>
                  <CardDescription>{cfg.capabilities.join(" · ")}</CardDescription>
                </CardHeader>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Plans</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {PLAN_LIST.map((plan) => (
            <Card key={plan.key}>
              <CardHeader>
                <CardTitle className="flex items-baseline justify-between">
                  <span>{plan.name}</span>
                  <span className="text-2xl font-bold">${plan.monthly}</span>
                </CardTitle>
                <CardDescription>{plan.tagline}</CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {plan.accountLimit === Infinity
                  ? "Unlimited connected accounts"
                  : `${plan.accountLimit} connected accounts`}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </main>
  );
}
