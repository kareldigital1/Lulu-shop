import { getHomepageContent } from "@/core/domain/use-cases/get-homepage-content.use-case";
import { getProducts } from "@/core/domain/use-cases/get-products.use-case";
import { fallbackStoreContent } from "@/lib/fallback-data";
import { productRepository, storeRepository } from "@/lib/container";

export async function loadStorefrontData() {
  const [storeResult, productsResult] = await Promise.allSettled([
    getHomepageContent(storeRepository),
    getProducts(productRepository),
  ]);

  const store = storeResult.status === "fulfilled" ? storeResult.value : fallbackStoreContent;
  const products = productsResult.status === "fulfilled" ? productsResult.value : [];

  return { store, products };
}
