import type { Metadata } from "next";
import { loadStorefrontData } from "@/lib/load-storefront-data";
import { createPageMetadata } from "@/lib/seo";
import { serializeJsonLd } from "@/lib/serialize-json-ld";
import { getAbsoluteSiteUrl, getSiteUrl } from "@/lib/site-url";
import { Storefront } from "@/presentation/components/storefront/storefront";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { store } = await loadStorefrontData();

  return createPageMetadata({
    title: store.seoTitle,
    description: store.seoDescription,
    path: "/",
    image: store.openGraphImageUrl
      ? { url: store.openGraphImageUrl, alt: store.name }
      : undefined,
  });
}

export default async function HomePage() {
  const { store, products } = await loadStorefrontData();

  const baseUrl = getSiteUrl().origin;
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${baseUrl}/#website`,
        name: store.name,
        url: baseUrl,
        inLanguage: "fr-BJ",
      },
      {
        "@type": "ClothingStore",
        "@id": `${baseUrl}/#store`,
        name: store.name,
        url: baseUrl,
        image: store.logoUrl.startsWith("http")
          ? store.logoUrl
          : getAbsoluteSiteUrl(store.logoUrl || "/images/logo.png"),
        description: store.seoDescription,
        telephone: store.primaryPhone,
        email: store.email,
        address: {
          "@type": "PostalAddress",
          streetAddress: store.locationSection.addressLines.join(", "),
          addressLocality: store.locationSection.city,
          addressCountry: store.locationSection.country,
        },
        geo: {
          "@type": "GeoCoordinates",
          latitude: store.locationSection.gps.latitude,
          longitude: store.locationSection.gps.longitude,
        },
        hasMap: store.locationSection.mapUrl,
        contactPoint: {
          "@type": "ContactPoint",
          telephone: store.primaryPhone,
          contactType: "customer service",
          areaServed: "BJ",
          availableLanguage: ["fr"],
        },
        sameAs: [
          store.facebookUrl,
          store.instagramUrl,
          store.tiktokUrl,
          store.whatsappUrl,
        ].filter(Boolean),
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(structuredData) }}
      />
      <Storefront store={store} products={products} />
    </>
  );
}
