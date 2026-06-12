"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { UserSettings } from "@/lib/schemas/settings";

interface Initial {
  displayName: string;
  email: string;
  avatarUrl?: string | null;
  timezone: string;
  emailVerified: boolean;
  settings: UserSettings;
}

// General settings (doc 11A). Cards backed by User.settings JSON + auth actions. Toggles
// auto-save on change; text fields save on an explicit button.
export function GeneralPanel({ initial }: { initial: Initial }) {
  const [settings, setSettings] = useState<UserSettings>(initial.settings);

  // Partial PATCH helper. Returns true on success; callers manage their own busy/feedback.
  async function patch(body: Record<string, unknown>): Promise<boolean> {
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return false;
    const data = await res.json().catch(() => null);
    if (data?.settings) setSettings(data.settings);
    return true;
  }

  return (
    <div className="flex flex-col gap-5">
      <ProfileCard initial={initial} onSave={(displayName) => patch({ displayName })} />
      <EmailCard email={initial.email} verified={initial.emailVerified} />
      <PasswordCard email={initial.email} />
      <SecurityCard />

      <SettingCard title="Email Preferences" description="Choose which emails Spanly sends you.">
        <ToggleRow
          label="Automation emails"
          checked={settings.emailPrefs.automation}
          onChange={(v) => patch({ emailPrefs: { automation: v } })}
        />
        <ToggleRow
          label="Post failure alerts"
          checked={settings.emailPrefs.failureAlerts}
          onChange={(v) => patch({ emailPrefs: { failureAlerts: v } })}
        />
        <ToggleRow
          label="Post summary"
          checked={settings.emailPrefs.summary}
          onChange={(v) => patch({ emailPrefs: { summary: v } })}
        />
      </SettingCard>

      <SettingCard title="Platform Preferences" description="Defaults applied when you create posts.">
        <ToggleRow
          label="Use file name as caption"
          checked={settings.platformPrefs.filenameAsCaption}
          onChange={(v) => patch({ platformPrefs: { filenameAsCaption: v } })}
        />
        <ToggleRow
          label="24-hour time format"
          checked={settings.platformPrefs.use24h}
          onChange={(v) => patch({ platformPrefs: { use24h: v } })}
        />
        <ToggleRow
          label="Process videos on our servers"
          description="Transcode uploads for best compatibility. Off uses the raw file."
          checked={settings.platformPrefs.processVideosServerSide}
          onChange={(v) => patch({ platformPrefs: { processVideosServerSide: v } })}
        />
      </SettingCard>

      <WeeklyGoalCard initial={settings.weeklyPostingGoal} onSave={(n) => patch({ weeklyPostingGoal: n })} />
      <McpCard url={settings.mcpUrl} />
      <ConnectedAppsCard />
    </div>
  );
}

// ─────────────────────────── building blocks ───────────────────────────

function SettingCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border bg-background p-5">
      <div className="mb-4">
        <h2 className="text-sm font-semibold">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => Promise<boolean> | void;
}) {
  const [value, setValue] = useState(checked);
  const [saved, setSaved] = useState(false);
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm">{label}</p>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      <div className="flex items-center gap-2">
        {saved && <Check className="h-3.5 w-3.5 text-primary" />}
        <Switch
          checked={value}
          onCheckedChange={async (v) => {
            setValue(v);
            const ok = await onChange(v);
            if (ok === false) {
              setValue(!v); // revert on failure
              return;
            }
            setSaved(true);
            setTimeout(() => setSaved(false), 1500);
          }}
        />
      </div>
    </div>
  );
}

function ProfileCard({ initial, onSave }: { initial: Initial; onSave: (name: string) => Promise<boolean> }) {
  const [name, setName] = useState(initial.displayName);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const dirty = name.trim() !== initial.displayName && name.trim().length > 0;
  const initials = (initial.displayName || initial.email).slice(0, 2).toUpperCase();

  return (
    <SettingCard title="Profile" description="Your name and avatar across Spanly.">
      <div className="flex items-center gap-4">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-sm font-medium text-muted-foreground">
          {initial.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={initial.avatarUrl} alt="" className="h-12 w-12 rounded-full object-cover" />
          ) : (
            initials
          )}
        </span>
        <div className="flex-1">
          <Label htmlFor="displayName">Display name</Label>
          <Input
            id="displayName"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            className="mt-1"
          />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Button
          disabled={!dirty || busy}
          onClick={async () => {
            setBusy(true);
            const ok = await onSave(name.trim());
            setBusy(false);
            if (ok) {
              setSaved(true);
              setTimeout(() => setSaved(false), 1500);
            }
          }}
        >
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save
        </Button>
        {saved && <span className="text-xs text-primary">Saved</span>}
      </div>
    </SettingCard>
  );
}

