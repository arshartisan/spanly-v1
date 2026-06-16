import { AlertTriangle, Megaphone } from "lucide-react";
import { requireStaff } from "@/server/admin/access";
import { Card } from "@/components/ui/card";
import { Reveal } from "@/components/motion/reveal";
import { BroadcastForm } from "@/components/admin/settings/BroadcastForm";

// Admin Broadcast — send a transactional/broadcast email to an audience (doc 21). RSC.
// requireStaff("superadmin") redirects any non-superadmin. Mirrors the announcements page
// structure; the composer itself is a client component (BroadcastForm). This sends REAL email.

export const dynamic = "force-dynamic";

export default async function AdminBroadcastPage() {
  await requireStaff("superadmin");

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6 md:p-8">
      <Reveal>
        <div className="flex items-center gap-2">
          <Megaphone className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-semibold tracking-tight">Broadcast</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Send an email to a segment of customers — service notices, price changes, and the like.
        </p>
      </Reveal>

      <Reveal delay={0.06}>
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-status-failed/30 bg-status-failed/10 px-4 py-3 text-sm text-status-failed"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p className="leading-snug">
            This sends a real email to every matching user. Double-check the audience and copy —
            there is no undo. The send is audited (audience + recipient count only).
          </p>
        </div>
      </Reveal>

      <Reveal delay={0.1}>
        <Card className="p-5">
          <BroadcastForm />
        </Card>
      </Reveal>
    </div>
  );
}
