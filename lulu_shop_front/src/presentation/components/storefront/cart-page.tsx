"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo } from "react";
import { Clock, Eye, Minus, Plus, Plus as PlusIcon, ShoppingBag, SlidersHorizontal, Store, Trash2 } from "lucide-react";
import type { Product } from "@/core/domain/models/product";
import {
  CLOTHING_SIZE_LABELS,
  getProductDisplayPrice,
  getProductVariants,
  getVariantSizeStock,
} from "@/core/domain/models/product";
import type { StoreContent } from "@/core/domain/models/store";
import { formatProductCategory } from "@/lib/product-category-groups";
import { useCart } from "@/presentation/providers/cart-provider";
import { WhatsappIcon } from "@/presentation/components/ui/brand-icons";
import { ProductPhotoBackdrop } from "./product-photo-backdrop";
import { storefrontNavbarLinks } from "./storefront-links";
import { StorefrontFloatingActions } from "./storefront-floating-actions";
import { StorefrontFooter } from "./storefront-footer";
import { StorefrontNavigation } from "./storefront-navigation";

type CartPageProps = {
  store: StoreContent;
  products: Product[];
};

const navigationLinks = storefrontNavbarLinks;

export function CartPage({ store, products }: CartPageProps) {
  const { items, hasHydrated, removeItem, updateQuantity, clearCart } = useCart();

  const productMap = useMemo(
    () => new Map(products.filter((product) => product.isActive).map((product) => [product.slug, product])),
    [products],
  );

  const cartLines = useMemo(
    () =>
      items.map((item) => {
        const liveProduct = productMap.get(item.slug);
        const liveVariant = liveProduct
          ? getProductVariants(liveProduct).find((variant) => variant.id === item.variantId)
          : undefined;
        const liveSizeStock = liveVariant
          ? getVariantSizeStock(liveVariant, item.size)
          : undefined;
        const stock = liveSizeStock?.stock ?? item.stock;
        const isActive = Boolean(liveProduct?.isActive && liveVariant && liveSizeStock);

        return {
          ...item,
          category: liveProduct?.category ?? item.category,
          name: liveProduct?.name ?? item.name,
          shortDescription: liveProduct?.shortDescription ?? item.shortDescription,
          image: liveVariant?.images[0] ?? liveProduct?.image ?? item.image,
          colorName: liveVariant?.colorName ?? item.colorName,
          colorHex: liveVariant?.colorHex ?? item.colorHex,
          priceLabel: liveProduct
            ? getProductDisplayPrice(liveProduct)
            : item.priceLabel,
          whatsappMessage: liveProduct?.whatsappMessage ?? item.whatsappMessage,
          stock,
          isActive,
        };
      }),
    [items, productMap],
  );

  const totalItems = useMemo(
    () => cartLines.reduce((total, item) => total + item.quantity, 0),
    [cartLines],
  );

  const whatsappCartUrl = useMemo(() => {
    const whatsappBaseUrl = `https://wa.me/${store.whatsappNumber.replace(/[^\d]/g, "")}`;
    const lines = cartLines
      .map(
        (item, index) =>
          `${index + 1}. ${item.name} — ${item.colorName} / ${CLOTHING_SIZE_LABELS[item.size]} x${item.quantity} (${item.priceLabel})`,
      )
      .join("\n");

    const message =
      "Bonjour Tata Lulu, je souhaite commander les articles suivants :\n\n" +
      `${lines}\n\n` +
      "Merci de me confirmer la disponibilité et le montant final.";

    return `${whatsappBaseUrl}?text=${encodeURIComponent(message)}`;
  }, [cartLines, store.whatsappNumber]);

  useEffect(() => {
    cartLines.forEach((item) => {
      if (item.stock > 0 && item.quantity > item.stock) {
        updateQuantity(item.lineId, item.stock);
      }
    });
  }, [cartLines, updateQuantity]);

  return (
    <>
      <StorefrontNavigation store={store} products={products} links={navigationLinks} logoHref="/" />

      <main id="main-content">
        <section className="catalog-hero cart-hero">
          <div className="hero-bg-orb orb-1" aria-hidden="true" />
          <div className="hero-bg-orb orb-2" aria-hidden="true" />
          <div className="hero-bg-orb orb-3" aria-hidden="true" />

          <div className="container product-detail-hero-shell">
            <p className="catalog-kicker">Panier</p>
            <h1 className="catalog-page-title">Ta sélection, prête à envoyer</h1>
            <p className="catalog-page-copy">
              Rassemble tes coups de cœur ici, puis envoie la liste complète sur WhatsApp en un seul message.
            </p>
          </div>
        </section>

        <section className="section cart-section">
          <div className="container">
            {!hasHydrated ? (
              // État de chargement : la structure occupe déjà sa place finale,
              // ce qui évite un saut de mise en page à l'hydratation.
              <div className="cart-empty" role="status" aria-live="polite">
                <h2>Chargement du panier...</h2>
                <p>On récupère les articles enregistrés sur cet appareil.</p>
              </div>
            ) : cartLines.length === 0 ? (
              <div className="cart-empty">
                <ShoppingBag
                  size={48}
                  strokeWidth={1.25}
                  aria-hidden="true"
                  style={{ margin: "0 auto var(--space-5)", color: "var(--color-text-tertiary)" }}
                />
                <h2>Ton panier est encore vide</h2>
                <p>
                  Ce n&apos;est pas un bug, c&apos;est juste qu&apos;aucun produit n&apos;a encore été sélectionné. Va au
                  catalogue et ajoute les pièces qui méritent vraiment d&apos;être commandées.
                </p>
                <Link href="/produits" className="btn btn-primary btn-lg">
                  <SlidersHorizontal size={17} strokeWidth={1.75} aria-hidden="true" />
                  Parcourir les produits
                </Link>
              </div>
            ) : (
              <div className="cart-layout">
                <div className="cart-items">
                  {cartLines.map((item) => {
                    const isOutOfStock = item.stock <= 0 || !item.isActive;

                    return (
                      <article className="cart-item-card" key={item.lineId}>
                        <Link
                          href={`/produits/${item.slug}?color=${encodeURIComponent(item.variantId)}&size=${encodeURIComponent(item.size)}`}
                          className="cart-item-image"
                        >
                          <ProductPhotoBackdrop src={item.image} />
                          <Image
                            src={item.image}
                            alt={item.name}
                            width={640}
                            height={800}
                            loading="lazy"
                            sizes="(max-width: 700px) 100vw, 180px"
                          />
                        </Link>

                        <div className="cart-item-copy">
                          <div className="cart-item-heading">
                            <div>
                              <p className="product-category">{formatProductCategory(item.category)}</p>
                              <h2>{item.name}</h2>
                            </div>
                            <button
                              type="button"
                              className="cart-remove-btn"
                              onClick={() => removeItem(item.lineId)}
                              aria-label={`Retirer ${item.name} du panier`}
                            >
                              <Trash2 size={17} strokeWidth={1.75} aria-hidden="true" />
                            </button>
                          </div>

                          <p className="cart-item-description">{item.shortDescription}</p>
                          <p className="cart-variant-label">
                            <span style={{ backgroundColor: item.colorHex }} aria-hidden="true" />
                            Couleur : {item.colorName}
                          </p>
                          <p className="cart-size-label">
                            Taille : {CLOTHING_SIZE_LABELS[item.size]}
                          </p>

                          <div className="cart-item-meta">
                            <p className={`product-stock ${isOutOfStock ? "empty" : "available"}`}>
                              {isOutOfStock
                                ? "Indisponible pour le moment"
                                : `${item.stock} en stock • ${item.quantity} sélectionné${item.quantity > 1 ? "s" : ""}`}
                            </p>
                            <p className="product-price cart-item-price">{item.priceLabel}</p>
                          </div>

                          <div className="cart-item-actions">
                            <div className="quantity-stepper">
                              <button
                                type="button"
                                className="quantity-btn"
                                onClick={() => updateQuantity(item.lineId, item.quantity - 1)}
                                aria-label={`Réduire la quantité de ${item.name}`}
                                disabled={item.quantity <= 1}
                              >
                                <Minus size={16} strokeWidth={2} aria-hidden="true" />
                              </button>
                              <span className="quantity-value">{item.quantity}</span>
                              <button
                                type="button"
                                className="quantity-btn"
                                onClick={() => updateQuantity(item.lineId, item.quantity + 1)}
                                aria-label={`Augmenter la quantité de ${item.name}`}
                                disabled={isOutOfStock || item.quantity >= item.stock}
                              >
                                <Plus size={16} strokeWidth={2} aria-hidden="true" />
                              </button>
                            </div>

                            <Link
                              href={`/produits/${item.slug}?color=${encodeURIComponent(item.variantId)}&size=${encodeURIComponent(item.size)}`}
                              className="detail-btn cart-line-link"
                            >
                              <Eye size={15} strokeWidth={1.75} aria-hidden="true" />
                              Voir la fiche
                            </Link>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>

                <aside className="cart-summary-card" aria-label="Résumé du panier">
                  <p className="section-label left">Résumé</p>
                  <h2>Ton panier en un coup d&apos;œil</h2>
                  <p>
                    <strong>{totalItems}</strong> article{totalItems > 1 ? "s" : ""} sélectionné
                    {totalItems > 1 ? "s" : ""}. On évite volontairement un faux total numérique, car tes prix sont
                    encore saisis en libellés et non en montants calculables.
                  </p>

                  <div className="cart-summary-points">
                    <div>
                      <WhatsappIcon size={17} aria-hidden="true" />
                      <span>Le panier prépare un message propre pour WhatsApp.</span>
                    </div>
                    <div>
                      <Store size={17} strokeWidth={1.75} aria-hidden="true" />
                      <span>Le montant final et la disponibilité se confirment avec la boutique.</span>
                    </div>
                    <div>
                      <Clock size={17} strokeWidth={1.75} aria-hidden="true" />
                      <span>Horaires actuels : {store.locationSection.openingHours}</span>
                    </div>
                  </div>

                  <div className="cart-summary-actions">
                    <a
                      href={whatsappCartUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-whatsapp btn-lg btn-block"
                    >
                      <WhatsappIcon size={17} aria-hidden="true" />
                      Commander le panier
                    </a>
                    <Link href="/produits" className="detail-btn">
                      <PlusIcon size={15} strokeWidth={1.75} aria-hidden="true" />
                      Ajouter d&apos;autres produits
                    </Link>
                    <button type="button" className="cart-clear-btn" onClick={clearCart}>
                      <Trash2 size={14} strokeWidth={1.75} aria-hidden="true" />
                      Vider le panier
                    </button>
                  </div>
                </aside>
              </div>
            )}
          </div>
        </section>
      </main>

      <StorefrontFooter store={store} navigationLinks={navigationLinks} />
      <StorefrontFloatingActions whatsappUrl={store.whatsappUrl} />
    </>
  );
}
