export const POPULAR_PRODUCT_LIMIT = 4;

export type ProductPopularity = {
  confirmedOrderCount: number;
  confirmedQuantity: number;
  popularityRank: number | null;
  isPopular: boolean;
};

export type ProductPopularityIdentity = {
  id: string;
  order: number;
};

export type ProductSalesTotal = {
  productId: string;
  confirmedOrderCount: number;
  confirmedQuantity: number;
};

export const EMPTY_PRODUCT_POPULARITY: ProductPopularity = {
  confirmedOrderCount: 0,
  confirmedQuantity: 0,
  popularityRank: null,
  isPopular: false,
};

export function rankProductPopularity(
  products: ProductPopularityIdentity[],
  totals: ProductSalesTotal[],
  limit = POPULAR_PRODUCT_LIMIT,
) {
  const productOrder = new Map(
    products.map((product) => [product.id, product.order]),
  );
  const knownTotals = totals
    .filter(
      (total) =>
        productOrder.has(total.productId) &&
        total.confirmedOrderCount > 0,
    )
    .sort(
      (left, right) =>
        right.confirmedOrderCount - left.confirmedOrderCount ||
        right.confirmedQuantity - left.confirmedQuantity ||
        (productOrder.get(left.productId) ?? 0) -
          (productOrder.get(right.productId) ?? 0) ||
        left.productId.localeCompare(right.productId),
    );
  const popularity = new Map<string, ProductPopularity>();

  products.forEach((product) => {
    popularity.set(product.id, { ...EMPTY_PRODUCT_POPULARITY });
  });

  knownTotals.forEach((total, index) => {
    popularity.set(total.productId, {
      confirmedOrderCount: total.confirmedOrderCount,
      confirmedQuantity: total.confirmedQuantity,
      popularityRank: index + 1,
      isPopular: index < Math.max(0, limit),
    });
  });

  return popularity;
}
