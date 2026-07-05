import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth";

import { Hero } from "@/components/marketing/Hero";
import { Capabilities } from "@/components/marketing/Capabilities";
import { PlatformStrip } from "@/components/marketing/PlatformStrip";
import { ValueProps } from "@/components/marketing/ValueProps";
import { OrangeStatement } from "@/components/marketing/OrangeStatement";
import { UseCases } from "@/components/marketing/UseCases";
import { HowItWorks } from "@/components/marketing/HowItWorks";
import { Pricing } from "@/components/marketing/Pricing";
import { Testimonials } from "@/components/marketing/Testimonials";
import { FAQ } from "@/components/marketing/FAQ";
import { FinalCTA } from "@/components/marketing/FinalCTA";
import { HomepageSchema } from "@/components/schema/HomepageSchema";

// Public homepage. Signed-in users skip the marketing page and go straight to the app;
// everyone else sees the landing (so the nav can always assume the signed-out state).
export default async function Home() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  return (
    <>
      <HomepageSchema />
      <Hero />
      <Capabilities />
      <PlatformStrip />
      <ValueProps />
      <OrangeStatement
        eyebrow="The shift"
        headline={
          <>
            Posting manually
            <br />
            isn&apos;t scaling anymore.
          </>
        }
        body={[
          "Your audience expects you everywhere - every day, on every platform. Doing that by hand means living in six tabs and never logging off.",
          "Spanlyfy turns that grind into a single workflow: write once, tailor per platform, and let the queue ship it on schedule.",
        ]}
      />
      <UseCases />
      <HowItWorks />
      <Pricing />
      <Testimonials />
      <FAQ />
      <OrangeStatement
        center
        eyebrow="Why it matters"
        headline={
          <>
            Great content is only valuable when
            <br className="hidden md:block" /> it actually gets published - consistently.
          </>
        }
      />
      <FinalCTA />
    </>
  );
}
