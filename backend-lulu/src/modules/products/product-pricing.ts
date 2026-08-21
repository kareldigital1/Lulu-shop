export type ProductPromotionSource = {
  priceLabel: string;
  priceAmount?: number | null;
  promotionPrice?: number | null;
  promotionStartAt?: Date | string | null;
  promotionEndAt?: Date | string | null;
};

export type ResolvedProductPricing = {
  displayPriceLabel: string;
  currentPrice: number | null;
  isPromotionActive: boolean;
  discountPercentage: number | null;
};

function toValidDate(value: Date | string | null | undefined) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function parsePriceAmount(priceLabel: string) {
  const match = priceLabel.replace(/\u00a0|\u202f/g, " ").match(/\d[\d\s.]*/);

  if (!match) {
    return null;
  }

  const amount = Number(match[0].replace(/\D/g, ""));
  return Number.isSafeInteger(amount) && amount > 0 ? amount : null;
}

export function formatPriceAmount(amount: number, template = "") {
  const formattedAmount = amount
    .toLocaleString("fr-FR")
    .replace(/\u00a0|\u202f/g, " ");
  const hasStartingPrefix = /(?:à|a)\s+partir/i.test(template);

  return `${hasStartingPrefix ? "À partir de " : ""}${formattedAmount} FCFA`;
}

export function resolveProductPricing(
  product: ProductPromotionSource,
  now = new Date(),
): ResolvedProductPricing {
  const regularPrice =
    product.priceAmount ?? parsePriceAmount(product.priceLabel);
  const promotionStartAt = toValidDate(product.promotionStartAt);
  const promotionEndAt = toValidDate(product.promotionEndAt);
  const promotionPrice = product.promotionPrice ?? null;
  const isPromotionActive =
    regularPrice !== null &&
    promotionPrice !== null &&
    promotionPrice > 0 &&
    promotionPrice < regularPrice &&
    promotionStartAt !== null &&
    promotionEndAt !== null &&
    now >= promotionStartAt &&
    now <= promotionEndAt;

  if (!isPromotionActive || promotionPrice === null || regularPrice === null) {
    return {
      displayPriceLabel: product.priceLabel,
      currentPrice: regularPrice,
      isPromotionActive: false,
      discountPercentage: null,
    };
  }

  return {
    displayPriceLabel: formatPriceAmount(promotionPrice, product.priceLabel),
    currentPrice: promotionPrice,
    isPromotionActive: true,
    discountPercentage:
      Math.round(
        ((regularPrice - promotionPrice) / regularPrice) * 1_000,
      ) / 10,
  };
}

export function decorateProductPricing<T extends ProductPromotionSource>(
  product: T,
  now = new Date(),
) {
  return {
    ...product,
    ...resolveProductPricing(product, now),
  };
}

export function assertValidPromotion(product: ProductPromotionSource) {
  const regularPrice =
    product.priceAmount ?? parsePriceAmount(product.priceLabel);
  const promotionPrice = product.promotionPrice ?? null;
  const promotionStartAt = toValidDate(product.promotionStartAt);
  const promotionEndAt = toValidDate(product.promotionEndAt);
  const hasPromotionValue = [
    promotionPrice,
    product.promotionStartAt,
    product.promotionEndAt,
  ].some((value) => value !== null && value !== undefined && value !== "");

  if (!hasPromotionValue) {
    return;
  }

  if (
    regularPrice === null ||
    promotionPrice === null ||
    promotionStartAt === null ||
    promotionEndAt === null
  ) {
    throw new Error(
      "Le prix normal, le prix promotionnel, le début et la fin sont tous obligatoires.",
    );
  }

  if (promotionPrice >= regularPrice) {
    throw new Error(
      "Le prix promotionnel doit être inférieur au prix normal.",
    );
  }

  if (promotionEndAt <= promotionStartAt) {
    throw new Error(
      "La fin de la promotion doit être postérieure à son début.",
    );
  }
}
