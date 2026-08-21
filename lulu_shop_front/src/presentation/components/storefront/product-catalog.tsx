"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  PackageSearch,
  RotateCcw,
  Search,
  ShoppingBag,
  SlidersHorizontal,
} from "lucide-react";
import {
  CLOTHING_SIZES,
  CLOTHING_SIZE_LABELS,
  getPopularProducts,
  getProductSizes,
  getProductVariants,
  getVariantSizeStocks,
  type ClothingSize,
  type Product,
} from "@/core/domain/models/product";
import {
  formatProductCategory,
  getGroupedCategories,
  getProductGroup,
  matchesCategoryFilter,
  normalizeCategoryFilter,
} from "@/lib/product-category-groups";
import { matchesProductSearch } from "@/lib/product-search";
import { useCart } from "@/presentation/providers/cart-provider";
import { ProductPhotoBackdrop } from "./product-photo-backdrop";
import { ProductBadge } from "./product-badge";
import { ProductPrice } from "./product-price";

type ProductCatalogProps = {
  products: Product[];
  label: string;
  title: string;
  subtitle: string;
  sectionId?: string;
  mode?: "preview" | "catalog";
  previewCount?: number;
  ctaHref?: string;
  ctaLabel?: string;
  ctaNote?: string;
  showStock?: boolean;
};

const revealDelayClasses = [
  "reveal-delay-1",
  "reveal-delay-2",
  "reveal-delay-3",
  "reveal-delay-4",
  "reveal-delay-5",
];

const productGradientClasses = ["product-img-1", "product-img-2", "product-img-3", "product-img-4"];

/** Seuil au-delà duquel le stock n'est plus considéré comme tendu. */
const LOW_STOCK_THRESHOLD = 3;
const CATALOG_PAGE_SIZE = 9;

function getRevealDelayClass(index: number) {
  return revealDelayClasses[index % revealDelayClasses.length];
}

function getProductGradientClass(index: number) {
  return productGradientClasses[index % productGradientClasses.length];
}

type CatalogSortOption = "selection" | "featured" | "name-asc" | "stock-desc";

type FilterSectionKey = "search" | "groups" | "types" | "sizes" | "stock";

/**
 * Statut de stock affiché sur la carte.
 * L'urgence communiquée provient uniquement du stock réel saisi en back-office.
 * Aucun compte à rebours ni « plus que 2 personnes regardent » : une fausse
 * rareté est un mensonge, et elle se retourne contre la boutique.
 */
function getStockStatus(stock: number) {
  if (stock <= 0) {
    return { className: "empty", label: "Rupture de stock" };
  }

  if (stock <= LOW_STOCK_THRESHOLD) {
    return {
      className: "low",
      label: stock === 1 ? "Dernière pièce" : `Plus que ${stock} en stock`,
    };
  }

  return { className: "available", label: `${stock} en stock` };
}

