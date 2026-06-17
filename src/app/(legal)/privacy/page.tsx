import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal/LegalDocument";
import { PRIVACY } from "@/lib/legal-content";

export const metadata: Metadata = {
  title: "Privacy Policy — Spanly",
  description: "How Spanly collects, uses, and protects your information.",
};

export default function PrivacyPage() {
  return <LegalDocument doc={PRIVACY} />;
}
