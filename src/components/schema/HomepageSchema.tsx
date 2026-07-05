/**
 * HomepageSchema — SoftwareApplication + WebPage JSON-LD
 *
 * Placed in the (marketing) homepage page.tsx (or its layout) so these
 * types only render on the homepage, not on every route.
 *
 * SoftwareApplication with Offer[] is Google's supported rich result for
 * SaaS tools — it can surface star ratings and price in Search.
 * The three Offer nodes mirror the live plan catalog (Creator/Growth/Pro).
 */
export function HomepageSchema() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": "https://spanlyfy.com/#webpage",
        url: "https://spanlyfy.com/",
        name: "Spanlyfy — Social scheduling, simplified",
        description:
          "Schedule and publish content across Facebook, Instagram, LinkedIn, TikTok, YouTube, and X from one place.",
        isPartOf: { "@id": "https://spanlyfy.com/#website" },
        about: { "@id": "https://spanlyfy.com/#software" },
        inLanguage: "en-US",
        breadcrumb: {
          "@type": "BreadcrumbList",
          "@id": "https://spanlyfy.com/#breadcrumb-home",
          itemListElement: [
            {
              "@type": "ListItem",
              position: 1,
              name: "Home",
              item: "https://spanlyfy.com/",
            },
          ],
        },
      },
      {
        "@type": "SoftwareApplication",
        "@id": "https://spanlyfy.com/#software",
        name: "Spanlyfy",
        url: "https://spanlyfy.com/",
        applicationCategory: "BusinessApplication",
        // Secondary category for more specific matching in knowledge panels.
        applicationSubCategory: "Social Media Management",
        operatingSystem: "Web",
        description:
          "Spanlyfy unifies scheduling, publishing and tracking for Facebook, Instagram, LinkedIn, TikTok, YouTube and X — one workflow, every channel.",
        image: "https://spanlyfy.com/emblem-black.svg",
        screenshot: "https://spanlyfy.com/hero-emblem-3d.png",
        featureList: [
          "Multi-platform publishing",
          "Post scheduling and queue management",
          "Carousel support",
          "Bulk upload and scheduling",
          "Content studio",
          "Analytics",
          "REST API and MCP endpoint add-on",
          "Facebook, Instagram, LinkedIn, TikTok, YouTube, X support",
        ],
        offers: [
          {
            "@type": "Offer",
            name: "Creator",
            description:
              "Best for growing creators. Includes 15 connected social accounts, unlimited posts, scheduling, carousels, bulk tools, content studio, analytics, and API add-on availability.",
            price: "29.00",
            priceCurrency: "USD",
            priceSpecification: {
              "@type": "UnitPriceSpecification",
              price: "29.00",
              priceCurrency: "USD",
              billingIncrement: 1,
              unitCode: "MON",
            },
            url: "https://spanlyfy.com/#pricing",
            availability: "https://schema.org/InStock",
            seller: { "@id": "https://spanlyfy.com/#organization" },
          },
          {
            "@type": "Offer",
            name: "Growth",
            description:
              "Best for growing teams and agencies. Includes 50 connected social accounts, everything in Creator, viral content tools, and priority support.",
            price: "49.00",
            priceCurrency: "USD",
            priceSpecification: {
              "@type": "UnitPriceSpecification",
              price: "49.00",
              priceCurrency: "USD",
              billingIncrement: 1,
              unitCode: "MON",
            },
            url: "https://spanlyfy.com/#pricing",
            availability: "https://schema.org/InStock",
            seller: { "@id": "https://spanlyfy.com/#organization" },
          },
          {
            "@type": "Offer",
            name: "Pro",
            description:
              "Best for scaling brands. Includes unlimited connected social accounts, everything in Growth, viral consulting, and team member invites.",
            price: "99.00",
            priceCurrency: "USD",
            priceSpecification: {
              "@type": "UnitPriceSpecification",
              price: "99.00",
              priceCurrency: "USD",
              billingIncrement: 1,
              unitCode: "MON",
            },
            url: "https://spanlyfy.com/#pricing",
            availability: "https://schema.org/InStock",
            seller: { "@id": "https://spanlyfy.com/#organization" },
          },
        ],
        publisher: { "@id": "https://spanlyfy.com/#organization" },
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
