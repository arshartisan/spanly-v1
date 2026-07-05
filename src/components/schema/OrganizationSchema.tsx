/**
 * OrganizationSchema + WebSite JSON-LD
 *
 * Placed in the ROOT layout so these graph nodes appear on every page.
 * Both blocks are site-wide signals — Organization tells Google who you
 * are; WebSite enables the Sitelinks search box (if Google ever surfaces
 * one) and anchors the @id graph.
 *
 * Usage: import and render inside <head> via Next.js App Router layout.
 */
export function OrganizationSchema() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": "https://spanlyfy.com/#organization",
        name: "Spanlyfy",
        url: "https://spanlyfy.com/",
        logo: {
          "@type": "ImageObject",
          url: "https://spanlyfy.com/logo-black.svg",
          width: 200,
          height: 40,
        },
        description:
          "Social media scheduling SaaS that lets creators, teams and agencies schedule and publish content across Facebook, Instagram, LinkedIn, TikTok, YouTube and X from one dashboard.",
        foundingDate: "2026",
        // Add verified social profile URLs here once accounts are live.
        // sameAs: [
        //   "https://twitter.com/spanlyfy",
        //   "https://www.linkedin.com/company/spanlyfy",
        //   "https://www.instagram.com/spanlyfy",
        // ],
      },
      {
        "@type": "WebSite",
        "@id": "https://spanlyfy.com/#website",
        url: "https://spanlyfy.com/",
        name: "Spanlyfy",
        description: "Schedule and publish content across Facebook, Instagram, LinkedIn, TikTok, YouTube, and X from one place.",
        publisher: {
          "@id": "https://spanlyfy.com/#organization",
        },
        inLanguage: "en-US",
        // SearchAction omitted: Spanlyfy has no public site-search endpoint.
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
