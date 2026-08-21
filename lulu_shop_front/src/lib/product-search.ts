import {
  CLOTHING_SIZE_LABELS,
  getProductSizes,
  type Product,
} from "@/core/domain/models/product";
import { getProductGroup } from "@/lib/product-category-groups";

function normalizeSearchValue(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr")
    .trim();
}

export function matchesProductSearch(product: Product, searchTerm: string) {
  const searchTokens = normalizeSearchValue(searchTerm)
    .split(/\s+/)
    .filter(Boolean);

  if (searchTokens.length === 0) {
    return true;
  }

  const searchableContent = normalizeSearchValue(
    [
      product.name,
      product.category,
      getProductGroup(product.category),
      product.types.join(" "),
      product.variants.map((variant) => variant.colorName).join(" "),
      getProductSizes(product)
        .map((size) => CLOTHING_SIZE_LABELS[size])
        .join(" "),
      product.reference,
    ].join(" "),
  );

  return searchTokens.every((token) => searchableContent.includes(token));
}
