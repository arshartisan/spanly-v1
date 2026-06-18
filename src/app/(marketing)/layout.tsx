import { MarketingNav } from "@/components/marketing/MarketingNav";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { MarketingSmoothScroll } from "@/components/marketing/MarketingSmoothScroll";

// Public marketing shell. Unlike the app/auth shells this does NOT force a single theme:
// each section paints its own background (orange / black / cream color-blocking), so the
// landing reads identically regardless of the visitor's light/dark preference.
export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-[hsl(20_14%_5%)] tracking-tight">
      <MarketingSmoothScroll />
      <MarketingNav />
      <main className="flex-1">{children}</main>
      <MarketingFooter />
    </div>
  );
}
