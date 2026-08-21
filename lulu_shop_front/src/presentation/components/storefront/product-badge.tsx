import {
  getProductDisplayBadge,
  isReservedAutomaticProductBadge,
  type Product,
} from "@/core/domain/models/product";

type ProductBadgeProps = {
  product: Product;
};

export function ProductBadge({ product }: ProductBadgeProps) {
  const badge = getProductDisplayBadge(product);
  const isAutomatic =
    product.isNew && isReservedAutomaticProductBadge(badge);

  if (!badge) {
    return null;
  }

  return (
    <span
      className={`product-badge${isAutomatic ? " is-automatic-new" : ""}`}
    >
      {badge}
    </span>
  );
}
