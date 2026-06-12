import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Spanly — Social scheduling, simplified",
  description:
    "Schedule and publish content across Facebook, Instagram, LinkedIn, TikTok, YouTube, and X from one place.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
