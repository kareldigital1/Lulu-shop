"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Minus, Phone, Plus, ShoppingBag, MapPin } from "lucide-react";
import {
  CLOTHING_SIZE_LABELS,
  getProductDisplayPrice,
  getProductVariants,
  getVariantSizeStocks,
  type ClothingSize,
  type Product,
} from "@/core/domain/models/product";
import type { StoreContent } from "@/core/domain/models/store";
import { formatProductCategory } from "@/lib/product-category-groups";
import { useCart } from "@/presentation/providers/cart-provider";
import { WhatsappIcon } from "@/presentation/components/ui/brand-icons";
import { ProductPhotoBackdrop } from "./product-photo-backdrop";
import { ProductBadge } from "./product-badge";
import { ProductPrice } from "./product-price";
import { storefrontNavbarLinks } from "./storefront-links";
import { StorefrontFloatingActions } from "./storefront-floating-actions";
import { StorefrontFooter } from "./storefront-footer";
import { StorefrontNavigation } from "./storefront-navigation";

type ProductDetailPageProps = {
  store: StoreContent;
  product: Product;
  products: Product[];
  relatedProducts: Product[];
};

const navigationLinks = storefrontNavbarLinks;

const LOW_STOCK_THRESHOLD = 3;

function getStockStatus(stock: number) {
  if (stock <= 0) {
    return { className: "empty", label: "Rupture de stock" };
  }

  if (stock <= LOW_STOCK_THRESHOLD) {
    return {
      className: "low",
      label: stock === 1 ? "Dernière pièce disponible" : `Plus que ${stock} en stock`,
    };
  }

  return { className: "available", label: `${stock} en stock` };
}

