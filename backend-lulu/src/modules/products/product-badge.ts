export const AUTOMATIC_NEW_BADGE_LABEL = "Nouveau";

export type ProductBadgeSource = {
  badge?: string | null;
  status: string;
  publishedAt?: Date | string | null;
};

export type ResolvedProductBadge = {
  displayBadge: string;
  isNew: boolean;
  newBadgeExpiresAt: Date | null;
  newBadgeDurationDays: number;
};

export function isReservedAutomaticBadge(value: string | null | undefined) {
  const normalized = value?.trim().toLocaleLowerCase("fr") ?? "";
  return normalized === "nouveau" || normalized === "nouveauté";
}

function toValidDate(value: Date | string | null | undefined) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function resolveProductBadge(
  product: ProductBadgeSource,
  durationDays: number,
  now = new Date(),
): ResolvedProductBadge {
  const publishedAt = toValidDate(product.publishedAt);
  const normalizedDuration = Math.max(0, Math.floor(durationDays));
  const newBadgeExpiresAt =
    publishedAt && normalizedDuration > 0
      ? new Date(
          publishedAt.getTime() +
            normalizedDuration * 24 * 60 * 60 * 1_000,
        )
      : null;
  const isNew =
    product.status === "published" &&
    publishedAt !== null &&
    newBadgeExpiresAt !== null &&
    now >= publishedAt &&
    now < newBadgeExpiresAt;
  const manualBadge = isReservedAutomaticBadge(product.badge)
    ? ""
    : product.badge?.trim() ?? "";

  return {
    displayBadge:
      manualBadge || (isNew ? AUTOMATIC_NEW_BADGE_LABEL : ""),
    isNew,
    newBadgeExpiresAt,
    newBadgeDurationDays: normalizedDuration,
  };
}

export function decorateProductBadge<T extends ProductBadgeSource>(
  product: T,
  durationDays: number,
  now = new Date(),
) {
  return {
    ...product,
    ...resolveProductBadge(product, durationDays, now),
  };
}
