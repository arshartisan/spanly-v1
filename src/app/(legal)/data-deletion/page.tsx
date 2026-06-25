import { LegalDocument } from "@/components/legal/LegalDocument";
import { DATA_DELETION } from "@/lib/legal-content";

type Metadata = {
  title?: string;
  description?: string;
};

export const metadata: Metadata = {
  title: "Data Deletion Policy - Spanlyfy",
  description: "How to request deletion of personal data and how Spanlyfy processes deletion requests.",
};

export default function DataDeletionPage() {
  return <LegalDocument doc={DATA_DELETION} />;
}
