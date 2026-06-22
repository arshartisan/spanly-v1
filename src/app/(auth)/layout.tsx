// Centered shell for all auth screens (login/signup/forgot/reset/verify). The card carries the
// brand + copy (see AuthCard); this layer just provides the ambient backdrop and centering.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-10">
      {/* Warm ambient glow behind the card. */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[620px] w-[620px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-[130px]"
      />
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
