export type ProductAvailability = "available" | "unavailable";

export const CLOTHING_SIZES = [
  "XS",
  "S",
  "M",
  "L",
  "XL",
  "XXL",
  "3XL",
  "TU",
  "NON_RENSEIGNEE",
] as const;

export type ClothingSize = (typeof CLOTHING_SIZES)[number];

export const DEFAULT_CLOTHING_SIZE: ClothingSize = "NON_RENSEIGNEE";

export const CLOTHING_SIZE_LABELS: Record<ClothingSize, string> = {
  XS: "XS",
  S: "S",
  M: "M",
  L: "L",
  XL: "XL",
  XXL: "XXL",
  "3XL": "3XL",
  TU: "Taille unique",
  NON_RENSEIGNEE: "Non renseignée",
};

export const PRODUCT_STATUSES = [
  "draft",
  "published",
  "hidden",
  "archived",
] as const;

export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export const PRODUCT_STATUS_LABELS: Record<ProductStatus, string> = {
  draft: "Brouillon",
  published: "Publié",
  hidden: "Masqué",
  archived: "Archivé",
};

export type ProductSizeStock = {
  size: ClothingSize;
  stock: number;
};

export type ProductVariant = {
  id: string;
  colorName: string;
  colorHex: string;
  images: string[];
  sizes: ProductSizeStock[];
  stock: number;
};

export function getVariantSizeStocks(
  variant: Pick<ProductVariant, "sizes" | "stock">,
): ProductSizeStock[] {
  if (variant.sizes?.length > 0) {
    return variant.sizes;
  }

  return [{ size: DEFAULT_CLOTHING_SIZE, stock: variant.stock }];
}

export function getVariantSizeStock(
  variant: Pick<ProductVariant, "sizes" | "stock">,
  size: ClothingSize,
) {
  return getVariantSizeStocks(variant).find((entry) => entry.size === size);
}

export function getProductVariants(
  product: Pick<Product, "variants" | "image" | "stock">,
): ProductVariant[] {
  if (product.variants.length > 0) {
    return product.variants.map((variant) => {
      const sizes = getVariantSizeStocks(variant);

      return {
        ...variant,
        sizes,
        stock: sizes.reduce((total, entry) => total + entry.stock, 0),
      };
    });
  }

  return [
    {
      id: "default",
      colorName: "Couleur unique",
      colorHex: "#D8C4A3",
      images: product.image ? [product.image] : [],
      sizes: [{ size: DEFAULT_CLOTHING_SIZE, stock: product.stock }],
      stock: product.stock,
    },
  ];
}

export function getStockFromProductVariants(variants: ProductVariant[]) {
  return variants.reduce(
    (total, variant) =>
      total +
      getVariantSizeStocks(variant).reduce(
        (variantTotal, entry) => variantTotal + entry.stock,
        0,
      ),
    0,
  );
}

export function getProductSizes(product: Pick<Product, "variants" | "image" | "stock">) {
  return Array.from(
    new Set(
      getProductVariants(product).flatMap((variant) =>
        getVariantSizeStocks(variant).map((entry) => entry.size),
      ),
    ),
  );
}

export function getPrimaryProductImage(variants: ProductVariant[], fallbackImage = "") {
  return variants.flatMap((variant) => variant.images).find(Boolean) ?? fallbackImage;
}

export function getAvailabilityFromStock(stock: number): ProductAvailability {
  return stock > 0 ? "available" : "unavailable";
}

export function isProductAvailable(product: Pick<Product, "stock" | "availability">) {
  return product.availability === "available" && product.stock > 0;
}

export function isProductPublished(
  product: Pick<Product, "status" | "isActive">,
) {
  return product.status === "published" && product.isActive;
}

export function parseProductPriceAmount(priceLabel: string) {
  const match = priceLabel.replace(/\u00a0|\u202f/g, " ").match(/\d[\d\s.]*/);

  if (!match) {
    return null;
  }

  const amount = Number(match[0].replace(/\D/g, ""));
  return Number.isSafeInteger(amount) && amount > 0 ? amount : null;
}

export function formatProductPrice(amount: number, template = "À partir de") {
  const formattedAmount = amount
    .toLocaleString("fr-FR")
    .replace(/\u00a0|\u202f/g, " ");
  const hasStartingPrefix = /(?:à|a)\s+partir/i.test(template);

  return `${hasStartingPrefix ? "À partir de " : ""}${formattedAmount} FCFA`;
}

export function getProductDisplayPrice(product: Pick<Product, "displayPriceLabel" | "priceLabel">) {
  return product.displayPriceLabel || product.priceLabel;
}

export function isReservedAutomaticProductBadge(value: string | null | undefined) {
  const normalized = value?.trim().toLocaleLowerCase("fr") ?? "";
  return normalized === "nouveau" || normalized === "nouveauté";
}

export function getProductDisplayBadge(
  product: Pick<Product, "displayBadge" | "badge">,
) {
  if (product.displayBadge) {
    return product.displayBadge;
  }

  return isReservedAutomaticProductBadge(product.badge)
    ? ""
    : product.badge?.trim() ?? "";
}

export function getPopularProducts(products: Product[]) {
  return products
    .filter((product) => product.isPopular)
    .sort(
      (left, right) =>
        (left.popularityRank ?? Number.MAX_SAFE_INTEGER) -
          (right.popularityRank ?? Number.MAX_SAFE_INTEGER) ||
        right.confirmedOrderCount - left.confirmedOrderCount ||
        right.confirmedQuantity - left.confirmedQuantity ||
        left.order - right.order,
    );
}

export type Product = {
  _id?: string;
  slug: string;
  reference: string;
  categoryId: string;
  category: string;
  types: string[];
  name: string;
  shortDescription: string;
  description: string;
  benefits: string[];
  priceLabel: string;
  priceAmount: number | null;
  promotionPrice: number | null;
  promotionStartAt: string | null;
  promotionEndAt: string | null;
  displayPriceLabel: string;
  currentPrice: number | null;
  isPromotionActive: boolean;
  discountPercentage: number | null;
  image: string;
  badge?: string;
  publishedAt: string | null;
  updatedAt: string | null;
  displayBadge: string;
  isNew: boolean;
  newBadgeExpiresAt: string | null;
  newBadgeDurationDays: number;
  confirmedOrderCount: number;
  confirmedQuantity: number;
  popularityRank: number | null;
  isPopular: boolean;
  whatsappMessage: string;
  featured: boolean;
  order: number;
  variants: ProductVariant[];
  stock: number;
  availability: ProductAvailability;
  status: ProductStatus;
  isActive: boolean;
};
