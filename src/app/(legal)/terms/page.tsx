import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal/LegalDocument";
import { TERMS } from "@/lib/legal-content";

export const metadata: Metadata = {
  title: "Terms of Service - Spanlyfy",
  description: "The terms governing your use of Spanlyfy.",
};

export default function TermsPage() {
  return <LegalDocument doc={TERMS} />;
}
