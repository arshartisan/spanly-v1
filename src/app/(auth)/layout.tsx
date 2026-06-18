import Link from "next/link";
import { Logo } from "@/components/brand/Logo";

// Centered, card-style shell for all auth screens (login/signup/forgot/reset/verify).
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted px-4 py-10">
      <Link href="/" className="mb-6 flex items-center" aria-label="Spanlyfy">
        <Logo className="h-9" />
      </Link>
      <div className="w-full max-w-sm">{children}</div>
      <p className="mt-6 text-center text-xs text-muted-foreground">
        Social scheduling for Facebook, Instagram, LinkedIn, TikTok, YouTube &amp; X.
      </p>
      <nav className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
        <Link href="/terms" className="hover:text-foreground">
          Terms
        </Link>
        <Link href="/privacy" className="hover:text-foreground">
          Privacy
        </Link>
      </nav>
    </div>
  );
}
