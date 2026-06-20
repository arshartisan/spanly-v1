"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Copy, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { UserSettings } from "@/lib/schemas/settings";

interface Initial {
  displayName: string;
  email: string;
  avatarUrl?: string | null;
  timezone: string;
  emailVerified: boolean;
  marketingEmails: boolean;
  settings: UserSettings;
}

// General settings (doc 11A). Cards backed by User.settings JSON + auth actions. Toggles
// auto-save on change; text fields save on an explicit button.
export function GeneralPanel({ initial, mcpEndpoint }: { initial: Initial; mcpEndpoint: string }) {
  const [settings, setSettings] = useState<UserSettings>(initial.settings);
  // marketingEmails lives on a User column (not the settings JSON), so track it separately.
  const [marketingEmails, setMarketingEmails] = useState(initial.marketingEmails);

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
      <TimezoneCard initial={initial.timezone} />
      <EmailCard email={initial.email} verified={initial.emailVerified} />
      <PasswordCard email={initial.email} />
      <SecurityCard />

      <SettingCard title="Email Preferences" description="Choose which emails Spanlyfy sends you.">
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
        <ToggleRow
          label="Product news & newsletters"
          checked={marketingEmails}
          onChange={async (v) => {
            setMarketingEmails(v); // optimistic
            const ok = await patch({ marketingEmails: v });
            if (!ok) setMarketingEmails(!v); // revert on failure
            return ok;
          }}
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
      <McpCard endpoint={mcpEndpoint} />
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
    <SettingCard title="Profile" description="Your name and avatar across Spanlyfy.">
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
          loading={busy}
          disabled={!dirty}
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
          Save
        </Button>
        {saved && <span className="text-xs text-primary">Saved</span>}
      </div>
    </SettingCard>
  );
}

// Common zones used as a fallback when Intl.supportedValuesOf isn't available.
const FALLBACK_ZONES = [
  "UTC",
  "Asia/Colombo",
  "Asia/Kolkata",
  "Asia/Dubai",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Europe/London",
  "Europe/Berlin",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "Australia/Sydney",
];

/** The browser's current IANA timezone (e.g. "Asia/Colombo"), or "UTC" if undetectable. */
function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/** Human offset like "UTC+5:30" for a zone, computed for the current instant (DST-aware). */
function offsetLabel(tz: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      timeZoneName: "shortOffset",
    }).formatToParts(new Date());
    const name = parts.find((p) => p.type === "timeZoneName")?.value ?? "";
    return name.replace("GMT", "UTC") || "UTC+0";
  } catch {
    return "";
  }
}

/**
 * Timezone setting. All times across the app (post cards, calendar, schedule) render in this
 * zone. If the stored value is still the onboarding default "UTC" but the browser is elsewhere,
 * we adopt the detected zone once automatically so dates look right without manual setup.
 */
