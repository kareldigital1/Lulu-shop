"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Minus,
  Plus,
  ShoppingBag,
  Trash2,
  X,
} from "lucide-react";
import type { Order } from "@/core/domain/models/order";
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
import { createOrder } from "@/services/order.service";
import { ProductPhotoBackdrop } from "./product-photo-backdrop";

type CartDrawerProps = {
  store: StoreContent;
  products: Product[];
};

function getCartDrawerStockState(stock: number, isActive: boolean) {
  if (!isActive || stock <= 0) {
    return { tone: "empty", label: "Indisponible" };
  }

  if (stock <= 3) {
    return {
      tone: "low",
      label: stock === 1 ? "Dernière pièce" : `Plus que ${stock}`,
    };
  }

  return { tone: "available", label: "En stock" };
}

export function CartDrawer({ store, products }: CartDrawerProps) {
  const {
    items,
    hasHydrated,
    isCartOpen,
    removeItem,
    updateQuantity,
    clearCart,
    closeCart,
  } = useCart();
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerNote, setCustomerNote] = useState("");
  const [checkoutRequestId, setCheckoutRequestId] = useState("");
  const [checkoutError, setCheckoutError] = useState("");
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [createdOrder, setCreatedOrder] = useState<Order | null>(null);

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

  function getWhatsappOrderUrl(order: Order) {
    const whatsappBaseUrl = `https://wa.me/${store.whatsappNumber.replace(/[^\d]/g, "")}`;
    const lines = order.items
      .map(
        (item, index) =>
          `${index + 1}. ${item.name} — ${item.colorName} / ${CLOTHING_SIZE_LABELS[item.size]} x${item.quantity} (${item.priceLabel})`,
      )
      .join("\n");

    const message =
      `Bonjour Tata Lulu, je souhaite finaliser la demande ${order.reference} :\n\n` +
      `${lines}\n\n` +
      "Nous pouvons modifier ou compléter cette commande pendant notre discussion.";

    return `${whatsappBaseUrl}?text=${encodeURIComponent(message)}`;
  }

  async function handleCreateOrder() {
    const normalizedName = customerName.trim();
    const normalizedPhone = customerPhone.trim();

    if (normalizedName.length < 2) {
      setCheckoutError("Indique ton nom avant de continuer.");
      return;
    }

    if (normalizedPhone.replace(/\D/g, "").length < 8) {
      setCheckoutError("Indique un numéro WhatsApp valide.");
      return;
    }

    if (cartLines.some((item) => !item.isActive || item.quantity > item.stock)) {
      setCheckoutError("Un article du panier n'est plus disponible dans cette quantité.");
      return;
    }

    const requestId = checkoutRequestId || window.crypto.randomUUID();
    const whatsappWindow = window.open("", "_blank");

    if (whatsappWindow) {
      whatsappWindow.opener = null;
      whatsappWindow.document.title = "Ouverture de WhatsApp...";
    }

    setCheckoutRequestId(requestId);
    setCheckoutError("");
    setIsCreatingOrder(true);

    try {
      const order = await createOrder({
        clientRequestId: requestId,
        customerName: normalizedName,
        customerPhone: normalizedPhone,
        note: customerNote.trim(),
        items: cartLines.map((item) => ({
          slug: item.slug,
          variantId: item.variantId,
          size: item.size,
          quantity: item.quantity,
        })),
      });
      const whatsappUrl = getWhatsappOrderUrl(order);

      setCreatedOrder(order);
      clearCart();

      if (whatsappWindow) {
        whatsappWindow.location.href = whatsappUrl;
      } else {
        window.open(whatsappUrl, "_blank", "noopener,noreferrer");
      }
    } catch {
      whatsappWindow?.close();
      setCheckoutError(
        "La demande n'a pas pu être créée. Vérifie le stock et réessaie.",
      );
    } finally {
      setIsCreatingOrder(false);
    }
  }

  useEffect(() => {
    if (!isCartOpen) {
      return undefined;
    }

    cartLines.forEach((item) => {
      if (item.stock > 0 && item.quantity > item.stock) {
        updateQuantity(item.lineId, item.stock);
      }
    });
  }, [cartLines, isCartOpen, updateQuantity]);

  useEffect(() => {
    if (!isCartOpen) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeCart();
      }
    };

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleEscape);
    };
  }, [closeCart, isCartOpen]);

  if (!isCartOpen) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        className="cart-drawer-overlay"
        aria-label="Fermer le panier"
        onClick={closeCart}
      />

      <aside
        className="cart-drawer"
        id="cartDrawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cartDrawerTitle"
      >
        <header className="cart-drawer-header">
          <div>
            <p className="cart-drawer-kicker">Votre panier</p>
            <h2 id="cartDrawerTitle">
              {createdOrder
                ? "Commande créée"
                : totalItems > 0
                ? `${totalItems} article${totalItems > 1 ? "s" : ""} prêt${totalItems > 1 ? "s" : ""}`
                : "Le panier est vide"}
            </h2>
          </div>

          <button
            type="button"
            className="cart-drawer-close"
            aria-label="Fermer le panier"
            onClick={closeCart}
          >
            <X size={18} strokeWidth={2} aria-hidden="true" />
          </button>
        </header>

        {!hasHydrated ? (
          <div className="cart-drawer-empty" role="status" aria-live="polite">
            <ShoppingBag size={34} strokeWidth={1.5} aria-hidden="true" />
            <h3>Chargement du panier...</h3>
            <p>On récupère les articles enregistrés sur cet appareil.</p>
          </div>
        ) : createdOrder ? (
          <div className="cart-order-success" role="status" aria-live="polite">
            <span className="cart-order-success-icon">
              <CheckCircle2 size={25} strokeWidth={1.8} aria-hidden="true" />
            </span>
            <p className="cart-drawer-kicker">Demande enregistrée</p>
            <h3>{createdOrder.reference}</h3>
            <p>
              La commande est en attente. Le stock sera déduit après validation
              avec Tata Lulu.
            </p>
            <a
              href={getWhatsappOrderUrl(createdOrder)}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary"
            >
              <WhatsappIcon size={16} aria-hidden="true" />
              Continuer sur WhatsApp
            </a>
            <button
              type="button"
              className="cart-order-success-reset"
              onClick={() => {
                setCreatedOrder(null);
                setCheckoutRequestId("");
                closeCart();
              }}
            >
              Fermer
            </button>
          </div>
        ) : cartLines.length === 0 ? (
          <div className="cart-drawer-empty">
            <ShoppingBag size={34} strokeWidth={1.5} aria-hidden="true" />
            <h3>Ton panier est encore vide</h3>
            <p>Ajoute une pièce depuis le catalogue et elle apparaîtra ici, sans quitter la page.</p>
            <Link href="/produits" className="btn btn-outline" onClick={closeCart}>
              Continuer mes achats
            </Link>
          </div>
        ) : (
          <div className="cart-drawer-content">
            <div className="cart-drawer-items">
              {cartLines.map((item) => {
                const isOutOfStock = item.stock <= 0 || !item.isActive;
                const stockState = getCartDrawerStockState(item.stock, item.isActive);

                return (
                  <article className="cart-drawer-item" key={item.lineId}>
                    <Link
                      href={`/produits/${item.slug}?color=${encodeURIComponent(item.variantId)}&size=${encodeURIComponent(item.size)}`}
                      className="cart-drawer-item-image"
                      onClick={closeCart}
                    >
                      <ProductPhotoBackdrop src={item.image} />
                      <Image
                        src={item.image}
                        alt={item.name}
                        width={320}
                        height={400}
                        loading="lazy"
                        sizes="128px"
                      />
                    </Link>

                    <div className="cart-drawer-item-copy">
                      <div className="cart-drawer-item-top">
                        <p className="cart-drawer-item-category">{formatProductCategory(item.category)}</p>

                        <button
                          type="button"
                          className="cart-drawer-remove"
                          onClick={() => removeItem(item.lineId)}
                          aria-label={`Retirer ${item.name} du panier`}
                        >
                          <Trash2 size={16} strokeWidth={1.85} aria-hidden="true" />
                        </button>
                      </div>

                      <div className="cart-drawer-item-main">
                        <div className="cart-drawer-item-title-row">
                          <Link
                            href={`/produits/${item.slug}?color=${encodeURIComponent(item.variantId)}&size=${encodeURIComponent(item.size)}`}
                            className="cart-drawer-item-title"
                            onClick={closeCart}
                          >
                            {item.name}
                          </Link>
                          <span className={`cart-drawer-stock ${stockState.tone}`}>{stockState.label}</span>
                        </div>
                        <p className="cart-drawer-item-price">{item.priceLabel}</p>
                        <p className="cart-variant-label">
                          <span style={{ backgroundColor: item.colorHex }} aria-hidden="true" />
                          {item.colorName}
                        </p>
                        <p className="cart-size-label">
                          Taille : {CLOTHING_SIZE_LABELS[item.size]}
                        </p>
                      </div>

                      <div className="cart-drawer-item-meta">
                        {!isOutOfStock ? (
                          <span className="cart-drawer-stock-note">
                            {item.stock} disponible{item.stock > 1 ? "s" : ""}
                          </span>
                        ) : null}
                      </div>

                      <div className="cart-drawer-item-footer">
                        <div className="cart-drawer-item-controls">
                          <span className="cart-drawer-quantity-label">Quantité</span>
                          <div className="quantity-stepper cart-drawer-stepper">
                            <button
                              type="button"
                              className="quantity-btn"
                              onClick={() => updateQuantity(item.lineId, item.quantity - 1)}
                              aria-label={`Réduire la quantité de ${item.name}`}
                              disabled={item.quantity <= 1}
                            >
                              <Minus size={15} strokeWidth={2} aria-hidden="true" />
                            </button>
                            <span className="quantity-value">{item.quantity}</span>
                            <button
                              type="button"
                              className="quantity-btn"
                              onClick={() => updateQuantity(item.lineId, item.quantity + 1)}
                              aria-label={`Augmenter la quantité de ${item.name}`}
                              disabled={isOutOfStock || item.quantity >= item.stock}
                            >
                              <Plus size={15} strokeWidth={2} aria-hidden="true" />
                            </button>
                          </div>
                        </div>

                        <Link
                          href={`/produits/${item.slug}?color=${encodeURIComponent(item.variantId)}&size=${encodeURIComponent(item.size)}`}
                          className="cart-drawer-item-link"
                          onClick={closeCart}
                        >
                          Voir la fiche
                          <ArrowRight size={13} strokeWidth={2} aria-hidden="true" />
                        </Link>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>

            <footer className="cart-drawer-summary">
              <div className="cart-drawer-summary-row">
                <span>Articles</span>
                <strong>{totalItems}</strong>
              </div>
              <div className="cart-drawer-summary-row">
                <span>Montant</span>
                <strong>Confirmé sur WhatsApp</strong>
              </div>

              <div className="cart-checkout-fields">
                <label>
                  Ton nom
                  <input
                    value={customerName}
                    onChange={(event) => setCustomerName(event.target.value)}
                    placeholder="Ex: Aïcha"
                    autoComplete="name"
                  />
                </label>
                <label>
                  Numéro WhatsApp
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={(event) => setCustomerPhone(event.target.value)}
                    placeholder="Ex: 01 23 45 67 89"
                    autoComplete="tel"
                  />
                </label>
                <label>
                  Précision <span>(facultatif)</span>
                  <textarea
                    value={customerNote}
                    onChange={(event) => setCustomerNote(event.target.value)}
                    placeholder="Livraison, autre article recherché..."
                    rows={2}
                  />
                </label>
              </div>

              {checkoutError ? (
                <p className="cart-checkout-error" role="alert">
                  {checkoutError}
                </p>
              ) : null}

              <div className="cart-drawer-actions">
                <Link href="/produits" className="btn btn-outline" onClick={closeCart}>
                  Continuer mes achats
                </Link>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => void handleCreateOrder()}
                  disabled={isCreatingOrder}
                  aria-busy={isCreatingOrder}
                >
                  <WhatsappIcon size={16} aria-hidden="true" />
                  {isCreatingOrder ? "Création..." : "Commander sur WhatsApp"}
                </button>
              </div>

              <button type="button" className="cart-drawer-clear" onClick={clearCart}>
                Vider le panier
              </button>
            </footer>
          </div>
        )}
      </aside>
    </>
  );
}
