import type { Product } from "@/core/domain/models/product";

type ProductPriceProps = {
  product: Product;
  className?: string;
};

export function ProductPrice({ product, className = "" }: ProductPriceProps) {
  const classes = ["product-price", className].filter(Boolean).join(" ");

  if (!product.isPromotionActive) {
    return <p className={classes}>{product.displayPriceLabel}</p>;
  }

  return (
    <div className={`${classes} product-price-promotion`}>
      <span className="product-price-current">{product.displayPriceLabel}</span>
      <span className="product-price-regular">{product.priceLabel}</span>
      {product.discountPercentage !== null ? (
        <span className="product-price-discount">
          -{product.discountPercentage.toLocaleString("fr-FR")}%
        </span>
      ) : null}
    </div>
  );
}
