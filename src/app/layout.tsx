import type { Metadata } from "next";
import { Inter } from "next/font/google";
import localFont from "next/font/local";
import { ThemeProvider } from "@/components/theme-provider";
import { ConsentProvider } from "@/components/consent/ConsentProvider";
import { AnalyticsScripts } from "@/components/consent/AnalyticsScripts";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

// Neue Machina - display/title face (Pangram Pangram, personal-use license).
const neueMachina = localFont({
  src: [
    { path: "./fonts/neuemachina-light.otf", weight: "300", style: "normal" },
    { path: "./fonts/neuemachina-regular.otf", weight: "400", style: "normal" },
    { path: "./fonts/neuemachina-ultrabold.otf", weight: "800", style: "normal" },
  ],
  variable: "--font-neue-machina",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Spanlyfy - Social scheduling, simplified",
  description:
    "Schedule and publish content across Facebook, Instagram, LinkedIn, TikTok, YouTube, and X from one place.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${neueMachina.variable} min-h-screen font-sans tracking-tight antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <ConsentProvider>
            {children}
            <AnalyticsScripts />
          </ConsentProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
