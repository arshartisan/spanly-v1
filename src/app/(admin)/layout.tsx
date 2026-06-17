import { requireStaff } from "@/server/admin/access";
import { planLabel } from "@/server/plans";
import { AdminSidebar } from "@/components/admin/AdminSidebar";

// Staff-only admin shell (doc 15), mirroring (app)/layout.tsx. `requireStaff()`
// does the REAL authorization (redirects non-staff/suspended) - middleware only
// checked cookie presence. Wraps every /(admin)/* page.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const staff = await requireStaff();

  const label = staff.subscription
    ? planLabel(staff.subscription.plan, staff.subscription.status)
    : "No plan";

  return (
    <div className="app-bg flex h-screen overflow-hidden">
      <AdminSidebar
        user={{
          displayName: staff.displayName ?? staff.email,
          email: staff.email,
          avatarUrl: staff.avatarUrl,
        }}
        planLabel={label}
      />
      <main className="flex-1 overflow-y-auto">
        {/* TODO Phase G: impersonation banner */}
        {children}
      </main>
    </div>
  );
}
