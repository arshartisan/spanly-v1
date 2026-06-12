import Link from "next/link";
import { notFound } from "next/navigation";
import { PLATFORMS, PLATFORM_CONFIG, type PlatformKey } from "@/lib/platforms";
import { PLATFORM_STYLE } from "@/lib/platform-style";
import { Button } from "@/components/ui/button";

/**
 * Internal mock consent screen (docs/implementation/05). Stands in for the real provider
 * OAuth page so all 6 platforms can be connected with no developer apps. Rendered outside
 * the (app) shell to feel like an external page. "Allow" posts a fake code to our callback.
 */
export default async function MockConsentPage({
  params,
  searchParams,
}: {
  params: Promise<{ platform: string }>;
  searchParams: Promise<{ state?: string; method?: string }>;
}) {
  const { platform } = await params;
  if (!PLATFORMS.includes(platform as PlatformKey)) notFound();
  const key = platform as PlatformKey;

  const { state, method } = await searchParams;
  const style = PLATFORM_STYLE[key];
  const label = PLATFORM_CONFIG[key].label;
  const Icon = style.Icon;

  const allowHref = state
    ? `/api/connect/${key}/callback?code=mock-auth-code&state=${encodeURIComponent(state)}`
    : `/connections?error=state`;
  const cancelHref = `/connections?error=cancelled`;

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted p-4">
      <div className="w-full max-w-sm rounded-xl border bg-card p-6 text-card-foreground shadow-sm">
        <div className="mb-4 flex items-center gap-3">
          <span
            className="flex h-11 w-11 items-center justify-center rounded-lg text-white"
            style={{ backgroundColor: style.color }}
          >
            <Icon className="h-6 w-6" />
          </span>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Mock OAuth</p>
            <h1 className="text-lg font-semibold leading-tight">Connect {label}</h1>
          </div>
        </div>

        <p className="mb-1 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Spanly</span> wants to manage and publish
          posts to your {label} account.
        </p>
        {key === "instagram" && (
          <p className="mb-1 text-xs text-muted-foreground">
            Method: {method === "facebook" ? "Login with Facebook (Business/Creator + Page)" : "Login with Instagram"}
          </p>
        )}
        <p className="mb-5 text-xs text-muted-foreground">
          This is a development stand-in for the real {label} login. No real account is accessed.
        </p>

        <div className="flex gap-3">
          <Button asChild className="flex-1 bg-neutral-900 text-white hover:bg-neutral-800">
            <Link href={allowHref}>Allow</Link>
          </Button>
          <Button asChild variant="outline" className="flex-1">
            <Link href={cancelHref}>Cancel</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