export function ProductCatalog({
  products,
  label,
  title,
  subtitle,
  sectionId = "products",
  mode = "catalog",
  previewCount = 4,
  ctaHref,
  ctaLabel,
  ctaNote,
  showStock = mode === "catalog",
}: ProductCatalogProps) {
  const searchParams = useSearchParams();
  const { addItem, getItemQuantity, hasHydrated, openCart } = useCart();
  const initialCategory = normalizeCategoryFilter(searchParams.get("category"));
  const initialSearchTerm = searchParams.get("q") ?? "";
  const initialType = searchParams.get("type")?.trim() || "all";
  const requestedSize = searchParams.get("size");
  const initialSize = CLOTHING_SIZES.includes(requestedSize as ClothingSize)
    ? (requestedSize as ClothingSize)
    : "all";
  const initialOnlyAvailable = searchParams.get("stock") === "available";
  const initialSort = (searchParams.get("sort") as CatalogSortOption | null) ?? "selection";
  const [activeCategory, setActiveCategory] = useState(initialCategory);
  const [activeType, setActiveType] = useState(initialType);
  const [activeSize, setActiveSize] = useState<ClothingSize | "all">(
    initialSize,
  );
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm);
  const [onlyAvailable, setOnlyAvailable] = useState(initialOnlyAvailable);
  const [sortOption, setSortOption] = useState<CatalogSortOption>(initialSort);
  const [currentPage, setCurrentPage] = useState(1);
  const [openSections, setOpenSections] = useState<Record<FilterSectionKey, boolean>>({
    search: true,
    groups: true,
    types: true,
    sizes: true,
    stock: true,
  });

  const activeProducts = useMemo(
    () => products.filter((product) => product.isActive).sort((left, right) => left.order - right.order),
    [products],
  );

  const categories = useMemo(
    () => getGroupedCategories(activeProducts.map((product) => product.category)),
    [activeProducts],
  );

  const previewProducts = useMemo(() => {
    const popular = getPopularProducts(activeProducts);
    const popularSlugs = new Set(popular.map((product) => product.slug));
    const featured = activeProducts.filter(
      (product) => product.featured && !popularSlugs.has(product.slug),
    );
    const featuredSlugs = new Set(featured.map((product) => product.slug));
    const remaining = activeProducts.filter(
      (product) =>
        !popularSlugs.has(product.slug) &&
        !featuredSlugs.has(product.slug),
    );

    return [...popular, ...featured, ...remaining].slice(0, previewCount);
  }, [activeProducts, previewCount]);

  const availableTypes = useMemo(
    () =>
      Array.from(
        new Set(
          activeProducts
            .filter((product) => matchesCategoryFilter(product.category, activeCategory))
            .flatMap((product) => product.types)
            .map((type) => type.trim())
            .filter(Boolean),
        ),
      ).sort((left, right) => left.localeCompare(right, "fr")),
    [activeCategory, activeProducts],
  );

  const availableSizes = useMemo(
    () =>
      CLOTHING_SIZES.filter((size) =>
        activeProducts
          .filter((product) =>
            matchesCategoryFilter(product.category, activeCategory),
          )
          .some((product) => getProductSizes(product).includes(size)),
      ),
    [activeCategory, activeProducts],
  );

  const filteredProducts = useMemo(() => {
    return activeProducts.filter((product) => {
      const matchesCategory = matchesCategoryFilter(product.category, activeCategory);
      const matchesType =
        activeType === "all" ||
        product.types.some((type) => type.localeCompare(activeType, "fr", { sensitivity: "base" }) === 0);
      const sizeStocks = getProductVariants(product).flatMap((variant) =>
        getVariantSizeStocks(variant),
      );
      const matchesSize =
        activeSize === "all" ||
        sizeStocks.some((entry) => entry.size === activeSize);
      const matchesStock =
        !onlyAvailable ||
        (activeSize === "all"
          ? product.stock > 0
          : sizeStocks.some(
              (entry) => entry.size === activeSize && entry.stock > 0,
            ));
      const matchesSearch = matchesProductSearch(product, searchTerm);

      return matchesCategory && matchesType && matchesSize && matchesStock && matchesSearch;
    });
  }, [activeCategory, activeProducts, activeSize, activeType, onlyAvailable, searchTerm]);

  const sortedCatalogProducts = useMemo(() => {
    const nextProducts = [...filteredProducts];

    switch (sortOption) {
      case "featured":
        return nextProducts.sort(
          (left, right) =>
            Number(right.featured) - Number(left.featured) ||
            left.order - right.order ||
            left.name.localeCompare(right.name, "fr"),
        );
      case "name-asc":
        return nextProducts.sort((left, right) => left.name.localeCompare(right.name, "fr"));
      case "stock-desc":
        return nextProducts.sort(
          (left, right) =>
            right.stock - left.stock ||
            Number(right.featured) - Number(left.featured) ||
            left.order - right.order,
        );
      case "selection":
      default:
        return nextProducts.sort(
          (left, right) =>
            left.order - right.order ||
            Number(right.featured) - Number(left.featured) ||
            left.name.localeCompare(right.name, "fr"),
        );
    }
  }, [filteredProducts, sortOption]);

  const totalCatalogPages = Math.max(
    1,
    Math.ceil(sortedCatalogProducts.length / CATALOG_PAGE_SIZE),
  );
  const safeCurrentPage = Math.min(currentPage, totalCatalogPages);
  const paginatedCatalogProducts = useMemo(() => {
    const start = (safeCurrentPage - 1) * CATALOG_PAGE_SIZE;
    return sortedCatalogProducts.slice(start, start + CATALOG_PAGE_SIZE);
  }, [safeCurrentPage, sortedCatalogProducts]);
  const displayedProducts =
    mode === "preview" ? previewProducts : paginatedCatalogProducts;
  const canResetFilters =
    activeCategory !== "all" ||
    activeType !== "all" ||
    activeSize !== "all" ||
    searchTerm.trim().length > 0 ||
    onlyAvailable ||
    sortOption !== "selection";

  const groupCounts = useMemo(() => {
    const counts = new Map<string, number>();

    categories.forEach((category) => counts.set(category, 0));

    activeProducts.forEach((product) => {
      const matchesStock = !onlyAvailable || product.stock > 0;
      const matchesSearch = matchesProductSearch(product, searchTerm);

      if (!matchesStock || !matchesSearch) {
        return;
      }

      const group = getProductGroup(product.category);
      counts.set(group, (counts.get(group) ?? 0) + 1);
    });

    return counts;
  }, [activeProducts, categories, onlyAvailable, searchTerm]);

  const typeCounts = useMemo(() => {
    const counts = new Map<string, number>();

    availableTypes.forEach((type) => counts.set(type, 0));

    activeProducts
      .filter((product) => matchesCategoryFilter(product.category, activeCategory))
      .filter((product) => !onlyAvailable || product.stock > 0)
      .filter((product) => matchesProductSearch(product, searchTerm))
      .forEach((product) => {
        product.types.forEach((type) => {
          if (counts.has(type)) {
            counts.set(type, (counts.get(type) ?? 0) + 1);
          }
        });
      });

    return counts;
  }, [activeCategory, activeProducts, availableTypes, onlyAvailable, searchTerm]);

  const activeLabel =
    activeType !== "all"
      ? activeType
      : activeSize !== "all"
        ? CLOTHING_SIZE_LABELS[activeSize]
      : activeCategory === "all"
        ? "Tous"
        : activeCategory;

  function resetFilters() {
    setActiveCategory("all");
    setActiveType("all");
    setActiveSize("all");
    setSearchTerm("");
    setOnlyAvailable(false);
    setSortOption("selection");
    setCurrentPage(1);
  }

  function handleAddToCart(product: Product) {
    addItem(product, 1);
  }

  function toggleSection(section: FilterSectionKey) {
    setOpenSections((current) => ({
      ...current,
      [section]: !current[section],
    }));
  }

  return (
    <section
      className={`section ${mode === "preview" ? "product-preview-section" : "product-catalog-section"}`}
      id={sectionId}
    >
      <div className="container">
        <p className={`section-label ${mode === "preview" ? "reveal" : ""}`}>{label}</p>
        <h2 className={`section-title ${mode === "preview" ? "reveal reveal-delay-1" : ""}`}>{title}</h2>
        <p className={`section-subtitle ${mode === "preview" ? "reveal reveal-delay-2" : ""}`}>{subtitle}</p>

        {mode === "catalog" ? (
          <div className="catalog-layout">
            <aside className="catalog-sidebar" aria-label="Filtres du catalogue">
              <div className="catalog-sidebar-card">
                <div className="catalog-sidebar-head">
                  <p className="catalog-sidebar-title">Filtre</p>
                  <button
                    type="button"
                    className="catalog-reset compact"
                    onClick={resetFilters}
                    disabled={!canResetFilters}
                  >
                    <RotateCcw size={15} strokeWidth={1.9} aria-hidden="true" />
                    Réinitialiser
                  </button>
                </div>

                <div className="catalog-filter-section">
                  <button
                    type="button"
                    className="catalog-filter-toggle"
                    aria-expanded={openSections.search}
                    onClick={() => toggleSection("search")}
                  >
                    <span>Recherche</span>
                    <ChevronDown
                      size={18}
                      strokeWidth={2}
                      aria-hidden="true"
                      className={openSections.search ? "open" : ""}
                    />
                  </button>

                  {openSections.search ? (
                    <div className="catalog-filter-panel">
                      <label className="catalog-search-shell sidebar">
                        <span className="sr-only">Rechercher un produit</span>
                        <Search
                          size={18}
                          strokeWidth={1.75}
                          className="catalog-search-icon"
                          aria-hidden="true"
                        />
                        <input
                          type="search"
                          value={searchTerm}
                          onChange={(event) => {
                            setSearchTerm(event.target.value);
                            setCurrentPage(1);
                          }}
                          placeholder="Nom, couleur, référence..."
                          className="catalog-search-input"
                        />
                      </label>
                      <p className="catalog-search-hint">
                        Nom, catégorie, type, couleur ou référence.
                      </p>
                    </div>
                  ) : null}
                </div>

                <div className="catalog-filter-section">
                  <button
                    type="button"
                    className="catalog-filter-toggle"
                    aria-expanded={openSections.groups}
                    onClick={() => toggleSection("groups")}
                  >
                    <span>Grande catégorie</span>
                    <ChevronDown
                      size={18}
                      strokeWidth={2}
                      aria-hidden="true"
                      className={openSections.groups ? "open" : ""}
                    />
                  </button>

                  {openSections.groups ? (
                    <div className="catalog-filter-panel" role="radiogroup" aria-label="Grandes catégories">
                      <label className={`catalog-filter-option ${activeCategory === "all" ? "active" : ""}`}>
                        <input
                          type="radio"
                          name="catalog-group"
                          checked={activeCategory === "all"}
                          onChange={() => {
                            setActiveCategory("all");
                            setActiveType("all");
                            setCurrentPage(1);
                          }}
                        />
                        <span className="catalog-filter-box" aria-hidden="true" />
                        <span className="catalog-filter-name">Tous</span>
                        <span className="catalog-filter-count">({activeProducts.length})</span>
                      </label>

                      {categories.map((category) => (
                        <label
                          className={`catalog-filter-option ${activeCategory === category ? "active" : ""}`}
                          key={category}
                        >
                          <input
                            type="radio"
                            name="catalog-group"
                            checked={activeCategory === category}
                            onChange={() => {
                              setActiveCategory(category);
                              setActiveType("all");
                              setCurrentPage(1);
                            }}
                          />
                          <span className="catalog-filter-box" aria-hidden="true" />
                          <span className="catalog-filter-name">{category}</span>
                          <span className="catalog-filter-count">({groupCounts.get(category) ?? 0})</span>
                        </label>
                      ))}
                    </div>
                  ) : null}
                </div>

                {availableTypes.length > 0 ? (
                  <div className="catalog-filter-section">
                    <button
                      type="button"
                      className="catalog-filter-toggle"
                      aria-expanded={openSections.types}
                      onClick={() => toggleSection("types")}
                    >
                      <span>Type</span>
                      <ChevronDown
                        size={18}
                        strokeWidth={2}
                        aria-hidden="true"
                        className={openSections.types ? "open" : ""}
                      />
                    </button>

                    {openSections.types ? (
                      <div className="catalog-filter-panel" role="radiogroup" aria-label="Types de produit">
                        <label className={`catalog-filter-option ${activeType === "all" ? "active" : ""}`}>
                          <input
                            type="radio"
                            name="catalog-type"
                            checked={activeType === "all"}
                            onChange={() => {
                              setActiveType("all");
                              setCurrentPage(1);
                            }}
                          />
                          <span className="catalog-filter-box" aria-hidden="true" />
                          <span className="catalog-filter-name">Tous les types</span>
                        </label>

                        {availableTypes.map((type) => (
                          <label
                            className={`catalog-filter-option ${activeType === type ? "active" : ""}`}
                            key={type}
                          >
                            <input
                              type="radio"
                              name="catalog-type"
                              checked={activeType === type}
                              onChange={() => {
                                setActiveType(type);
                                setCurrentPage(1);
                              }}
                            />
                            <span className="catalog-filter-box" aria-hidden="true" />
                            <span className="catalog-filter-name">{type}</span>
                            <span className="catalog-filter-count">({typeCounts.get(type) ?? 0})</span>
                          </label>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {availableSizes.length > 0 ? (
                  <div className="catalog-filter-section">
                    <button
                      type="button"
                      className="catalog-filter-toggle"
                      aria-expanded={openSections.sizes}
                      onClick={() => toggleSection("sizes")}
                    >
                      <span>Taille</span>
                      <ChevronDown
                        size={18}
                        strokeWidth={2}
                        aria-hidden="true"
                        className={openSections.sizes ? "open" : ""}
                      />
                    </button>

                    {openSections.sizes ? (
                      <div
                        className="catalog-filter-panel catalog-size-filter"
                        role="radiogroup"
                        aria-label="Tailles"
                      >
                        <label
                          className={`catalog-filter-option ${activeSize === "all" ? "active" : ""}`}
                        >
                          <input
                            type="radio"
                            name="catalog-size"
                            checked={activeSize === "all"}
                            onChange={() => {
                              setActiveSize("all");
                              setCurrentPage(1);
                            }}
                          />
                          <span className="catalog-filter-box" aria-hidden="true" />
                          <span className="catalog-filter-name">Toutes les tailles</span>
                        </label>

                        {availableSizes.map((size) => (
                          <label
                            className={`catalog-filter-option ${activeSize === size ? "active" : ""}`}
                            key={size}
                          >
                            <input
                              type="radio"
                              name="catalog-size"
                              checked={activeSize === size}
                              onChange={() => {
                                setActiveSize(size);
                                setCurrentPage(1);
                              }}
                            />
                            <span className="catalog-filter-box" aria-hidden="true" />
                            <span className="catalog-filter-name">
                              {CLOTHING_SIZE_LABELS[size]}
                            </span>
                          </label>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <div className="catalog-filter-section">
                  <button
                    type="button"
                    className="catalog-filter-toggle"
                    aria-expanded={openSections.stock}
                    onClick={() => toggleSection("stock")}
                  >
                    <span>Disponibilité</span>
                    <ChevronDown
                      size={18}
                      strokeWidth={2}
                      aria-hidden="true"
                      className={openSections.stock ? "open" : ""}
                    />
                  </button>

                  {openSections.stock ? (
                    <div className="catalog-filter-panel" role="group" aria-label="Disponibilité">
                      <label className={`catalog-filter-option ${onlyAvailable ? "active" : ""}`}>
                        <input
                          type="checkbox"
                          checked={onlyAvailable}
                          onChange={() => {
                            setOnlyAvailable((current) => !current);
                            setCurrentPage(1);
                          }}
                        />
                        <span className="catalog-filter-box" aria-hidden="true" />
                        <span className="catalog-filter-name">En stock seulement</span>
                      </label>
                    </div>
                  ) : null}
                </div>
              </div>
            </aside>

            <div className="catalog-main">
              <div className="catalog-results-bar">
                <div className="catalog-results-card">
                  {/* `aria-live` annonce le nouveau nombre de résultats après un
                      filtrage : sans cela, un utilisateur de lecteur d'écran ne
                      perçoit aucun retour à l'activation d'un filtre. */}
                  <strong role="status" aria-live="polite">
                    {activeLabel} <span>({filteredProducts.length})</span>
                  </strong>
                </div>
              </div>

              {displayedProducts.length > 0 ? (
                <>
                  <div className="products-grid products-grid-catalog">
                    {displayedProducts.map((product, index) => {
                    const stockStatus = getStockStatus(product.stock);
                    const isOutOfStock = product.stock <= 0;
                    const requiresVariantSelection = getProductVariants(product).length > 1;

                    return (
                      <article className="product-card product-card-catalog" key={product.slug}>
                        <Link
                          href={`/produits/${product.slug}`}
                          className={`product-img ${getProductGradientClass(index)}`}
                          aria-label={`Voir la fiche de ${product.name}`}
                        >
                          <ProductPhotoBackdrop src={product.image} />
                          <Image
                            src={product.image}
                            alt={product.name}
                            width={640}
                            height={800}
                            sizes="(max-width: 600px) 100vw, (max-width: 1024px) 50vw, 25vw"
                            quality={72}
                            preload={index === 0 && safeCurrentPage === 1}
                            loading={index === 0 && safeCurrentPage === 1 ? undefined : "lazy"}
                          />
                          <ProductBadge product={product} />
                        </Link>

                        <div className="product-info product-info-catalog">
                          <p className="product-category">{formatProductCategory(product.category)}</p>
                          <div className="product-title-row-catalog">
                            <h3 className="product-name">
                              <Link href={`/produits/${product.slug}`} aria-label={`Voir la fiche de ${product.name}`}>
                                {product.name}
                              </Link>
                            </h3>
                            {showStock ? (
                              <p className={`product-stock product-stock-catalog ${stockStatus.className}`}>
                                {stockStatus.label}
                              </p>
                            ) : null}
                          </div>

                          <ProductPrice
                            product={product}
                            className="product-price-catalog"
                          />

                          <div className="product-card-actions product-card-actions-catalog">
                            {requiresVariantSelection && !isOutOfStock ? (
                              <Link
                                href={`/produits/${product.slug}`}
                                className="product-btn product-btn-catalog"
                              >
                                <ShoppingBag size={15} strokeWidth={1.75} aria-hidden="true" />
                                Choisir une couleur
                                <span className="sr-only"> — {product.name}</span>
                              </Link>
                            ) : (
                              <button
                                type="button"
                                className="product-btn product-btn-catalog"
                                onClick={() => handleAddToCart(product)}
                                disabled={isOutOfStock || !hasHydrated}
                              >
                                <ShoppingBag size={15} strokeWidth={1.75} aria-hidden="true" />
                                {isOutOfStock
                                  ? "Indisponible"
                                  : hasHydrated
                                    ? "Ajouter au panier"
                                    : "Chargement..."}
                                <span className="sr-only"> — {product.name}</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </article>
                    );
                    })}
                  </div>

                  {totalCatalogPages > 1 ? (
                    <nav className="catalog-pagination" aria-label="Pagination du catalogue">
                      <button
                        type="button"
                        className="catalog-pagination-button"
                        onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                        disabled={safeCurrentPage === 1}
                      >
                        <ChevronLeft size={17} strokeWidth={2} aria-hidden="true" />
                        Précédente
                      </button>
                      <p className="catalog-pagination-status" aria-live="polite">
                        Page <strong>{safeCurrentPage}</strong> sur {totalCatalogPages}
                      </p>
                      <button
                        type="button"
                        className="catalog-pagination-button"
                        onClick={() =>
                          setCurrentPage((page) => Math.min(totalCatalogPages, page + 1))
                        }
                        disabled={safeCurrentPage === totalCatalogPages}
                      >
                        Suivante
                        <ChevronRight size={17} strokeWidth={2} aria-hidden="true" />
                      </button>
                    </nav>
                  ) : null}
                </>
              ) : (
                <div className="catalog-empty">
                  <PackageSearch
                    size={44}
                    strokeWidth={1.25}
                    aria-hidden="true"
                    style={{ margin: "0 auto var(--space-4)", color: "var(--color-text-tertiary)" }}
                  />
                  <h3>Aucun produit ne correspond à ce filtre</h3>
                  <p>Essaie une autre catégorie, enlève la restriction de stock ou change ton mot-clé.</p>
                  <button type="button" className="btn btn-outline" onClick={resetFilters}>
                    Tout réafficher
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : displayedProducts.length > 0 ? (
          <div
            className={`products-grid products-grid-preview products-grid-preview-${Math.min(displayedProducts.length, 4)}`}
          >
            {displayedProducts.map((product, index) => {
              const stockStatus = getStockStatus(product.stock);
              const quantityInCart = getItemQuantity(product.slug);
              const isOutOfStock = product.stock <= 0;
              const requiresVariantSelection = getProductVariants(product).length > 1;

                return (
                  <article
                    className={`product-card ${mode === "preview" ? `reveal ${getRevealDelayClass(index)}` : ""}`}
                    key={product.slug}
                  >
                    <Link
                      href={`/produits/${product.slug}`}
                      className={`product-img ${getProductGradientClass(index)}`}
                      aria-label={`Voir la fiche de ${product.name}`}
                    >
                      <ProductPhotoBackdrop src={product.image} />
                      <Image
                        src={product.image}
                        alt={product.name}
                        width={640}
                        height={800}
                        sizes="(max-width: 600px) 100vw, (max-width: 1024px) 50vw, 25vw"
                        quality={72}
                        loading="lazy"
                      />
                      <ProductBadge product={product} />
                    </Link>

                    <div className="product-info">
                      <p className="product-category">{formatProductCategory(product.category)}</p>
                      <h3 className="product-name">
                        <Link href={`/produits/${product.slug}`} aria-label={`Voir la fiche de ${product.name}`}>
                          {product.name}
                        </Link>
                      </h3>

                    {showStock ? (
                      <p className={`product-stock ${stockStatus.className}`}>{stockStatus.label}</p>
                    ) : null}

                    <ProductPrice
                      product={product}
                      className="product-price-preview"
                    />

                    {quantityInCart > 0 ? (
                      <p className="product-cart-note">
                        <ShoppingBag size={14} strokeWidth={2} aria-hidden="true" />
                        {quantityInCart} dans le panier
                      </p>
                    ) : null}

                      <div className="product-card-actions">
                        {requiresVariantSelection && !isOutOfStock ? (
                          <Link href={`/produits/${product.slug}`} className="product-btn">
                            <ShoppingBag size={15} strokeWidth={1.75} aria-hidden="true" />
                            Choisir une couleur
                            <span className="sr-only"> — {product.name}</span>
                          </Link>
                        ) : (
                          <button
                            type="button"
                            className="product-btn"
                            onClick={() => handleAddToCart(product)}
                            disabled={isOutOfStock || !hasHydrated}
                          >
                            <ShoppingBag size={15} strokeWidth={1.75} aria-hidden="true" />
                            {isOutOfStock
                              ? "Indisponible"
                              : hasHydrated
                                ? "Ajouter au panier"
                                : "Chargement..."}
                            {/* Précise de quel produit il s'agit : hors contexte
                                visuel, « Ajouter au panier » seul est ambigu. */}
                            <span className="sr-only"> — {product.name}</span>
                          </button>
                        )}
                    </div>

                    {quantityInCart > 0 ? (
                      <button type="button" className="product-card-cart-link" onClick={openCart}>
                        Voir le panier
                        <ArrowRight size={14} strokeWidth={2} aria-hidden="true" />
                      </button>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="catalog-empty">
            <PackageSearch
              size={44}
              strokeWidth={1.25}
              aria-hidden="true"
              style={{ margin: "0 auto var(--space-4)", color: "var(--color-text-tertiary)" }}
            />
            <h3>Aucun produit ne correspond à ce filtre</h3>
            <p>Essaie une autre catégorie, enlève la restriction de stock ou change ton mot-clé.</p>
            <button type="button" className="btn btn-outline" onClick={resetFilters}>
              Tout réafficher
            </button>
          </div>
        )}

        {mode === "preview" && ctaHref && ctaLabel ? (
          <div className="catalog-preview-cta reveal reveal-delay-4">
            <Link href={ctaHref} className="btn btn-outline btn-lg">
              <SlidersHorizontal size={17} strokeWidth={1.75} aria-hidden="true" />
              {ctaLabel}
            </Link>
            {ctaNote ? <p>{ctaNote}</p> : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
