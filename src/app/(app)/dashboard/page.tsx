import Link from "next/link";
import { CalendarDays, FileText, Link2, Send } from "lucide-react";
import { prisma } from "@/server/db";
import { getCurrentUser } from "@/server/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/reveal";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) return null; // layout already guards/redirects

  const [accountCount, scheduledCount, draftCount, postedCount] = await Promise.all([
    prisma.socialAccount.count({ where: { userId: user.id, disconnectedAt: null } }),
    prisma.post.count({ where: { userId: user.id, status: "scheduled" } }),
    prisma.post.count({ where: { userId: user.id, status: "draft" } }),
    prisma.post.count({ where: { userId: user.id, status: "posted" } }),
  ]);

  const firstName = (user.displayName ?? user.email).split(" ")[0];

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 p-6 md:p-8">
      <Reveal>
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back, {firstName}</h1>
        <p className="text-sm text-muted-foreground">Here&apos;s what&apos;s happening in your workspace.</p>
      </Reveal>

      {accountCount === 0 ? (
        <Reveal delay={0.08}>
          <EmptyState />
        </Reveal>
      ) : (
        <>
          <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" delayChildren={0.08}>
            <StaggerItem className="h-full">
              <Stat icon={Link2} label="Connected accounts" value={accountCount} tone="primary" />
            </StaggerItem>
            <StaggerItem className="h-full">
              <Stat icon={Send} label="Scheduled" value={scheduledCount} tone="scheduled" />
            </StaggerItem>
            <StaggerItem className="h-full">
              <Stat icon={FileText} label="Drafts" value={draftCount} tone="draft" />
            </StaggerItem>
            <StaggerItem className="h-full">
              <Stat icon={CalendarDays} label="Posted" value={postedCount} tone="posted" />
            </StaggerItem>
          </Stagger>

          <Reveal delay={0.28}>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Quick actions</CardTitle>
                <CardDescription>Jump back into your workflow.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-3">
                <Button asChild>
                  <Link href="/create/text">Create a post</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/calendar">Open calendar</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/connections">Manage connections</Link>
                </Button>
              </CardContent>
            </Card>
          </Reveal>
        </>
      )}
    </div>
  );
}

const TONE: Record<string, string> = {
  primary: "bg-accent text-accent-foreground",
  scheduled: "bg-status-scheduled/10 text-status-scheduled",
  draft: "bg-status-draft/10 text-status-draft",
  posted: "bg-status-posted/10 text-status-posted",
};

function Stat({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  tone: keyof typeof TONE;
}) {
  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="flex flex-col gap-4 p-5">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${TONE[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-3xl font-semibold tracking-tight tabular-nums">{value}</span>
          <span className="text-sm text-muted-foreground">{label}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState() {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center gap-4 px-6 py-14 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <Link2 className="h-6 w-6" />
        </div>
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold">Connect your first account</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            Link a Facebook, Instagram, LinkedIn, TikTok, YouTube, or X account to start scheduling
            and publishing posts from Spanly.
          </p>
        </div>
        <Button asChild>
          <Link href="/connections">Connect an account</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
