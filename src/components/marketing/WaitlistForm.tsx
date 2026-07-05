"use client";

import { useId, useState } from "react";
import { CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// Interactive waitlist capture. POSTs { email, source: "landing" } to /api/waitlist and swaps
// itself for a confirmation on success. Validates the email client-side first (HTML5 + a simple
// regex) so obvious typos never hit the API, then surfaces server errors (400 / 429 / network)
// inline. Error styling mirrors <FlagToggle/> (`text-status-failed`, small text).

// Deliberately loose - the server (zod) is the source of truth; this only catches obvious typos.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Success = { position: number; alreadyJoined: boolean };

export function WaitlistForm({ className }: { className?: string }) {
  const inputId = useId();
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<Success | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    setError(null);

    const trimmed = email.trim();
    if (!EMAIL_RE.test(trimmed)) {
      setError("Enter a valid email address.");
      return;
    }

    setPending(true);
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed, source: "landing" }),
      });

      if (res.ok) {
        const data = (await res.json()) as Success & { count: number };
        setSuccess({ position: data.position, alreadyJoined: data.alreadyJoined });
        return;
      }

      if (res.status === 429) {
        setError("Too many attempts. Try again shortly.");
        return;
      }

      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(data?.error ?? "Something went wrong. Please try again.");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setPending(false);
    }
  }

  if (success) {
    return (
      <div
        className={cn(
          "flex items-start gap-3 rounded-[12px] border border-white/10 bg-white/[0.03] p-4 backdrop-blur-sm",
          className,
        )}
        role="status"
        aria-live="polite"
      >
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-status-posted" aria-hidden />
        <div>
          <p className="font-display text-sm uppercase tracking-tight text-[hsl(30_25%_96%)]">
            {success.alreadyJoined ? "You're already on the list" : "You're on the list"}
          </p>
          <p className="mt-1 text-sm text-[hsl(30_18%_86%)]">
            {success.alreadyJoined
              ? `You're #${success.position} in line - we'll be in touch soon.`
              : `You're #${success.position} in line. We'll email you the moment your invite is ready.`}
          </p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className={cn("w-full max-w-md", className)}>
      <div className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor={inputId} className="sr-only">
          Email address
        </label>
        <Input
          id={inputId}
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          disabled={pending}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${inputId}-error` : undefined}
          className="h-11 flex-1 border-white/15 bg-white/[0.04] text-[hsl(30_25%_96%)] placeholder:text-[hsl(30_10%_60%)] focus-visible:ring-[hsl(22_92%_52%)] focus-visible:ring-offset-0"
        />
        <Button
          type="submit"
          size="lg"
          loading={pending}
          className="h-11 rounded-[6px] sm:w-auto"
        >
          Join the waitlist
        </Button>
      </div>

      <div aria-live="polite" className="min-h-[1.25rem]">
        {error ? (
          <p id={`${inputId}-error`} className="mt-2 text-[13px] text-status-failed">
            {error}
          </p>
        ) : null}
      </div>
    </form>
  );
}
