import type { MetadataRoute } from "next";
import { isProductPublished } from "@/core/domain/models/product";
import { getProducts } from "@/core/domain/use-cases/get-products.use-case";
import { productRepository } from "@/lib/container";
import { getAbsoluteSiteUrl } from "@/lib/site-url";

export const revalidate = 3_600;

/**
 * Le sitemap ne doit jamais faire échouer le build ni la revalidation : si
 * l'API est injoignable, on publie les pages statiques sans les fiches
 * produits, comme le fait déjà `loadStorefrontData` pour la boutique.
 */
async function loadPublishedProducts() {
  try {
    const products = await getProducts(productRepository);
    return products.filter(isProductPublished);
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const publishedProducts = await loadPublishedProducts();

  return [
    {
      url: getAbsoluteSiteUrl("/"),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: getAbsoluteSiteUrl("/produits"),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: getAbsoluteSiteUrl("/a-propos"),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    ...publishedProducts.map((product) => {
      const modifiedAtValue = product.updatedAt ?? product.publishedAt;
      const modifiedAt = modifiedAtValue
        ? new Date(modifiedAtValue)
        : null;
      const hasValidModifiedAt =
        modifiedAt !== null && !Number.isNaN(modifiedAt.getTime());

      return {
        url: getAbsoluteSiteUrl(`/produits/${product.slug}`),
        ...(hasValidModifiedAt ? { lastModified: modifiedAt } : {}),
        changeFrequency: "weekly" as const,
        priority: 0.8,
      };
    }),
  ];
}
