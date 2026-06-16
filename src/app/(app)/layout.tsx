import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth";
import { planLabel } from "@/server/plans";
import { Sidebar } from "@/components/shell/Sidebar";
import { SmoothScroll } from "@/components/shell/SmoothScroll";

// Authenticated shell (doc 04). Server component: full DB session validation here
// (middleware only checked cookie presence). Wraps every /(app)/* page.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const label = user.subscription
    ? planLabel(user.subscription.plan, user.subscription.status)
    : "No plan";

  return (
    <div className="app-bg flex h-screen overflow-hidden">
      <Sidebar
        user={{
          displayName: user.displayName ?? user.email,
          email: user.email,
          avatarUrl: user.avatarUrl,
        }}
        planLabel={label}
      />
      <SmoothScroll>{children}</SmoothScroll>
    </div>
  );
}
