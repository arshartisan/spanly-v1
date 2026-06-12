import Link from "next/link";
import { cn } from "@/lib/utils";

// Settings tab bar (doc 11). Four route-backed tabs; the active one is underlined.
const TABS = [
  { key: "general", label: "Settings", href: "/settings/general" },
  { key: "queue", label: "Queue", href: "/settings/queue" },
  { key: "billing", label: "Billing", href: "/settings/billing" },
  { key: "plans", label: "Plans", href: "/settings/plans" },
] as const;

export type SettingsTab = (typeof TABS)[number]["key"];

export function SettingsTabs({ active }: { active: SettingsTab }) {
  return (
    <div className="border-b">
      <nav className="flex gap-1">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={t.href}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              t.key === active
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