function TimezoneCard({ initial }: { initial: string }) {
  const router = useRouter();
  const [tz, setTz] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [autoNote, setAutoNote] = useState<string | null>(null);
  const didAuto = useRef(false);

  // Offset/detection rely on the browser, so only show them after mount (avoids hydration drift).
  useEffect(() => setMounted(true), []);

  const detected = useMemo(() => detectTimezone(), []);
  const zones = useMemo(() => {
    try {
      const list = (
        Intl as unknown as { supportedValuesOf?: (k: string) => string[] }
      ).supportedValuesOf?.("timeZone");
      if (list && list.length) return list;
    } catch {
      /* fall through */
    }
    return FALLBACK_ZONES;
  }, []);

  async function save(next: string): Promise<boolean> {
    setBusy(true);
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ timezone: next }),
    });
    setBusy(false);
    if (!res.ok) return false;
    setTz(next);
    router.refresh(); // re-render server pages (cards/calendar) in the new zone
    return true;
  }

  // One-time auto-adopt of the detected zone when the account is still on the default UTC.
  useEffect(() => {
    if (didAuto.current) return;
    didAuto.current = true;
    if (initial === "UTC" && detected !== "UTC") {
      void save(detected).then((ok) => {
        if (ok) setAutoNote(`Updated to your detected timezone: ${detected}.`);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dirty = tz !== initial;

  return (
    <SettingCard
      title="Timezone"
      description="Times across Spanlyfy (posts, calendar, scheduling) are shown in this zone."
    >
      {mounted && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Globe className="h-3.5 w-3.5" />
          Detected: <span className="font-medium text-foreground">{detected}</span>
          <span>({offsetLabel(detected)})</span>
          {detected !== tz && (
            <button
              type="button"
              onClick={() => save(detected)}
              className="ml-1 underline hover:text-foreground"
            >
              Use this
            </button>
          )}
        </p>
      )}
      <div className="flex items-center gap-3">
        <Select value={tz} onValueChange={setTz}>
          <SelectTrigger className="w-[260px]">
            <SelectValue placeholder="Select timezone">
              {tz} {mounted ? `(${offsetLabel(tz)})` : ""}
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {zones.map((z) => (
              <SelectItem key={z} value={z}>
                {z}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          loading={busy}
          disabled={!dirty || busy}
          onClick={async () => {
            const ok = await save(tz);
            if (ok) {
              setSaved(true);
              setTimeout(() => setSaved(false), 1500);
            }
          }}
        >
          Save
        </Button>
        {saved && <span className="text-xs text-primary">Saved</span>}
      </div>
      {autoNote && <p className="text-xs text-primary">{autoNote}</p>}
    </SettingCard>
  );
}

function EmailCard({ email, verified }: { email: string; verified: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Email-verification OTP flow (settings step-up).
  const [isVerified, setIsVerified] = useState(verified);
  const [otpOpen, setOtpOpen] = useState(false);
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [otpMsg, setOtpMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function sendCode() {
    setSending(true);
    setOtpMsg(null);
    setCode("");
    const res = await fetch("/api/auth/send-email-otp", { method: "POST" });
    const data = await res.json().catch(() => null);
    setSending(false);
    if (res.ok) {
      if (data?.alreadyVerified) {
        setIsVerified(true);
        setOtpOpen(false);
        router.refresh();
        return;
      }
      setOtpOpen(true);
      setOtpMsg({ ok: true, text: `We emailed a 6-digit code to ${email}.` });
    } else {
      setOtpOpen(true);
      setOtpMsg({ ok: false, text: data?.error ?? "Could not send the code." });
    }
  }

  async function verifyCode(submitted?: string) {
    // onComplete passes the full value; the `code` state can still be stale within the same event.
    const value = submitted ?? code;
    if (value.length !== 6) return;
    setVerifying(true);
    setOtpMsg(null);
    const res = await fetch("/api/auth/verify-email-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: value }),
    });
    const data = await res.json().catch(() => null);
    setVerifying(false);
    if (res.ok) {
      setIsVerified(true);
      setOtpOpen(false);
      router.refresh();
    } else {
      setOtpMsg({ ok: false, text: data?.error ?? "Invalid code." });
    }
  }

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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm">{email}</span>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              isVerified ? "bg-primary/10 text-primary" : "bg-amber-100 text-amber-700"
            }`}
          >
            {isVerified ? "Verified" : "Unverified"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {!isVerified && (
            <Popover open={otpOpen} onOpenChange={setOtpOpen}>
              <PopoverAnchor asChild>
                <Button size="sm" loading={sending} onClick={sendCode}>
                  Verify email
                </Button>
              </PopoverAnchor>
              <PopoverContent align="end" className="w-72">
                <div className="flex flex-col gap-3">
                  <div>
                    <p className="text-sm font-medium">Confirm your email</p>
                    <p className="text-xs text-muted-foreground">Enter the 6-digit code we sent.</p>
                  </div>
                  <div className="flex justify-center">
                    <InputOTP
                      maxLength={6}
                      autoFocus
                      value={code}
                      onChange={(v) => setCode(v)}
                      onComplete={(v) => verifyCode(v)}
                    >
                      <InputOTPGroup>
                        <InputOTPSlot index={0} />
                        <InputOTPSlot index={1} />
                        <InputOTPSlot index={2} />
                        <InputOTPSlot index={3} />
                        <InputOTPSlot index={4} />
                        <InputOTPSlot index={5} />
                      </InputOTPGroup>
                    </InputOTP>
                  </div>
                  <Button size="sm" loading={verifying} disabled={code.length !== 6} onClick={() => verifyCode()}>
                    Verify
                  </Button>
                  <button
                    type="button"
                    onClick={sendCode}
                    disabled={sending}
                    className="text-xs text-muted-foreground underline hover:text-foreground disabled:opacity-50"
                  >
                    {sending ? "Sending…" : "Resend code"}
                  </button>
                  {otpMsg && (
                    <p className={`text-xs ${otpMsg.ok ? "text-primary" : "text-destructive"}`}>{otpMsg.text}</p>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          )}
          <Button variant="outline" size="sm" onClick={() => setOpen((o) => !o)}>
            Change Email
          </Button>
        </div>
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
          <Button size="sm" loading={busy} disabled={!newEmail || !password} onClick={submit}>
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
        <Button loading={busy} disabled={current.length < 1 || next.length < 8} onClick={submit}>
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
          loading={busy}
          onClick={async () => {
            setBusy(true);
            await fetch("/api/auth/signout-all", { method: "POST" });
            router.push("/login");
          }}
        >
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
          loading={busy}
          disabled={!valid || n === initial}
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
          Save
        </Button>
        {saved && <span className="text-xs text-primary">Saved</span>}
      </div>
    </SettingCard>
  );
}

function McpCard({ endpoint }: { endpoint: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <SettingCard
      title="Connect to Claude (MCP)"
      description="Manage Spanlyfy from an AI agent. Add this MCP endpoint and authenticate with an API key."
    >
      <div className="flex items-center gap-2">
        <Input value={endpoint} readOnly className="font-mono text-xs" />
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            navigator.clipboard.writeText(endpoint);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href="/help/mcp">Setup Guide</Link>
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Requires the API add-on. Create a key under{" "}
        <Link href="/api-keys" className="underline">
          API Keys
        </Link>{" "}
        and send it as <code className="rounded bg-muted px-1">Authorization: Bearer &lt;key&gt;</code>.
      </p>
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
