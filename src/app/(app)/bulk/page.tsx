import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth";
import { listBulkAccounts } from "@/server/bulk";
import { BulkImportView } from "@/components/bulk/BulkImportView";

// Bulk Import (Phase 9). Upload/paste a CSV → validate → preview → commit as drafts,
// scheduled, or queued posts. Reuses the same composer rules as single-post creation.
export default async function BulkImportPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const accounts = await listBulkAccounts(user.id);
  return <BulkImportView accounts={accounts} timezone={user.timezone} />;
}
