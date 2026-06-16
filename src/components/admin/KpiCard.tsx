import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// Reusable Overview KPI card (doc 15), mirroring the dashboard `Stat` card:
// rounded icon chip + big tabular-nums value. Optional `href` makes the whole
// card a focusable link; optional `sub` adds a muted caption.

const TONE = {
  primary: "bg-accent text-accent-foreground",
  scheduled: "bg-status-scheduled/10 text-status-scheduled",
  draft: "bg-status-draft/10 text-status-draft",
  posted: "bg-status-posted/10 text-status-posted",
  failed: "bg-status-failed/10 text-status-failed",
} as const;

export type KpiTone = keyof typeof TONE;

interface KpiCardProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
  tone?: KpiTone;
  href?: string;
  sub?: string;
}

export function KpiCard({ icon: Icon, label, value, tone = "primary", href, sub }: KpiCardProps) {
  const body = (
    <CardContent className="flex h-full flex-col gap-4 p-5">
      <div className="flex items-start justify-between">
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-lg",
            TONE[tone],
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        {href ? (
          <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-foreground" />
        ) : null}
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="text-3xl font-semibold tracking-tight tabular-nums">{value}</span>
        <span className="text-sm text-muted-foreground">{label}</span>
        {sub ? <span className="text-xs text-muted-foreground/80">{sub}</span> : null}
      </div>
    </CardContent>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="press group block h-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Card className="h-full transition-shadow hover:shadow-md">{body}</Card>
      </Link>
    );
  }

  return <Card className="h-full transition-shadow hover:shadow-md">{body}</Card>;
}
