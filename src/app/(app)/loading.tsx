import { GenericPageSkeleton } from "@/components/skeletons/page-skeletons";

// Baseline loading UI for any /(app)/* route that doesn't define its own loading.tsx.
export default function Loading() {
  return <GenericPageSkeleton />;
}
