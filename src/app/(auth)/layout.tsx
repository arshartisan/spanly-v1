import Link from "next/link";

// Centered, card-style shell for all auth screens (login/signup/forgot/reset/verify).
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted px-4 py-10">
      <Link href="/" className="mb-6 flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary font-bold text-primary-foreground">
          S
        </div>
        <span className="text-2xl font-bold tracking-tight">Spanly</span>
      </Link>
      <div className="w-full max-w-sm">{children}</div>
      <p className="mt-6 text-center text-xs text-muted-foreground">
        Social scheduling for Facebook, Instagram, LinkedIn, TikTok, YouTube &amp; X.
      </p>
    </div>
  );
}
