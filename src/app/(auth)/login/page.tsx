"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthCard } from "@/components/auth/auth-card";
import { GoogleButton } from "@/components/auth/google-button";

// Friendly copy for the `?error=` codes the Google callback bounces back with.
const OAUTH_ERRORS: Record<string, string> = {
  oauth: "Google sign-in failed. Please try again.",
  oauth_cancelled: "Google sign-in was cancelled.",
  oauth_unverified: "Your Google email isn't verified, so we can't sign you in.",
  suspended: "This account has been suspended.",
};

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next");
  const errorCode = params.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(
    errorCode ? (OAUTH_ERRORS[errorCode] ?? "Sign-in failed. Please try again.") : null,
  );
  const [loading, setLoading] = useState(false);

  // New-device step-up: once the server replies `otpRequired`, swap the password form for the
  // code form. We keep email+password in state so "Resend code" can re-issue without re-typing.
  const [otpStep, setOtpStep] = useState(false);
  const [code, setCode] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  function goToApp(data: { redirect?: string }) {
    // Honor an explicit ?next (deep link), else the server's role-based target (staff → /admin).
    router.push(next || data.redirect || "/dashboard");
    router.refresh();
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      if (data.otpRequired) {
        setOtpStep(true);
        setNotice("We emailed a 6-digit code to verify this device. Enter it below.");
        return;
      }
      goToApp(data);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function onVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Invalid code.");
        return;
      }
      goToApp(data);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function onResend() {
    setError(null);
    setNotice(null);
    try {
      await fetch("/api/auth/resend-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      setNotice("A new code is on its way. It expires in 10 minutes.");
    } catch {
      setError("Network error. Please try again.");
    }
  }

  if (otpStep) {
    return (
      <AuthCard
        title="Verify it's you"
        description={`Enter the 6-digit code we emailed to ${email}.`}
      >
        {error && (
          <p className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
        )}
        {notice && !error && (
          <p className="mb-4 rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">{notice}</p>
        )}
        <form onSubmit={onVerifyOtp} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="code">Verification code</Label>
            <Input
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              required
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="h-11 text-center text-lg tracking-[0.5em]"
            />
          </div>
          <Button type="submit" loading={loading} disabled={code.length !== 6} className="h-11 rounded-full">
            {loading ? "Verifying…" : "Verify and continue"}
          </Button>
        </form>
        <div className="mt-4 flex items-center justify-between text-sm">
          <button type="button" onClick={onResend} className="text-primary hover:underline">
            Resend code
          </button>
          <button
            type="button"
            onClick={() => {
              setOtpStep(false);
              setCode("");
              setError(null);
              setNotice(null);
            }}
            className="text-muted-foreground hover:underline"
          >
            Back to login
          </button>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Welcome back"
      description="Sign in to your Spanlyfy account to schedule and publish across every channel from one place."
      footer={
        <>
          New to Spanlyfy?{" "}
          <Link href="/signup" className="font-medium text-primary hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      {error && (
        <p className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
      )}

      <GoogleButton next={next} className="h-11 rounded-full" />

      <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-11"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link href="/forgot" className="text-xs text-primary hover:underline">
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              tabIndex={-1}
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:text-foreground"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <Button type="submit" loading={loading} className="h-11 rounded-full">
          {loading ? "Signing in…" : "Sign in with email"}
        </Button>
      </form>
    </AuthCard>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
