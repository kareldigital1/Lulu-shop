import type { Metadata } from "next";
import { loadStorefrontData } from "@/lib/load-storefront-data";
import { createPageMetadata } from "@/lib/seo";
import { CatalogPage } from "@/presentation/components/storefront/catalog-page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = createPageMetadata({
  title: "Catalogue produits | Tata Lulu Shop",
  description:
    "Parcourez le catalogue Tata Lulu Shop et filtrez les robes, palazzos, t-shirts, crop tops, blazers, ceintures, combinaisons, nuisettes et autres pièces disponibles.",
  path: "/produits",
});

export default async function ProductsPage() {
  const { store, products } = await loadStorefrontData();

  return <CatalogPage store={store} products={products} />;
}
