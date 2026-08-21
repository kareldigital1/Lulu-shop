import type { Metadata } from "next";
import { loadStorefrontData } from "@/lib/load-storefront-data";
import { createPageMetadata } from "@/lib/seo";
import { AboutPage } from "@/presentation/components/storefront/about-page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = createPageMetadata({
  title: "À propos | Tata Lulu Shop",
  description:
    "Découvrez l'histoire, la vision et les engagements de Tata Lulu Shop, friperie femme à Abomey-Calavi au Bénin.",
  path: "/a-propos",
});

export default async function StoreAboutPage() {
  const { store, products } = await loadStorefrontData();

  return <AboutPage store={store} products={products} />;
}
