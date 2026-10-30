import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";

/**
 * Structured data for search engines. Everything here is a statement we can stand behind: it is a
 * free web application, published by a named person, that records business transactions. There is no
 * rating, review count, user count or price we cannot evidence, so none is claimed.
 */
export function StructuredData() {
  const graph = [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: SITE_NAME,
      url: SITE_URL,
      logo: `${SITE_URL}/icon.svg`,
      description: SITE_DESCRIPTION,
      founder: { "@type": "Person", name: "Marvel Adeniyi" },
      contactPoint: [
        {
          "@type": "ContactPoint",
          contactType: "customer support",
          email: "adeniyimarv@gmail.com",
          telephone: "+2348107387326",
          areaServed: "NG",
          availableLanguage: ["en"],
        },
      ],
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: SITE_NAME,
      inLanguage: "en-NG",
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
    {
      "@type": "SoftwareApplication",
      "@id": `${SITE_URL}/#app`,
      name: SITE_NAME,
      applicationCategory: "BusinessApplication",
      applicationSubCategory: "Bookkeeping",
      operatingSystem: "Web",
      url: `${SITE_URL}/signup`,
      description: SITE_DESCRIPTION,
      isAccessibleForFree: true,
      offers: { "@type": "Offer", price: "0", priceCurrency: "NGN" },
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
  ];

  return (
    <script
      type="application/ld+json"
      // Escape "<" so a stray character can never close the script tag early.
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({ "@context": "https://schema.org", "@graph": graph }).replace(/</g, "\\u003c"),
      }}
    />
  );
}