export function ProductDetailPage({
  store,
  product,
  products,
  relatedProducts,
}: ProductDetailPageProps) {
  const searchParams = useSearchParams();
  const { addItem, getItemQuantity, hasHydrated, openCart } = useCart();
  const variants = useMemo(() => getProductVariants(product), [product]);
  const requestedVariantId = searchParams.get("color");
  const requestedSize = searchParams.get("size") as ClothingSize | null;
  const initialVariant =
    variants.find((variant) => variant.id === requestedVariantId) ??
    variants.find((variant) => variant.stock > 0) ??
    variants[0];
  const [selectedVariantId, setSelectedVariantId] = useState(initialVariant.id);
  const selectedVariant =
    variants.find((variant) => variant.id === selectedVariantId) ?? initialVariant;
  const initialSizeStock =
    getVariantSizeStocks(initialVariant).find(
      (entry) => entry.size === requestedSize,
    ) ??
    getVariantSizeStocks(initialVariant).find((entry) => entry.stock > 0) ??
    getVariantSizeStocks(initialVariant)[0];
  const [selectedSize, setSelectedSize] = useState<ClothingSize>(
    initialSizeStock.size,
  );
  const selectedSizeStock =
    getVariantSizeStocks(selectedVariant).find(
      (entry) => entry.size === selectedSize,
    ) ?? getVariantSizeStocks(selectedVariant)[0];
  const selectedStock = selectedSizeStock?.stock ?? 0;
  const selectedImages =
    selectedVariant.images.length > 0 ? selectedVariant.images : [product.image];
  const [selectedImage, setSelectedImage] = useState(
    selectedImages[0] ?? product.image,
  );
  const [quantity, setQuantity] = useState(selectedStock > 0 ? 1 : 0);
  const quantityInCart = getItemQuantity(
    product.slug,
    selectedVariant.id,
    selectedSize,
  );
  const stockStatus = getStockStatus(selectedStock);

  const whatsappOrderUrl = useMemo(() => {
    const whatsappBaseUrl = `https://wa.me/${store.whatsappNumber.replace(/[^\d]/g, "")}`;
    const quantityLabel = quantity > 1 ? `${quantity} exemplaires` : "1 exemplaire";
    const message =
      `Bonjour Tata Lulu, je souhaite commander ${quantityLabel} du produit "${product.name}".` +
      `\n\nRéférence: ${product.reference}` +
       `\nCouleur: ${selectedVariant.colorName}` +
      `\nTaille: ${CLOTHING_SIZE_LABELS[selectedSize]}` +
      `\nPrix indiqué: ${getProductDisplayPrice(product)}`;

    return `${whatsappBaseUrl}?text=${encodeURIComponent(message)}`;
  }, [
    product,
    quantity,
    selectedVariant.colorName,
    selectedSize,
    store.whatsappNumber,
  ]);

  function selectVariant(variantId: string) {
    const variant = variants.find((entry) => entry.id === variantId);

    if (!variant) {
      return;
    }

    setSelectedVariantId(variant.id);
    setSelectedImage(variant.images[0] ?? product.image);
    const nextSizeStock =
      getVariantSizeStocks(variant).find((entry) => entry.stock > 0) ??
      getVariantSizeStocks(variant)[0];
    setSelectedSize(nextSizeStock.size);
    setQuantity(nextSizeStock.stock > 0 ? 1 : 0);
  }

  function selectSize(size: ClothingSize) {
    const sizeStock = getVariantSizeStocks(selectedVariant).find(
      (entry) => entry.size === size,
    );

    if (!sizeStock) {
      return;
    }

    setSelectedSize(size);
    setQuantity(sizeStock.stock > 0 ? 1 : 0);
  }

  function decreaseQuantity() {
    setQuantity((current) => Math.max(selectedStock > 0 ? 1 : 0, current - 1));
  }

  function increaseQuantity() {
    setQuantity((current) => Math.min(selectedStock, current + 1));
  }

  function handleAddToCart() {
    addItem(product, quantity, selectedVariant, selectedSize);
  }

  return (
    <>
      <StorefrontNavigation store={store} products={products} links={navigationLinks} logoHref="/" />

      <main id="main-content" className="product-detail-page">
        <section className="section product-detail-section">
          <div className="container product-detail-page-shell">
            <div className="product-detail-back-row">
              <Link href="/produits" className="product-detail-back-link">
                <ArrowLeft size={16} strokeWidth={2} aria-hidden="true" />
                Retour au catalogue
              </Link>
              <p className="product-detail-crumb">{formatProductCategory(product.category)}</p>
            </div>

            <div className="product-detail-layout">
              <div className="product-detail-media-shell">
                <div className="product-detail-gallery">
                  <div className="product-detail-media">
                    <ProductPhotoBackdrop src={selectedImage} />
                    <Image
                      key={selectedImage}
                      src={selectedImage}
                      alt={`${product.name}, couleur ${selectedVariant.colorName}`}
                      width={1200}
                      height={1500}
                      preload
                      sizes="(max-width: 980px) 100vw, 45vw"
                      quality={82}
                    />
                    <ProductBadge product={product} />
                  </div>

                  {selectedImages.length > 1 ? (
                    <div className="product-detail-thumbnails" aria-label={`Photos ${selectedVariant.colorName}`}>
                      {selectedImages.map((image, index) => (
                        <button
                          type="button"
                          className={`product-detail-thumbnail ${selectedImage === image ? "is-active" : ""}`}
                          key={`${image}-${index}`}
                          aria-label={`Afficher la photo ${index + 1}`}
                          aria-pressed={selectedImage === image}
                          onClick={() => setSelectedImage(image)}
                        >
                          <Image
                            src={image}
                            alt=""
                            width={180}
                            height={180}
                            loading="lazy"
                            sizes="100px"
                            quality={60}
                          />
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="product-detail-copy-shell">
                <div className="product-detail-header">
                  <p className="product-detail-kicker">{formatProductCategory(product.category)}</p>
                  <p className="product-detail-reference">Réf. {product.reference}</p>
                  <h1 className="product-detail-title">{product.name}</h1>
                  <p className="product-detail-lead">{product.shortDescription}</p>
                  {product.types.length > 0 ? (
                    <div className="product-type-list" aria-label="Types du produit">
                      {product.types.map((type) => (
                        <span key={type}>{type}</span>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="product-detail-meta">
                  <ProductPrice
                    product={product}
                    className="product-detail-price"
                  />
                  <p className={`product-stock ${stockStatus.className}`}>{stockStatus.label}</p>
                </div>

                <div className="product-variant-selector">
                  <div className="product-variant-selector-head">
                    <span>Couleur</span>
                    <strong>{selectedVariant.colorName}</strong>
                  </div>
                  <div className="product-variant-options">
                    {variants.map((variant) => (
                      <button
                        type="button"
                        className={`product-variant-option ${selectedVariant.id === variant.id ? "is-active" : ""} ${variant.stock <= 0 ? "is-empty" : ""}`}
                        key={variant.id}
                        aria-pressed={selectedVariant.id === variant.id}
                        onClick={() => selectVariant(variant.id)}
                      >
                        <span
                          className="product-variant-swatch"
                          style={{ backgroundColor: variant.colorHex }}
                          aria-hidden="true"
                        />
                        {variant.colorName}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="product-variant-selector product-size-selector">
                  <div className="product-variant-selector-head">
                    <span>Taille</span>
                    <strong>{CLOTHING_SIZE_LABELS[selectedSize]}</strong>
                  </div>
                  <div className="product-size-options">
                    {getVariantSizeStocks(selectedVariant).map((entry) => (
                      <button
                        type="button"
                        className={`product-size-option ${selectedSize === entry.size ? "is-active" : ""} ${entry.stock <= 0 ? "is-empty" : ""}`}
                        key={entry.size}
                        aria-pressed={selectedSize === entry.size}
                        onClick={() => selectSize(entry.size)}
                      >
                        {CLOTHING_SIZE_LABELS[entry.size]}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="product-detail-purchase-panel">
                  {quantityInCart > 0 ? (
                    <div className="product-detail-cart-state">
                      <p className="product-detail-cart-note">
                        <ShoppingBag size={14} strokeWidth={2} aria-hidden="true" />
                        {quantityInCart} déjà dans ton panier
                      </p>
                      <button type="button" className="product-detail-cart-link" onClick={openCart}>
                        Voir le panier
                        <ArrowRight size={14} strokeWidth={2} aria-hidden="true" />
                      </button>
                    </div>
                  ) : null}

                  <div className="product-detail-actions-shell">
                    <div className="quantity-stepper">
                      <button
                        type="button"
                        className="quantity-btn"
                        onClick={decreaseQuantity}
                        aria-label="Réduire la quantité"
                        disabled={selectedStock <= 0 || quantity <= 1}
                      >
                        <Minus size={16} strokeWidth={2} aria-hidden="true" />
                      </button>
                      {/* La quantité est annoncée à chaque changement plutôt que
                          de rester un simple nombre muet. */}
                      <span className="quantity-value" role="status" aria-live="polite">
                        {quantity}
                        <span className="sr-only"> exemplaire{quantity > 1 ? "s" : ""}</span>
                      </span>
                      <button
                        type="button"
                        className="quantity-btn"
                        onClick={increaseQuantity}
                        aria-label="Augmenter la quantité"
                        disabled={selectedStock <= 0 || quantity >= selectedStock}
                      >
                        <Plus size={16} strokeWidth={2} aria-hidden="true" />
                      </button>
                    </div>

                    <button
                      type="button"
                      className="product-btn product-detail-cart-btn"
                      onClick={handleAddToCart}
                      disabled={selectedStock <= 0 || !hasHydrated}
                    >
                      <ShoppingBag size={16} strokeWidth={1.75} aria-hidden="true" />
                      {selectedStock <= 0
                        ? "Indisponible"
                        : hasHydrated
                          ? "Ajouter au panier"
                          : "Chargement..."}
                    </button>

                    <a
                      href={whatsappOrderUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="detail-btn product-detail-whatsapp-btn"
                    >
                      <WhatsappIcon size={16} aria-hidden="true" />
                      Commander directement
                    </a>
                  </div>
                </div>

                <div className="product-detail-description-shell">
                  <p className="product-detail-subtitle">À propos de cette pièce</p>
                  <p className="product-detail-description">{product.description}</p>
                </div>

                <div className="product-detail-benefits-shell">
                  <p className="product-detail-subtitle">Pourquoi cette pièce mérite ton attention</p>
                  <ul className="product-detail-benefits">
                    {product.benefits.map((benefit) => (
                      <li key={benefit}>
                        <Check size={17} strokeWidth={2.5} aria-hidden="true" />
                        <span>{benefit}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="product-detail-support">
                  <div className="product-detail-support-card">
                    <MapPin size={40} strokeWidth={1.75} aria-hidden="true" />
                    <div>
                      <strong>Retrait ou passage boutique</strong>
                      <p>{store.locationSection.addressLines.join(", ")}</p>
                    </div>
                  </div>
                  <div className="product-detail-support-card">
                    <Phone size={40} strokeWidth={1.75} aria-hidden="true" />
                    <div>
                      <strong>Besoin d&apos;un conseil rapide ?</strong>
                      <p>
                        {store.primaryPhone} • {store.secondaryPhone}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {relatedProducts.length > 0 ? (
              <div className="product-related-shell">
                <div className="product-related-heading">
                  <p className="section-label left">À voir aussi</p>
                  <h3 className="section-title">D&apos;autres pièces qui vont bien avec cette visite</h3>
                  <p className="section-subtitle">
                    Si la première pièce te plaît, ne t&apos;arrête pas là. Le vrai risque, c&apos;est de repartir sans
                    avoir vu le reste.
                  </p>
                </div>

                <div className="products-grid">
                  {relatedProducts.map((relatedProduct, index) => (
                    <article className="product-card" key={relatedProduct.slug}>
                      <Link
                        href={`/produits/${relatedProduct.slug}`}
                        className={`product-img product-img-${(index % 4) + 1}`}
                        aria-label={`Voir la fiche de ${relatedProduct.name}`}
                      >
                        <ProductPhotoBackdrop src={relatedProduct.image} />
                        <Image
                          src={relatedProduct.image}
                          alt={relatedProduct.name}
                          width={640}
                          height={800}
                          loading="lazy"
                          sizes="(max-width: 600px) 100vw, (max-width: 1024px) 50vw, 25vw"
                        />
                        <ProductBadge product={relatedProduct} />
                      </Link>
                      <div className="product-info">
                        <p className="product-category">{formatProductCategory(relatedProduct.category)}</p>
                        <h4 className="product-name">
                          <Link
                            href={`/produits/${relatedProduct.slug}`}
                            aria-label={`Voir la fiche de ${relatedProduct.name}`}
                          >
                            {relatedProduct.name}
                          </Link>
                        </h4>
                        <p className="product-desc">{relatedProduct.shortDescription}</p>
                        <ProductPrice product={relatedProduct} />
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </section>
      </main>

      <StorefrontFooter store={store} navigationLinks={navigationLinks} />
      <StorefrontFloatingActions whatsappUrl={store.whatsappUrl} />
    </>
  );
}
