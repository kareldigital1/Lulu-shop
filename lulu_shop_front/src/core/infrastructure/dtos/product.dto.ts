import {
  DEFAULT_CLOTHING_SIZE,
  formatProductPrice,
  getAvailabilityFromStock,
  isReservedAutomaticProductBadge,
  parseProductPriceAmount,
  type Product,
  type ProductAvailability,
  type ProductStatus,
} from "../../domain/models/product";
import { resolveApiAssetUrl } from "../http/request-manager";

export type ProductDto = Omit<
  Product,
  | "reference"
  | "categoryId"
  | "availability"
  | "types"
  | "variants"
  | "status"
  | "priceAmount"
  | "promotionPrice"
  | "promotionStartAt"
  | "promotionEndAt"
  | "displayPriceLabel"
  | "currentPrice"
  | "isPromotionActive"
  | "discountPercentage"
  | "publishedAt"
  | "updatedAt"
  | "displayBadge"
  | "isNew"
  | "newBadgeExpiresAt"
  | "newBadgeDurationDays"
  | "confirmedOrderCount"
  | "confirmedQuantity"
  | "popularityRank"
  | "isPopular"
> & {
  reference?: string;
  categoryId?: string;
  availability?: ProductAvailability;
  types?: string[];
  variants?: Product["variants"];
  status?: ProductStatus;
  priceAmount?: number | null;
  promotionPrice?: number | null;
  promotionStartAt?: string | null;
  promotionEndAt?: string | null;
  displayPriceLabel?: string;
  currentPrice?: number | null;
  isPromotionActive?: boolean;
  discountPercentage?: number | null;
  publishedAt?: string | null;
  updatedAt?: string | null;
  displayBadge?: string;
  isNew?: boolean;
  newBadgeExpiresAt?: string | null;
  newBadgeDurationDays?: number;
  confirmedOrderCount?: number;
  confirmedQuantity?: number;
  popularityRank?: number | null;
  isPopular?: boolean;
};

export function mapProductDto(productDto: ProductDto): Product {
  const variants = (productDto.variants ?? []).map((variant) => ({
    ...variant,
    sizes:
      variant.sizes?.length > 0
        ? variant.sizes
        : [{ size: DEFAULT_CLOTHING_SIZE, stock: variant.stock }],
    images: variant.images.map(resolveApiAssetUrl),
  }));
  const fallbackImage = resolveApiAssetUrl(productDto.image);
  const status =
    productDto.status ?? (productDto.isActive ? "published" : "hidden");
  const priceAmount =
    productDto.priceAmount ?? parseProductPriceAmount(productDto.priceLabel);
  const hasValidPromotionDates =
    Boolean(productDto.promotionStartAt) &&
    Boolean(productDto.promotionEndAt);
  const isPromotionActive =
    productDto.isPromotionActive === true &&
    hasValidPromotionDates &&
    productDto.promotionPrice !== null &&
    productDto.promotionPrice !== undefined;
  const displayPriceLabel =
    productDto.displayPriceLabel ??
    (isPromotionActive && productDto.promotionPrice
      ? formatProductPrice(productDto.promotionPrice, productDto.priceLabel)
      : productDto.priceLabel);

  return {
    ...productDto,
    categoryId: productDto.categoryId ?? "",
    reference:
      productDto.reference?.trim() ||
      `TLS-${productDto.slug.trim().toUpperCase()}`,
    types: productDto.types ?? [],
    variants,
    image: variants.flatMap((variant) => variant.images).find(Boolean) ?? fallbackImage,
    availability: productDto.availability ?? getAvailabilityFromStock(productDto.stock),
    status,
    isActive: status === "published",
    priceAmount,
    promotionPrice: productDto.promotionPrice ?? null,
    promotionStartAt: productDto.promotionStartAt ?? null,
    promotionEndAt: productDto.promotionEndAt ?? null,
    displayPriceLabel,
    currentPrice: productDto.currentPrice ?? priceAmount,
    isPromotionActive,
    discountPercentage: isPromotionActive
      ? productDto.discountPercentage ?? null
      : null,
    publishedAt: productDto.publishedAt ?? null,
    updatedAt: productDto.updatedAt ?? null,
    displayBadge:
      productDto.displayBadge ??
      (isReservedAutomaticProductBadge(productDto.badge)
        ? ""
        : productDto.badge?.trim() ?? ""),
    isNew: productDto.isNew ?? false,
    newBadgeExpiresAt: productDto.newBadgeExpiresAt ?? null,
    newBadgeDurationDays: productDto.newBadgeDurationDays ?? 0,
    confirmedOrderCount: productDto.confirmedOrderCount ?? 0,
    confirmedQuantity: productDto.confirmedQuantity ?? 0,
    popularityRank: productDto.popularityRank ?? null,
    isPopular: productDto.isPopular ?? false,
  };
}