function EmailCard({ email, verified }: { email: string; verified: boolean }) {
  const [open, setOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit() {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/auth/change-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: newEmail, password }),
    });
    const data = await res.json().catch(() => null);
    setBusy(false);
    if (res.ok) {
      setMsg({ ok: true, text: "Check your inbox to confirm the new address." });
      setOpen(false);
      setNewEmail("");
      setPassword("");
    } else {
      setMsg({ ok: false, text: data?.error ?? "Could not change email." });
    }
  }

  return (
    <SettingCard title="Email Address" description="Used for sign-in and notifications.">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm">{email}</span>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              verified ? "bg-primary/10 text-primary" : "bg-amber-100 text-amber-700"
            }`}
          >
            {verified ? "Verified" : "Unverified"}
          </span>
        </div>
        <Button variant="outline" size="sm" onClick={() => setOpen((o) => !o)}>
          Change Email
        </Button>
      </div>
      {open && (
        <div className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-3">
          <Input placeholder="New email" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
          <Input
            placeholder="Current password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button size="sm" disabled={busy || !newEmail || !password} onClick={submit}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Send confirmation
          </Button>
        </div>
      )}
      {msg && <p className={`text-xs ${msg.ok ? "text-primary" : "text-destructive"}`}>{msg.text}</p>}
    </SettingCard>
  );
}

function PasswordCard({ email }: { email: string }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit() {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: current, newPassword: next }),
    });
    const data = await res.json().catch(() => null);
    setBusy(false);
    if (res.ok) {
      setMsg({ ok: true, text: "Password updated. Other devices were signed out." });
      setCurrent("");
      setNext("");
    } else {
      setMsg({ ok: false, text: data?.error ?? "Could not change password." });
    }
  }

  async function forgot() {
    await fetch("/api/auth/forgot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setMsg({ ok: true, text: "Password reset link sent to your email." });
  }

  return (
    <SettingCard title="Password" description="Change your password or reset it by email.">
      <Input placeholder="Current password" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} />
      <Input placeholder="New password (min 8 chars)" type="password" value={next} onChange={(e) => setNext(e.target.value)} />
      <div className="flex items-center gap-3">
        <Button disabled={busy || current.length < 1 || next.length < 8} onClick={submit}>
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Change Password
        </Button>
        <button type="button" onClick={forgot} className="text-xs text-muted-foreground underline hover:text-foreground">
          Forgot password?
        </button>
      </div>
      {msg && <p className={`text-xs ${msg.ok ? "text-primary" : "text-destructive"}`}>{msg.text}</p>}
    </SettingCard>
  );
}

function SecurityCard() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <SettingCard title="Security" description="Sign out everywhere if you suspect unauthorized access.">
      <div>
        <Button
          variant="outline"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await fetch("/api/auth/signout-all", { method: "POST" });
            router.push("/login");
          }}
        >
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Sign Out All Devices
        </Button>
      </div>
    </SettingCard>
  );
}

function WeeklyGoalCard({ initial, onSave }: { initial: number; onSave: (n: number) => Promise<boolean> }) {
  const [goal, setGoal] = useState(String(initial));
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const n = Number(goal);
  const valid = Number.isInteger(n) && n >= 0 && n <= 1000;
  return (
    <SettingCard title="Weekly Posting Goal" description="Shown on your dashboard. 0 to disable.">
      <div className="flex items-center gap-3">
        <Input
          type="number"
          min={0}
          max={1000}
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          className="w-28"
        />
        <Button
          disabled={!valid || busy || n === initial}
          onClick={async () => {
            setBusy(true);
            const ok = await onSave(n);
            setBusy(false);
            if (ok) {
              setSaved(true);
              setTimeout(() => setSaved(false), 1500);
            }
          }}
        >
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save
        </Button>
        {saved && <span className="text-xs text-primary">Saved</span>}
      </div>
    </SettingCard>
  );
}

function McpCard({ url }: { url?: string }) {
  const [copied, setCopied] = useState(false);
  const value = url ?? "Coming soon";
  return (
    <SettingCard title="Connect to Claude (MCP)" description="Manage Spanly from Claude. Available in a later release.">
      <div className="flex items-center gap-2">
        <Input value={value} readOnly disabled className="font-mono text-xs" />
        <Button
          variant="outline"
          size="sm"
          disabled={!url}
          onClick={() => {
            if (url) {
              navigator.clipboard.writeText(url);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }
          }}
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </Button>
        <Button variant="outline" size="sm" disabled>
          Setup Guide
        </Button>
      </div>
    </SettingCard>
  );
}

function ConnectedAppsCard() {
  return (
    <SettingCard title="Connected Apps" description="Third-party apps with access to your account.">
      <p className="text-sm text-muted-foreground">No connected apps yet.</p>
    </SettingCard>
  );
}
