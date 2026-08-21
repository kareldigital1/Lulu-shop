"use client";

import { PackagePlus, Plus, X } from "lucide-react";
import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";
import type { ProductRestockInput } from "@/core/domain/models/admin";
import {
  CLOTHING_SIZE_LABELS,
  getProductVariants,
  getVariantSizeStocks,
  type Product,
} from "@/core/domain/models/product";

type AdminRestockDialogProps = {
  product: Product | null;
  isLoading: boolean;
  onCancel: () => void;
  onSubmit: (input: ProductRestockInput) => void;
};

export function AdminRestockDialog({
  product,
  isLoading,
  onCancel,
  onSubmit,
}: AdminRestockDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);
  const variants = product ? getProductVariants(product) : [];
  const restockEntries = variants.flatMap((variant) =>
    getVariantSizeStocks(variant).map((entry) => ({
      key: `${variant.id}::${entry.size}`,
      variant,
      sizeStock: entry,
    })),
  );
  const [quantities, setQuantities] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      restockEntries.map((entry) => [entry.key, ""]),
    ),
  );
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!product) {
      return;
    }

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.setTimeout(() => firstInputRef.current?.focus(), 0);

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isLoading) {
        onCancel();
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) {
        return;
      }

      const focusableElements = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      const firstElement = focusableElements[0];
      const lastElement = focusableElements.at(-1);

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement?.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement?.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [isLoading, onCancel, product]);

  if (!product) {
    return null;
  }

  const items = restockEntries.flatMap(({ key, variant, sizeStock }) => {
    const quantity = Number(quantities[key]);

    return Number.isInteger(quantity) && quantity > 0
      ? [{ variantId: variant.id, size: sizeStock.size, quantity }]
      : [];
  });
  const totalAdded = items.reduce(
    (total, item) => total + item.quantity,
    0,
  );

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (items.length === 0) {
      setError("Saisis au moins une quantité supérieure à zéro.");
      return;
    }

    setError("");
    onSubmit({ items, note: note.trim() || undefined });
  }

  return (
    <div
      className="admin-restock-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isLoading) {
          onCancel();
        }
      }}
    >
      <div
        ref={dialogRef}
        className="admin-restock-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      >
        <header className="admin-restock-head">
          <span className="admin-restock-icon" aria-hidden="true">
            <PackagePlus size={20} strokeWidth={1.9} />
          </span>
          <div>
            <span>Gestion du stock</span>
            <h2 id={titleId}>Réapprovisionner</h2>
          </div>
          <button
            type="button"
            aria-label="Fermer"
            disabled={isLoading}
            onClick={onCancel}
          >
            <X size={17} strokeWidth={2} aria-hidden="true" />
          </button>
        </header>

        <div className="admin-restock-product">
          {product.image ? (
            <Image
              src={product.image}
              alt=""
              width={45}
              height={45}
            />
          ) : null}
          <div>
            <strong>{product.name}</strong>
            <span>
              {product.stock} unité{product.stock > 1 ? "s" : ""} actuellement
            </span>
          </div>
        </div>

        <p id={descriptionId} className="admin-restock-description">
          Indique uniquement les nouvelles unités reçues. Le stock existant
          sera conservé.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="admin-restock-variants">
            {restockEntries.map(({ key, variant, sizeStock }, index) => (
              <label key={key}>
                <span
                  className="admin-restock-swatch"
                  style={{ backgroundColor: variant.colorHex }}
                  aria-hidden="true"
                />
                <span className="admin-restock-variant-copy">
                  <strong>{variant.colorName}</strong>
                  <small>
                    Taille {CLOTHING_SIZE_LABELS[sizeStock.size]} · stock actuel : {sizeStock.stock}
                  </small>
                </span>
                <span className="admin-restock-quantity">
                  <Plus size={13} strokeWidth={2.2} aria-hidden="true" />
                  <input
                    ref={index === 0 ? firstInputRef : undefined}
                    type="number"
                    min="0"
                    max="100000"
                    step="1"
                    inputMode="numeric"
                    placeholder="0"
                    aria-label={`Quantité à ajouter pour ${variant.colorName}, taille ${CLOTHING_SIZE_LABELS[sizeStock.size]}`}
                    value={quantities[key] ?? ""}
                    onChange={(event) => {
                      setQuantities((current) => ({
                        ...current,
                        [key]: event.target.value,
                      }));
                      setError("");
                    }}
                  />
                </span>
              </label>
            ))}
          </div>

          <label className="admin-restock-note">
            <span>Note facultative</span>
            <textarea
              rows={2}
              maxLength={240}
              placeholder="Ex. Arrivage du fournisseur..."
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </label>

          {error ? <p className="admin-restock-error">{error}</p> : null}

          <footer className="admin-restock-actions">
            <button
              type="button"
              className="admin-restock-cancel"
              disabled={isLoading}
              onClick={onCancel}
            >
              Annuler
            </button>
            <button
              type="submit"
              className="admin-restock-submit"
              disabled={isLoading}
              aria-busy={isLoading || undefined}
            >
              {isLoading
                ? "Enregistrement..."
                : totalAdded > 0
                  ? `Ajouter ${totalAdded} unité${totalAdded > 1 ? "s" : ""}`
                  : "Ajouter au stock"}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
