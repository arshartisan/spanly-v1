import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { cn } from "@/lib/utils";

/**
 * Shared shell for every auth screen (login/signup/forgot/reset/verify). Mirrors the
 * single-card layout: brand emblem at the top, a welcome heading, a muted supporting line,
 * then the screen's controls and an optional legal/secondary footer. Sits on the ambient
 * backdrop from (auth)/layout.tsx.
 */
export function AuthCard({
  title,
  description,
  children,
  footer,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("glass w-full rounded-2xl p-7 sm:p-8", className)}>
      <Link href="/" aria-label="Spanlyfy" className="inline-flex">
        <Logo className="h-9" emblemOnly />
      </Link>

      <h1 className="mt-6 text-2xl font-semibold tracking-tight">{title}</h1>
      {description && (
        <p className="mt-2 text-sm leading-relaxed tracking-tighter text-muted-foreground">{description}</p>
      )}

      <div className="mt-7">{children}</div>

      {footer && <div className="mt-6 text-center text-xs text-muted-foreground">{footer}</div>}
    </div>
  );
}
