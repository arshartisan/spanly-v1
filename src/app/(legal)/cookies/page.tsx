import type { Metadata } from "next";
import { CookiePolicy } from "@/components/legal/CookiePolicy";

export const metadata: Metadata = {
  title: "Cookie Policy - Spanlyfy",
  description: "The cookies Spanlyfy uses, why, and how to manage your choices.",
};

export default function CookiesPage() {
  return <CookiePolicy />;
}
