import { AdminPageSkeleton } from "@/components/skeletons/page-skeletons";

// Baseline loading UI for every /(admin)/* route (overview, users, content, billing, …).
// A stat grid + table shape that reads correctly for both the KPI overview and list pages.
export default function Loading() {
  return <AdminPageSkeleton />;
}
