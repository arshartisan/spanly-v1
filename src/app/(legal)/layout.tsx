import Link from "next/link";
import { ManageCookiesButton } from "@/components/consent/ManageCookiesButton";

// Public reading shell for legal pages (Terms / Privacy). Accessible without authentication
// (these paths are not in middleware's PROTECTED_PREFIXES), so prospective and signed-out
// users can read them. Simple top bar + footer that cross-links the two documents.
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary font-bold text-primary-foreground">
              S
            </div>
            <span className="text-lg font-bold tracking-tight">Spanlyfy</span>
          </Link>
          <nav className="flex items-center gap-4 text-sm text-muted-foreground">
            <Link href="/terms" className="hover:text-foreground">
              Terms
            </Link>
            <Link href="/privacy" className="hover:text-foreground">
              Privacy
            </Link>
            <Link href="/cookies" className="hover:text-foreground">
              Cookies
            </Link>
            <Link href="/login" className="hover:text-foreground">
              Log in
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 px-6 py-10 md:py-14">{children}</main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-3xl flex-col items-center justify-between gap-2 px-6 py-6 text-xs text-muted-foreground sm:flex-row">
          <span>© {new Date().getFullYear()} Spanlyfy. All rights reserved.</span>
          <nav className="flex items-center gap-4">
            <Link href="/terms" className="hover:text-foreground">
              Terms of Service
            </Link>
            <Link href="/privacy" className="hover:text-foreground">
              Privacy Policy
            </Link>
            <Link href="/cookies" className="hover:text-foreground">
              Cookie Policy
            </Link>
            <ManageCookiesButton />
          </nav>
        </div>
      </footer>
    </div>
  );
}
