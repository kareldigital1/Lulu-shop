"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { CartItem } from "@/core/domain/models/cart";
import {
  DEFAULT_CLOTHING_SIZE,
  getProductDisplayPrice,
  getProductVariants,
  getVariantSizeStock,
  getVariantSizeStocks,
  type ClothingSize,
  type Product,
  type ProductVariant,
} from "@/core/domain/models/product";

type CartContextValue = {
  items: CartItem[];
  totalItems: number;
  hasHydrated: boolean;
  isCartOpen: boolean;
  addItem: (
    product: Product,
    quantity?: number,
    variant?: ProductVariant,
    size?: ClothingSize,
  ) => void;
  removeItem: (lineId: string) => void;
  updateQuantity: (lineId: string, quantity: number) => void;
  clearCart: () => void;
  getItemQuantity: (
    slug: string,
    variantId?: string,
    size?: ClothingSize,
  ) => number;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
};

const CART_STORAGE_KEY = "tata-lulu-shop-cart";

const CartContext = createContext<CartContextValue | null>(null);
const emptySubscribe = () => () => undefined;

function clampQuantity(quantity: number, stock: number) {
  if (stock <= 0) {
    return 0;
  }

  return Math.max(1, Math.min(quantity, stock));
}

function toCartItem(
  product: Product,
  quantity: number,
  selectedVariant?: ProductVariant,
  selectedSize?: ClothingSize,
): CartItem {
  const variants = getProductVariants(product);
  const variant =
    selectedVariant ??
    variants.find((entry) => entry.stock > 0) ??
    variants[0];
  const sizeStock =
    (selectedSize ? getVariantSizeStock(variant, selectedSize) : undefined) ??
    getVariantSizeStocks(variant).find((entry) => entry.stock > 0) ??
    getVariantSizeStocks(variant)[0];
  const size = sizeStock?.size ?? DEFAULT_CLOTHING_SIZE;
  const stock = sizeStock?.stock ?? 0;
  const lineId = `${product.slug}::${variant.id}::${size}`;

  return {
    lineId,
    slug: product.slug,
    variantId: variant.id,
    colorName: variant.colorName,
    colorHex: variant.colorHex,
    size,
    category: product.category,
    name: product.name,
    shortDescription: product.shortDescription,
    image: variant.images[0] ?? product.image,
    priceLabel: getProductDisplayPrice(product),
    whatsappMessage: product.whatsappMessage,
    stock,
    quantity: clampQuantity(quantity, stock),
  };
}

function isCartItem(value: unknown): value is CartItem {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<CartItem>;

  return (
    typeof candidate.slug === "string" &&
    typeof candidate.category === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.shortDescription === "string" &&
    typeof candidate.image === "string" &&
    typeof candidate.priceLabel === "string" &&
    typeof candidate.whatsappMessage === "string" &&
    typeof candidate.stock === "number" &&
    typeof candidate.quantity === "number"
  );
}

function sanitizeStoredItems(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(isCartItem)
    .map((item) => {
      const variantId =
        typeof item.variantId === "string" && item.variantId
          ? item.variantId
          : "default";
      const size =
        typeof item.size === "string" && item.size
          ? item.size
          : DEFAULT_CLOTHING_SIZE;

      return {
        ...item,
        lineId: `${item.slug}::${variantId}::${size}`,
        variantId,
        size,
        colorName:
          typeof item.colorName === "string" && item.colorName
            ? item.colorName
            : "Couleur unique",
        colorHex:
          typeof item.colorHex === "string" && item.colorHex
            ? item.colorHex
            : "#D8C4A3",
        quantity: clampQuantity(item.quantity, item.stock),
      };
    })
    .filter((item) => item.quantity > 0);
}

function readStoredCartItems() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const storedValue = window.localStorage.getItem(CART_STORAGE_KEY);
    return storedValue ? sanitizeStoredItems(JSON.parse(storedValue)) : [];
  } catch {
    return [];
  }
}

export function CartProvider({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [hasHydrated, setHasHydrated] = useState(false);
  const isClient = useSyncExternalStore(emptySubscribe, () => true, () => false);

  useEffect(() => {
    if (!isClient || hasHydrated) {
      return undefined;
    }

    const restoreTimer = window.setTimeout(() => {
      setItems(readStoredCartItems());
      setHasHydrated(true);
    }, 0);

    return () => {
      window.clearTimeout(restoreTimer);
    };
  }, [hasHydrated, isClient]);

  useEffect(() => {
    if (!hasHydrated) {
      return;
    }

    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  }, [hasHydrated, items]);

  const openCart = useCallback(() => {
    setIsCartOpen(true);
  }, []);

  const closeCart = useCallback(() => {
    setIsCartOpen(false);
  }, []);

  const toggleCart = useCallback(() => {
    setIsCartOpen((current) => !current);
  }, []);

  const addItem = useCallback((
    product: Product,
    quantity = 1,
    variant?: ProductVariant,
    size?: ClothingSize,
  ) => {
    const nextItem = toCartItem(product, quantity, variant, size);

    if (nextItem.stock <= 0) {
      return;
    }

    setItems((currentItems) => {
      const existingItem = currentItems.find((item) => item.lineId === nextItem.lineId);

      if (!existingItem) {
        return [...currentItems, nextItem];
      }

      return currentItems.map((item) =>
          item.lineId === nextItem.lineId
            ? {
                ...nextItem,
                quantity: clampQuantity(item.quantity + quantity, nextItem.stock),
            }
          : item,
      );
    });
  }, []);

  const removeItem = useCallback((lineId: string) => {
    setItems((currentItems) => currentItems.filter((item) => item.lineId !== lineId));
  }, []);

  const updateQuantity = useCallback((lineId: string, quantity: number) => {
    setItems((currentItems) =>
      currentItems.flatMap((item) => {
        if (item.lineId !== lineId) {
          return [item];
        }

        const nextQuantity = clampQuantity(quantity, item.stock);
        return nextQuantity > 0 ? [{ ...item, quantity: nextQuantity }] : [];
      }),
    );
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const getItemQuantity = useCallback((
    slug: string,
    variantId?: string,
    size?: ClothingSize,
  ) => {
    return items
      .filter((item) => item.slug === slug)
      .filter((item) => (variantId ? item.variantId === variantId : true))
      .filter((item) => (size ? item.size === size : true))
      .reduce((total, item) => total + item.quantity, 0);
  }, [items]);

  const totalItems = useMemo(
    () => items.reduce((total, item) => total + item.quantity, 0),
    [items],
  );

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      totalItems,
      hasHydrated,
      isCartOpen,
      addItem,
      removeItem,
      updateQuantity,
      clearCart,
      getItemQuantity,
      openCart,
      closeCart,
      toggleCart,
    }),
    [
      addItem,
      clearCart,
      closeCart,
      getItemQuantity,
      hasHydrated,
      isCartOpen,
      items,
      openCart,
      removeItem,
      toggleCart,
      totalItems,
      updateQuantity,
    ],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const cartContext = useContext(CartContext);

  if (!cartContext) {
    throw new Error("useCart must be used inside CartProvider.");
  }

  return cartContext;
}
