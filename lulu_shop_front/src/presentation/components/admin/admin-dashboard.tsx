"use client";

import {
  ArrowRightLeft,
  BadgePercent,
  Bell,
  CalendarClock,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ClipboardList,
  DatabaseBackup,
  Eye,
  EyeOff,
  FileText,
  History,
  ImagePlus,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  PackagePlus,
  Palette,
  PencilLine,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Store,
  Trash2,
  Users,
  X,
} from "lucide-react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import type {
  AdminLoginInput,
  ProductMutationInput,
  ProductRestockInput,
} from "@/core/domain/models/admin";
import type { AdminDashboardStats } from "@/core/domain/models/dashboard";
import type { ProductCategory } from "@/core/domain/models/category";
import {
  EMPTY_ADMIN_NOTIFICATION_CENTER,
  type AdminNotification,
  type AdminNotificationCenter,
} from "@/core/domain/models/admin-notification";
import {
  CLOTHING_SIZES,
  CLOTHING_SIZE_LABELS,
  DEFAULT_CLOTHING_SIZE,
  getAvailabilityFromStock,
  formatProductPrice,
  getPrimaryProductImage,
  getProductSizes,
  getProductVariants,
  getStockFromProductVariants,
  getVariantSizeStocks,
  isProductAvailable,
  isProductPublished,
  isReservedAutomaticProductBadge,
  PRODUCT_STATUSES,
  PRODUCT_STATUS_LABELS,
  type ClothingSize,
  type Product,
  type ProductStatus,
  type ProductVariant,
} from "@/core/domain/models/product";
import { formatProductCategory, getProductGroup } from "@/lib/product-category-groups";
import {
  findProductColorPreset,
  PRODUCT_COLOR_PALETTE,
  type ProductColorPreset,
} from "@/lib/product-color-palette";
import { matchesProductSearch } from "@/lib/product-search";
import { normalizeProductSlug } from "@/lib/product-slug";
import { getApiErrorMessage } from "@/core/infrastructure/http/request-manager";
import { fetchAdminDashboard } from "@/services/dashboard.service";
import { fetchAdminNotifications } from "@/services/admin-notification.service";
import { fetchAdminCategories } from "@/services/category.service";
import {
  createAdminProduct,
  deleteAdminProduct,
  fetchAdminProducts,
  loginAdmin,
  logoutAdmin,
  makeEmptyProductTemplate,
  restockAdminProduct,
  updateAdminProduct,
  uploadAdminProductImage,
} from "@/services/admin.service";
import { Button } from "../ui/button";
import { ConfirmationDialog } from "../ui/confirmation-dialog";

function AdminPanelLoading() {
  return (
    <div className="admin-ui-card admin-analytics-loading" aria-busy="true">
      <span className="admin-ui-session-loader" aria-hidden="true" />
      <p>Chargement du module...</p>
    </div>
  );
}

const AdminAuditPanel = dynamic(
  () => import("./admin-audit-panel").then((module) => module.AdminAuditPanel),
  { loading: AdminPanelLoading },
);
const AdminBackupPanel = dynamic(
  () => import("./admin-backup-panel").then((module) => module.AdminBackupPanel),
  { loading: AdminPanelLoading },
);
const AdminDocumentsPanel = dynamic(
  () =>
    import("./admin-documents-panel").then(
      (module) => module.AdminDocumentsPanel,
    ),
  { loading: AdminPanelLoading },
);
const AdminDashboardAnalytics = dynamic(
  () =>
    import("./admin-dashboard-analytics").then(
      (module) => module.AdminDashboardAnalytics,
    ),
  { loading: AdminPanelLoading },
);
const AdminCustomersPanel = dynamic(
  () =>
    import("./admin-customers-panel").then(
      (module) => module.AdminCustomersPanel,
    ),
  { loading: AdminPanelLoading },
);
const AdminOrdersPanel = dynamic(
  () => import("./admin-orders-panel").then((module) => module.AdminOrdersPanel),
  { loading: AdminPanelLoading },
);
const AdminNotificationsPanel = dynamic(
  () =>
    import("./admin-notifications-panel").then(
      (module) => module.AdminNotificationsPanel,
    ),
  { loading: AdminPanelLoading },
);
const AdminSystemPanel = dynamic(
  () =>
    import("./admin-system-panel").then(
      (module) => module.AdminSystemPanel,
    ),
  { loading: AdminPanelLoading },
);
const AdminStoreSettingsPanel = dynamic(
  () =>
    import("./admin-store-settings-panel").then(
      (module) => module.AdminStoreSettingsPanel,
    ),
  { loading: AdminPanelLoading },
);
const AdminRestockDialog = dynamic(
  () =>
    import("./admin-restock-dialog").then(
      (module) => module.AdminRestockDialog,
    ),
  { loading: AdminPanelLoading },
);
const AdminStockMovementsPanel = dynamic(
  () =>
    import("./admin-stock-movements-panel").then(
      (module) => module.AdminStockMovementsPanel,
    ),
  { loading: AdminPanelLoading },
);

const TOKEN_KEY = "lulu-admin-token";
const SIDEBAR_COLLAPSED_KEY = "lulu-admin-sidebar-collapsed";
const ADMIN_PRODUCT_PAGE_SIZE = 10;
type AdminView =
  | "dashboard"
  | "orders"
  | "customers"
  | "catalogue"
  | "editor"
  | "notifications"
  | "stock-history"
  | "documents"
  | "store"
  | "audit"
  | "backups"
  | "system";
type AdminLifecycleFilter = "all" | ProductStatus;
type AdminStockFilter = "all" | "available" | "low" | "unavailable";
type AdminSizeFilter = "all" | ClothingSize;
type AdminSortOption = "featured" | "catalogue" | "name" | "stock-desc" | "stock-asc";

function getStockTone(product: Pick<Product, "stock" | "availability">) {
  if (!isProductAvailable(product)) {
    return { tone: "danger", label: "Indisponible" };
  }

  if (product.stock <= 3) {
    return {
      tone: "warning",
      label: product.stock === 1 ? "1 pièce" : `${product.stock} pièces`,
    };
  }

  return { tone: "success", label: `${product.stock} en stock` };
}

function createVariantId() {
  return `color-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function isLocalPreviewImage(source: string) {
  return source.startsWith("blob:") || source.startsWith("data:");
}

function toDateTimeLocalValue(value: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000)
    .toISOString()
    .slice(0, 16);
}

function fromDateTimeLocalValue(value: string) {
  return value ? new Date(value).toISOString() : null;
}

function formatAdminDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date(value));
}

function getNewBadgeAdminMessage(
  product: Product | null,
  durationDays: number,
) {
  if (durationDays === 0) {
    return "Le badge automatique est désactivé dans les réglages de la boutique.";
  }

  if (product?.isNew && product.newBadgeExpiresAt) {
    return `Il expirera le ${formatAdminDate(product.newBadgeExpiresAt)}.`;
  }

  if (product?.publishedAt) {
    return `La période automatique de ${durationDays} jours est terminée.`;
  }

  return `Il sera activé pendant ${durationDays} jours lors de la première publication.`;
}

export function AdminDashboard({
  initialView = "dashboard",
}: {
  initialView?: AdminView;
}) {
  const [credentials, setCredentials] = useState<AdminLoginInput>({
    email: "",
    password: "",
  });
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [token, setToken] = useState("");
  const [isSessionReady, setIsSessionReady] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [ordersRefreshKey, setOrdersRefreshKey] = useState(0);
  const [orderFocusReference, setOrderFocusReference] = useState("");
  const [customerFocusCode, setCustomerFocusCode] = useState("");
  const [dashboardStats, setDashboardStats] =
    useState<AdminDashboardStats | null>(null);
  const [notificationCenter, setNotificationCenter] =
    useState<AdminNotificationCenter>(EMPTY_ADMIN_NOTIFICATION_CENTER);
  const [form, setForm] = useState<ProductMutationInput>(makeEmptyProductTemplate());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [typesInput, setTypesInput] = useState("");
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(false);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [productPendingDeletion, setProductPendingDeletion] =
    useState<Product | null>(null);
  const [productPendingRestock, setProductPendingRestock] =
    useState<Product | null>(null);
  const [isRestocking, setIsRestocking] = useState(false);
  const [activeView, setActiveView] = useState<AdminView>(initialView);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isCatalogFilterOpen, setIsCatalogFilterOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [lifecycleFilter, setLifecycleFilter] =
    useState<AdminLifecycleFilter>("all");
  const [stockFilter, setStockFilter] = useState<AdminStockFilter>("all");
  const [sizeFilter, setSizeFilter] = useState<AdminSizeFilter>("all");
  const [sortOption, setSortOption] = useState<AdminSortOption>("featured");
  const [catalogPage, setCatalogPage] = useState(1);

  useEffect(() => {
    const storedToken =
      window.sessionStorage.getItem(TOKEN_KEY) ??
      window.localStorage.getItem(TOKEN_KEY);
    const storedSidebarCollapsed =
      window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true";

    if (storedToken) {
      window.sessionStorage.setItem(TOKEN_KEY, storedToken);
    }

    window.localStorage.removeItem(TOKEN_KEY);

    const restoreSessionTimer = window.setTimeout(() => {
      setIsSidebarCollapsed(storedSidebarCollapsed);

      if (storedToken) {
        setToken(storedToken);
      }

      setIsSessionReady(true);
    }, 0);

    return () => window.clearTimeout(restoreSessionTimer);
  }, []);

  useEffect(() => {
    if (!token) {
      return;
    }

    void Promise.all([
      loadDashboard(token),
      loadNotifications(token),
      loadCategories(token),
    ]);
  }, [token]);

  const isEditing = useMemo(() => editingId !== null, [editingId]);
  const editingProduct = useMemo(
    () => products.find((product) => product._id === editingId) ?? null,
    [editingId, products],
  );
  const automaticNewBadgeDurationDays =
    products[0]?.newBadgeDurationDays ?? 30;
  const adminName = "Tata Lulu Shop";

  const filteredProducts = useMemo(() => {
    let nextProducts = products.filter((product) =>
      matchesProductSearch(product, searchTerm),
    );

    if (categoryFilter !== "all") {
      nextProducts = nextProducts.filter(
        (product) => getProductGroup(product.category) === categoryFilter,
      );
    }

    if (lifecycleFilter !== "all") {
      nextProducts = nextProducts.filter((product) =>
        product.status === lifecycleFilter,
      );
    }

    if (stockFilter !== "all") {
      nextProducts = nextProducts.filter((product) => {
        if (stockFilter === "available") {
          return isProductAvailable(product);
        }

        if (stockFilter === "low") {
          return isProductAvailable(product) && product.stock <= 3;
        }

        return !isProductAvailable(product);
      });
    }

    if (sizeFilter !== "all") {
      nextProducts = nextProducts.filter((product) =>
        getProductSizes(product).includes(sizeFilter),
      );
    }

    return [...nextProducts].sort((left, right) => {
      if (sortOption === "featured") {
        return (
          Number(right.featured) - Number(left.featured) ||
          left.order - right.order ||
          left.name.localeCompare(right.name, "fr")
        );
      }

      if (sortOption === "name") {
        return left.name.localeCompare(right.name, "fr");
      }

      if (sortOption === "stock-desc") {
        return right.stock - left.stock || left.name.localeCompare(right.name, "fr");
      }

      if (sortOption === "stock-asc") {
        return left.stock - right.stock || left.name.localeCompare(right.name, "fr");
      }

      return left.order - right.order || left.name.localeCompare(right.name, "fr");
    });
  }, [
    products,
    searchTerm,
    categoryFilter,
    lifecycleFilter,
    sizeFilter,
    stockFilter,
    sortOption,
  ]);

  const activeCatalogFilterCount =
    Number(categoryFilter !== "all") +
    Number(lifecycleFilter !== "all") +
    Number(sizeFilter !== "all") +
    Number(stockFilter !== "all");
  const catalogTotalPages = Math.max(
    1,
    Math.ceil(filteredProducts.length / ADMIN_PRODUCT_PAGE_SIZE),
  );
  const effectiveCatalogPage = Math.min(catalogPage, catalogTotalPages);
  const paginatedProducts = filteredProducts.slice(
    (effectiveCatalogPage - 1) * ADMIN_PRODUCT_PAGE_SIZE,
    effectiveCatalogPage * ADMIN_PRODUCT_PAGE_SIZE,
  );

  function resetCatalogFilters() {
    setCategoryFilter("all");
    setLifecycleFilter("all");
    setSizeFilter("all");
    setStockFilter("all");
    setCatalogPage(1);
  }

  const totalProducts = dashboardStats?.catalog.totalProducts ?? products.length;
  const pendingOrderCount = dashboardStats?.ordersByStatus.pending ?? 0;

  async function loadProducts(activeToken: string) {
    setIsLoadingProducts(true);
    setError("");

    try {
      const productList = await fetchAdminProducts(activeToken);
      setProducts(productList);
    } catch (requestError) {
      setError(
        getApiErrorMessage(
          requestError,
          "Impossible de charger les produits du backoffice.",
        ),
      );
    } finally {
      setIsLoadingProducts(false);
    }
  }

  async function loadDashboard(activeToken: string) {
    setIsLoadingDashboard(true);

    try {
      setDashboardStats(await fetchAdminDashboard(activeToken));
    } catch (requestError) {
      setError(
        getApiErrorMessage(
          requestError,
          "Impossible de charger les statistiques du backoffice.",
        ),
      );
    } finally {
      setIsLoadingDashboard(false);
    }
  }

  async function loadNotifications(activeToken: string) {
    setIsLoadingNotifications(true);

    try {
      setNotificationCenter(await fetchAdminNotifications(activeToken));
    } catch (requestError) {
      setError(
        getApiErrorMessage(
          requestError,
          "Impossible de charger les notifications du backoffice.",
        ),
      );
    } finally {
      setIsLoadingNotifications(false);
    }
  }

  async function loadCategories(activeToken: string) {
    try {
      setCategories(await fetchAdminCategories(activeToken));
    } catch (requestError) {
      setError(
        getApiErrorMessage(
          requestError,
          "Impossible de charger les catégories de produits.",
        ),
      );
    }
  }

  async function loadAdminData(activeToken: string) {
    setError("");
    const requests: Array<Promise<void>> = [
      loadDashboard(activeToken),
      loadNotifications(activeToken),
      loadCategories(activeToken),
    ];

    if (
      products.length > 0 ||
      activeView === "catalogue" ||
      activeView === "editor" ||
      activeView === "orders"
    ) {
      requests.push(loadProducts(activeToken));
    }

    if (activeView === "orders") {
      setOrdersRefreshKey((current) => current + 1);
    }

    await Promise.all(requests);
  }

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setStatus("");
    setIsAuthenticating(true);

    try {
      const result = await loginAdmin(credentials);
      window.sessionStorage.setItem(TOKEN_KEY, result.token);
      setToken(result.token);
      setStatus("Connexion admin réussie.");
    } catch (requestError) {
      setError(
        getApiErrorMessage(
          requestError,
          "Connexion administratrice impossible. Vérifie tes identifiants.",
        ),
      );
    } finally {
      setIsAuthenticating(false);
    }
  }

  function updateFormField<K extends keyof ProductMutationInput>(
    field: K,
    value: ProductMutationInput[K],
  ) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateFormVariants(
    updater: (variants: ProductVariant[]) => ProductVariant[],
  ) {
    setForm((current) => {
      const variants = updater(current.variants).map((variant) => ({
        ...variant,
        stock: getVariantSizeStocks(variant).reduce(
          (total, entry) => total + entry.stock,
          0,
        ),
      }));
      const stock = getStockFromProductVariants(variants);
      const image = getPrimaryProductImage(variants);

      return {
        ...current,
        variants,
        stock,
        image,
        availability: getAvailabilityFromStock(stock),
      };
    });
  }

  function addColorVariant() {
    updateFormVariants((variants) => [
      ...variants,
      {
        id: createVariantId(),
        colorName: "",
        colorHex: "#8C3B4A",
        images: [],
        sizes: [{ size: DEFAULT_CLOTHING_SIZE, stock: 0 }],
        stock: 0,
      },
    ]);
  }

  function addPresetColor(preset: ProductColorPreset) {
    updateFormVariants((variants) => {
      const isAlreadyAdded = variants.some(
        (variant) =>
          variant.colorName.trim().toLocaleLowerCase("fr") ===
          preset.name.toLocaleLowerCase("fr"),
      );

      if (isAlreadyAdded) {
        return variants;
      }

      const emptyVariantIndex = variants.findIndex(
        (variant) =>
          !variant.colorName.trim() &&
          variant.images.length === 0 &&
          variant.stock === 0,
      );

      if (emptyVariantIndex >= 0) {
        return variants.map((variant, index) =>
          index === emptyVariantIndex
            ? {
                ...variant,
                colorName: preset.name,
                colorHex: preset.hex,
              }
            : variant,
        );
      }

      return [
        ...variants,
        {
          id: createVariantId(),
          colorName: preset.name,
          colorHex: preset.hex,
          images: [],
          sizes: [{ size: DEFAULT_CLOTHING_SIZE, stock: 0 }],
          stock: 0,
        },
      ];
    });
  }

  function updateColorVariant<K extends keyof ProductVariant>(
    variantId: string,
    field: K,
    value: ProductVariant[K],
  ) {
    updateFormVariants((variants) =>
      variants.map((variant) => {
        if (variant.id !== variantId) {
          return variant;
        }

        if (field === "colorName" && typeof value === "string") {
          const preset = findProductColorPreset(value);

          return {
            ...variant,
            colorName: value,
            colorHex: preset?.hex ?? variant.colorHex,
          };
        }

        return { ...variant, [field]: value };
      }),
    );
  }

  function removeColorVariant(variantId: string) {
    updateFormVariants((variants) =>
      variants.length > 1
        ? variants.filter((variant) => variant.id !== variantId)
        : variants,
    );
  }

  function addVariantSize(variantId: string, size: ClothingSize) {
    updateFormVariants((variants) =>
      variants.map((variant) =>
        variant.id === variantId &&
        !getVariantSizeStocks(variant).some((entry) => entry.size === size)
          ? {
              ...variant,
              sizes: [...getVariantSizeStocks(variant), { size, stock: 0 }],
            }
          : variant,
      ),
    );
  }

  function updateVariantSizeStock(
    variantId: string,
    size: ClothingSize,
    stock: number,
  ) {
    updateFormVariants((variants) =>
      variants.map((variant) =>
        variant.id === variantId
          ? {
              ...variant,
              sizes: getVariantSizeStocks(variant).map((entry) =>
                entry.size === size
                  ? { ...entry, stock: Math.max(0, stock) }
                  : entry,
              ),
            }
          : variant,
      ),
    );
  }

  function removeVariantSize(variantId: string, size: ClothingSize) {
    updateFormVariants((variants) =>
      variants.map((variant) =>
        variant.id === variantId && getVariantSizeStocks(variant).length > 1
          ? {
              ...variant,
              sizes: getVariantSizeStocks(variant).filter(
                (entry) => entry.size !== size,
              ),
            }
          : variant,
      ),
    );
  }

  function removeVariantImage(variantId: string, imageToRemove: string) {
    updateFormVariants((variants) =>
      variants.map((variant) =>
        variant.id === variantId
          ? {
              ...variant,
              images: variant.images.filter((image) => image !== imageToRemove),
            }
          : variant,
      ),
    );
  }

  function resetForm(statusMessage?: string) {
    setEditingId(null);
    setForm(makeEmptyProductTemplate());
    setTypesInput("");
    setActiveView("editor");
    setIsSidebarOpen(false);

    if (statusMessage) {
      setStatus(statusMessage);
    }
  }

  function hydrateForm(product: Product) {
    const categoryId =
      product.categoryId ||
      categories.find((category) => category.name === product.category)?._id ||
      "";

    setEditingId(product._id ?? null);
    setForm({
      slug: product.slug,
      categoryId,
      category: product.category,
      types: product.types,
      name: product.name,
      shortDescription: product.shortDescription,
      description: product.description,
      benefits: product.benefits,
      priceLabel: product.priceLabel,
      priceAmount: product.priceAmount,
      promotionPrice: product.promotionPrice,
      promotionStartAt: product.promotionStartAt,
      promotionEndAt: product.promotionEndAt,
      image: product.image,
      badge: product.badge ?? "",
      whatsappMessage: product.whatsappMessage,
      featured: product.featured,
      order: product.order,
      variants: getProductVariants(product),
      stock: product.stock,
      availability: product.availability,
      status: product.status,
      isActive: isProductPublished(product),
    });
    setTypesInput(product.types.join(", "));
    setStatus(`Édition ouverte pour "${product.name}".`);
    setError("");
    setActiveView("editor");
    setIsSidebarOpen(false);
  }

  async function handleSaveProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token) {
      setError("Tu dois être connecté en admin.");
      return;
    }

    const variants = form.variants.map((variant) => {
      const sizes = getVariantSizeStocks(variant).map((entry) => ({
        ...entry,
        stock: Math.max(0, entry.stock),
      }));

      return {
        ...variant,
        colorName: variant.colorName.trim(),
        images: variant.images.filter(Boolean),
        sizes,
        stock: sizes.reduce((total, entry) => total + entry.stock, 0),
      };
    });
    const stock = getStockFromProductVariants(variants);
    const image = getPrimaryProductImage(variants);

    if (
      form.status === "published" &&
      variants.some((variant) => variant.images.length === 0)
    ) {
      setError("Ajoute au moins une photo pour chaque couleur avant de publier.");
      return;
    }

    if (variants.some((variant) => variant.sizes.length === 0)) {
      setError("Ajoute au moins une taille pour chaque couleur.");
      return;
    }

    if (!form.priceAmount || form.priceAmount <= 0) {
      setError("Indique un prix normal supérieur à zéro.");
      return;
    }

    if (isReservedAutomaticProductBadge(form.badge)) {
      setError(
        'Le badge "Nouveau" est automatique. Laisse le badge manuel vide.',
      );
      return;
    }

    const hasPromotionValue = Boolean(
      form.promotionPrice ||
      form.promotionStartAt ||
      form.promotionEndAt,
    );

    if (
      hasPromotionValue &&
      (!form.promotionPrice ||
        !form.promotionStartAt ||
        !form.promotionEndAt)
    ) {
      setError(
        "Complète le prix promotionnel, le début et la fin de la promotion.",
      );
      return;
    }

    if (
      form.promotionPrice &&
      form.promotionPrice >= form.priceAmount
    ) {
      setError("Le prix promotionnel doit être inférieur au prix normal.");
      return;
    }

    if (
      form.promotionStartAt &&
      form.promotionEndAt &&
      new Date(form.promotionEndAt) <= new Date(form.promotionStartAt)
    ) {
      setError("La fin de la promotion doit être postérieure à son début.");
      return;
    }

    setIsSaving(true);
    setError("");
    setStatus("");

    try {
      const normalizedPayload: ProductMutationInput = {
        ...form,
        slug: normalizeProductSlug(form.slug),
        priceLabel: formatProductPrice(
          form.priceAmount,
          form.priceLabel || "À partir de",
        ),
        types: Array.from(
          new Set(
            typesInput
              .split(",")
              .map((type) => type.trim())
              .filter(Boolean),
          ),
        ),
        benefits: form.benefits.filter(Boolean),
        variants,
        stock,
        image,
        availability: getAvailabilityFromStock(stock),
        isActive: form.status === "published",
      };

      if (editingId) {
        await updateAdminProduct(editingId, normalizedPayload, token);
        setStatus("Produit mis à jour.");
      } else {
        await createAdminProduct(normalizedPayload, token);
        setStatus("Produit créé.");
      }

      setEditingId(null);
      setForm(makeEmptyProductTemplate());
      setTypesInput("");
      await Promise.all([
        loadProducts(token),
        loadDashboard(token),
        loadNotifications(token),
      ]);
      setCatalogPage(1);
    } catch (requestError) {
      setError(
        getApiErrorMessage(
          requestError,
          "Impossible d'enregistrer le produit. Vérifie les champs saisis.",
        ),
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleVariantImageSelection(
    variantId: string,
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";

    if (files.length === 0) {
      return;
    }

    if (!token) {
      setError("Tu dois être connecté en admin pour envoyer une image.");
      return;
    }

    const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

    if (files.some((file) => !allowedTypes.has(file.type))) {
      setError("Format non accepté. Choisis une image JPG, PNG ou WebP.");
      return;
    }

    if (files.some((file) => file.size > 5 * 1024 * 1024)) {
      setError("Une image dépasse 5 Mo. Choisis des images plus légères.");
      return;
    }

    setIsUploadingImage(true);
    setError("");
    setStatus(`Envoi de ${files.length} photo${files.length > 1 ? "s" : ""}...`);

    try {
      const images = await Promise.all(
        files.map((file) => uploadAdminProductImage(file, token)),
      );
      updateFormVariants((variants) =>
        variants.map((variant) =>
          variant.id === variantId
            ? { ...variant, images: [...variant.images, ...images] }
            : variant,
        ),
      );
      setStatus(`${images.length} photo${images.length > 1 ? "s" : ""} ajoutée${images.length > 1 ? "s" : ""}.`);
    } catch (requestError) {
      setError(
        getApiErrorMessage(
          requestError,
          "Impossible d'envoyer la photo. Vérifie son format et sa taille.",
        ),
      );
      setStatus("");
    } finally {
      setIsUploadingImage(false);
    }
  }

  function handleDeleteProduct(product: Product) {
    if (!token || !product._id) {
      return;
    }

    setProductPendingDeletion(product);
  }

  async function confirmDeleteProduct() {
    const product = productPendingDeletion;

    if (!token || !product?._id) {
      setProductPendingDeletion(null);
      return;
    }

    setDeletingId(product._id);
    setError("");
    setStatus("");

    try {
      await deleteAdminProduct(product._id, token);
      setStatus("Produit supprimé.");

      if (editingId === product._id) {
        setEditingId(null);
        setForm(makeEmptyProductTemplate());
        setTypesInput("");
      }

      await Promise.all([
        loadProducts(token),
        loadDashboard(token),
        loadNotifications(token),
      ]);
      setCatalogPage(1);
    } catch (requestError) {
      setError(
        getApiErrorMessage(requestError, "La suppression du produit a échoué."),
      );
    } finally {
      setDeletingId(null);
      setProductPendingDeletion(null);
    }
  }

  async function confirmProductRestock(input: ProductRestockInput) {
    const product = productPendingRestock;

    if (!token || !product?._id) {
      setProductPendingRestock(null);
      return;
    }

    setIsRestocking(true);
    setError("");
    setStatus("");

    try {
      const updatedProduct = await restockAdminProduct(
        product._id,
        input,
        token,
      );
      const totalAdded = input.items.reduce(
        (total, item) => total + item.quantity,
        0,
      );
      setProducts((current) =>
        current.map((entry) =>
          entry._id === updatedProduct._id ? updatedProduct : entry,
        ),
      );
      setStatus(
        `${totalAdded} unité${totalAdded > 1 ? "s" : ""} ajoutée${totalAdded > 1 ? "s" : ""} au stock de "${updatedProduct.name}".`,
      );
      setProductPendingRestock(null);
      await Promise.all([
        loadDashboard(token),
        loadNotifications(token),
      ]);
    } catch (requestError) {
      setError(
        getApiErrorMessage(
          requestError,
          "Réapprovisionnement impossible. Vérifie les quantités saisies.",
        ),
      );
    } finally {
      setIsRestocking(false);
    }
  }

  async function handleLogout() {
    const activeToken = token;

    try {
      if (activeToken) {
        await logoutAdmin(activeToken);
      }
    } catch {
      // La déconnexion locale doit rester possible si le backend est indisponible.
    } finally {
      window.sessionStorage.removeItem(TOKEN_KEY);
      window.localStorage.removeItem(TOKEN_KEY);
      setToken("");
      setProducts([]);
      setCategories([]);
      setOrdersRefreshKey(0);
      setOrderFocusReference("");
      setCustomerFocusCode("");
      setDashboardStats(null);
      setNotificationCenter(EMPTY_ADMIN_NOTIFICATION_CENTER);
      setEditingId(null);
      setForm(makeEmptyProductTemplate());
      setTypesInput("");
      setStatus("Déconnexion effectuée.");
    }
  }

  function selectView(view: AdminView) {
    setActiveView(view);
    setIsSidebarOpen(false);
    setError("");

    if (view !== "orders") {
      setOrderFocusReference("");
    }

    if (view !== "customers") {
      setCustomerFocusCode("");
    }

    if (view === "system" && window.location.pathname !== "/admin/system") {
      window.history.pushState({}, "", "/admin/system");
    } else if (
      view !== "system" &&
      window.location.pathname === "/admin/system"
    ) {
      window.history.pushState({}, "", "/admin");
    }

    if (view === "dashboard" && token) {
      void loadDashboard(token);
    }

    if (view === "notifications" && token) {
      void loadNotifications(token);
    }

    if (
      token &&
      products.length === 0 &&
      (view === "catalogue" || view === "editor" || view === "orders")
    ) {
      void loadProducts(token);
    }
  }

  function openCustomerOrder(reference: string) {
    setOrderFocusReference(reference);
    setOrdersRefreshKey((current) => current + 1);
    selectView("orders");
  }

  function toggleSidebarCollapsed() {
    setIsSidebarCollapsed((isCollapsed) => {
      const nextState = !isCollapsed;
      window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(nextState));
      return nextState;
    });
  }

  function openNotificationResource(notification: AdminNotification) {
    if (notification.resourceType === "order") {
      const reference =
        typeof notification.details.reference === "string"
          ? notification.details.reference
          : "";
      setOrderFocusReference(reference);
      setOrdersRefreshKey((current) => current + 1);
      selectView("orders");
      return;
    }

    if (notification.resourceType === "product") {
      const reference =
        typeof notification.details.reference === "string"
          ? notification.details.reference
          : "";
      const productName =
        typeof notification.details.productName === "string"
          ? notification.details.productName
          : "";
      setSearchTerm(reference || productName);
      setCatalogPage(1);
      selectView("catalogue");
      return;
    }

    if (notification.resourceType === "customer") {
      const customerCode =
        typeof notification.details.customerCode === "string"
          ? notification.details.customerCode
          : "";
      setCustomerFocusCode(customerCode);
      selectView("customers");
    }
  }

  if (!isSessionReady) {
    return (
      <section
        className="admin-ui-login-shell"
        aria-label="Chargement de la session administrateur"
        aria-busy="true"
      >
        <span className="admin-ui-session-loader" aria-hidden="true" />
      </section>
    );
  }

  if (!token) {
    return (
      <section className="admin-ui-login-shell">
        <div className="admin-ui-login-card">
          <div className="admin-ui-login-brand">
            <Image
              className="admin-ui-login-logo"
              src="/images/favicon-round-preview.png"
              alt=""
              width={40}
              height={40}
              preload
            />
            <div>
              <strong>Tata Lulu Shop</strong>
              <span>Administration</span>
            </div>
          </div>

          <div className="admin-ui-login-copy">
            <h1>Connexion</h1>
            <p>Accède à ton espace de gestion.</p>
          </div>

          <form className="admin-ui-login-form" onSubmit={(event) => void handleLogin(event)}>
            <label>
              Adresse e-mail
              <input
                type="email"
                placeholder="votre@email.com"
                value={credentials.email}
                onChange={(event) =>
                  setCredentials((current) => ({ ...current, email: event.target.value }))
                }
                required
              />
            </label>

            <label>
              Mot de passe
              <span className="admin-ui-password-field">
                <input
                  type={isPasswordVisible ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Votre mot de passe"
                  value={credentials.password}
                  onChange={(event) =>
                    setCredentials((current) => ({ ...current, password: event.target.value }))
                  }
                  required
                />
                <button
                  type="button"
                  className="admin-ui-password-toggle"
                  aria-label={
                    isPasswordVisible
                      ? "Masquer le mot de passe"
                      : "Afficher le mot de passe"
                  }
                  aria-pressed={isPasswordVisible}
                  title={
                    isPasswordVisible
                      ? "Masquer le mot de passe"
                      : "Afficher le mot de passe"
                  }
                  onClick={() => setIsPasswordVisible((visible) => !visible)}
                >
                  {isPasswordVisible ? (
                    <EyeOff size={17} strokeWidth={1.8} aria-hidden="true" />
                  ) : (
                    <Eye size={17} strokeWidth={1.8} aria-hidden="true" />
                  )}
                </button>
              </span>
            </label>

            <Button type="submit" size="lg" loading={isAuthenticating} className="admin-ui-button">
              Se connecter
            </Button>
          </form>

          {error ? <p className="admin-error">{error}</p> : null}
          {status ? <p className="admin-success">{status}</p> : null}
        </div>
      </section>
    );
  }

  return (
    <section
      className={`admin-ui-shell ${isSidebarCollapsed ? "sidebar-collapsed" : ""}`}
    >
      {isSidebarOpen ? (
        <button
          type="button"
          className="admin-ui-sidebar-scrim"
          aria-label="Fermer le menu"
          onClick={() => setIsSidebarOpen(false)}
        />
      ) : null}

      <aside className={`admin-ui-sidebar ${isSidebarOpen ? "is-open" : ""}`}>
        <div className="admin-ui-brand">
          <Image
            className="admin-ui-brand-logo"
            src="/images/favicon-round-preview.png"
            alt=""
            width={40}
            height={40}
          />
          <div className="admin-ui-brand-copy">
            <strong>Tata Lulu Shop</strong>
            <span>Backoffice</span>
          </div>
          <button
            type="button"
            className="admin-ui-sidebar-toggle"
            aria-label={
              isSidebarCollapsed
                ? "Déployer la barre latérale"
                : "Réduire la barre latérale"
            }
            title={
              isSidebarCollapsed
                ? "Déployer la barre latérale"
                : "Réduire la barre latérale"
            }
            aria-pressed={isSidebarCollapsed}
            onClick={toggleSidebarCollapsed}
          >
            {isSidebarCollapsed ? (
              <ChevronsRight size={17} strokeWidth={2.1} aria-hidden="true" />
            ) : (
              <ChevronsLeft size={17} strokeWidth={2.1} aria-hidden="true" />
            )}
          </button>
          <button
            type="button"
            className="admin-ui-sidebar-close"
            aria-label="Fermer le menu"
            onClick={() => setIsSidebarOpen(false)}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <nav className="admin-ui-nav-sections" aria-label="Navigation du backoffice">
          <div className="admin-ui-nav-group">
            <span className="admin-ui-nav-title">Gestion</span>
            <button
              type="button"
              aria-label="Tableau de bord"
              title="Tableau de bord"
              className={`admin-ui-nav-link ${activeView === "dashboard" ? "active" : ""}`}
              onClick={() => selectView("dashboard")}
            >
              <LayoutDashboard size={17} strokeWidth={2} aria-hidden="true" />
              <span>Tableau de bord</span>
            </button>
            <button
              type="button"
              aria-label="Clientes"
              title="Clientes"
              className={`admin-ui-nav-link ${activeView === "customers" ? "active" : ""}`}
              onClick={() => selectView("customers")}
            >
              <Users size={17} strokeWidth={2} aria-hidden="true" />
              <span>Clientes</span>
            </button>
            <button
              type="button"
              aria-label="Commandes"
              title="Commandes"
              className={`admin-ui-nav-link ${activeView === "orders" ? "active" : ""}`}
              onClick={() => selectView("orders")}
            >
              <ClipboardList size={17} strokeWidth={2} aria-hidden="true" />
              <span>Commandes</span>
              {pendingOrderCount > 0 ? (
                <span className="admin-ui-nav-badge">{pendingOrderCount}</span>
              ) : null}
            </button>
            <button
              type="button"
              aria-label="Notifications"
              title="Notifications"
              className={`admin-ui-nav-link ${activeView === "notifications" ? "active" : ""}`}
              onClick={() => selectView("notifications")}
            >
              <Bell size={18} strokeWidth={2} aria-hidden="true" />
              <span>Notifications</span>
              {notificationCenter.summary.unreadCount > 0 ? (
                <span className="admin-ui-nav-badge danger">
                  {notificationCenter.summary.unreadCount}
                </span>
              ) : null}
            </button>
          </div>

          <div className="admin-ui-nav-group">
            <span className="admin-ui-nav-title">Catalogue</span>
            <button
              type="button"
              aria-label="Produits"
              title="Produits"
              className={`admin-ui-nav-link ${activeView === "catalogue" ? "active" : ""}`}
              onClick={() => selectView("catalogue")}
            >
              <Package size={17} strokeWidth={2} aria-hidden="true" />
              <span>Produits</span>
              <span className="admin-ui-nav-count">{totalProducts}</span>
            </button>
            <button
              type="button"
              aria-label="Historique du stock"
              title="Historique du stock"
              className={`admin-ui-nav-link ${activeView === "stock-history" ? "active" : ""}`}
              onClick={() => selectView("stock-history")}
            >
              <ArrowRightLeft size={18} strokeWidth={2} aria-hidden="true" />
              <span>Historique du stock</span>
            </button>
            <button
              type="button"
              aria-label="Documents"
              title="Documents"
              className={`admin-ui-nav-link ${activeView === "documents" ? "active" : ""}`}
              onClick={() => selectView("documents")}
            >
              <FileText size={18} strokeWidth={2} aria-hidden="true" />
              <span>Documents</span>
            </button>
          </div>

          <div className="admin-ui-nav-group">
            <span className="admin-ui-nav-title">Contenu boutique</span>
            <button
              type="button"
              aria-label="Boutique"
              title="Boutique"
              className={`admin-ui-nav-link ${activeView === "store" ? "active" : ""}`}
              onClick={() => selectView("store")}
            >
              <Store size={18} strokeWidth={2} aria-hidden="true" />
              <span>Boutique</span>
            </button>
          </div>

          <div className="admin-ui-nav-group">
            <span className="admin-ui-nav-title">Administration</span>
            <button
              type="button"
              aria-label="Journal d’activité"
              title="Journal d’activité"
              className={`admin-ui-nav-link ${activeView === "audit" ? "active" : ""}`}
              onClick={() => selectView("audit")}
            >
              <History size={18} strokeWidth={2} aria-hidden="true" />
              <span>Journal d’activité</span>
            </button>
            <button
              type="button"
              aria-label="Sauvegardes"
              title="Sauvegardes"
              className={`admin-ui-nav-link ${activeView === "backups" ? "active" : ""}`}
              onClick={() => selectView("backups")}
            >
              <DatabaseBackup size={18} strokeWidth={2} aria-hidden="true" />
              <span>Sauvegardes</span>
            </button>
          </div>

          <div className="admin-ui-nav-group admin-ui-nav-actions">
            <span className="admin-ui-nav-title">Actions rapides</span>
            <button
              type="button"
              aria-label="Nouveau produit"
              title="Nouveau produit"
              className="admin-ui-nav-link"
              onClick={() => resetForm("Nouveau produit prêt.")}
            >
              <PackagePlus size={18} strokeWidth={2} aria-hidden="true" />
              <span>Nouveau produit</span>
            </button>
            <a
              href="/"
              target="_blank"
              rel="noreferrer"
              className="admin-ui-nav-link"
              aria-label="Voir la boutique"
              title="Voir la boutique"
            >
              <Eye size={18} strokeWidth={2} aria-hidden="true" />
              <span>Voir la boutique</span>
            </a>
          </div>
        </nav>

        <div className="admin-ui-sidebar-profile">
          <span className="admin-ui-profile-avatar">
            <Image
              src="/images/favicon-round-preview.png"
              alt=""
              width={40}
              height={40}
            />
          </span>
          <div>
            <strong>{adminName}</strong>
            <span>Administrateur</span>
          </div>
          <button
            type="button"
            aria-label="Se déconnecter"
            title="Se déconnecter"
            onClick={() => void handleLogout()}
          >
            <LogOut size={17} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>
      </aside>

      <div className="admin-ui-main">
        <header className="admin-ui-topbar">
          <button
            type="button"
            className="admin-ui-menu-button"
            aria-label="Ouvrir le menu"
            onClick={() => setIsSidebarOpen(true)}
          >
            <Menu size={19} strokeWidth={2} aria-hidden="true" />
          </button>

          <label className="admin-ui-searchbar" aria-label="Recherche produit">
            <Search size={18} strokeWidth={2} aria-hidden="true" />
            <input
              type="search"
              placeholder="Nom, catégorie, type, couleur ou référence..."
              value={searchTerm}
              onChange={(event) => {
                setSearchTerm(event.target.value);
                setCatalogPage(1);
                if (event.target.value) {
                  setActiveView("catalogue");
                }
              }}
            />
          </label>

          <div className="admin-ui-topbar-actions">
            <button
              type="button"
              className="admin-ui-icon-button admin-notification-bell"
              aria-label={`Notifications${notificationCenter.summary.unreadCount > 0 ? `, ${notificationCenter.summary.unreadCount} non lues` : ""}`}
              onClick={() => selectView("notifications")}
            >
              <Bell size={17} strokeWidth={2} aria-hidden="true" />
              {notificationCenter.summary.unreadCount > 0 ? (
                <span className="admin-notification-bell-count">
                  {notificationCenter.summary.unreadCount > 99
                    ? "99+"
                    : notificationCenter.summary.unreadCount}
                </span>
              ) : null}
            </button>
            <button
              type="button"
              className="admin-ui-icon-button"
              aria-label="Actualiser les données"
              disabled={
                isLoadingProducts ||
                isLoadingDashboard ||
                isLoadingNotifications
              }
              onClick={() => void loadAdminData(token)}
            >
              <RefreshCw size={16} strokeWidth={2} aria-hidden="true" />
            </button>
            <div className="admin-ui-topbar-profile">
              <div>
                <strong>{adminName}</strong>
                <span>Administrateur</span>
              </div>
              <span className="admin-ui-profile-avatar">
                <Image
                  src="/images/favicon-round-preview.png"
                  alt=""
                  width={40}
                  height={40}
                />
              </span>
            </div>
          </div>
        </header>

        <div className="admin-ui-page-heading">
          <div>
            <span className="admin-ui-breadcrumb">Tata Lulu Shop / Backoffice</span>
            <h1>
              {activeView === "dashboard"
                ? "Tableau de bord"
                 : activeView === "orders"
                   ? "Gestion des commandes"
                  : activeView === "customers"
                    ? "Gestion des clientes"
                   : activeView === "catalogue"
                     ? "Gestion des produits"
                    : activeView === "documents"
                      ? "Documents"
                    : activeView === "store"
                      ? "Boutique"
                     : activeView === "editor"
                      ? isEditing
                        ? "Modifier le produit"
                        : "Ajouter un produit"
                      : activeView === "audit"
                        ? "Journal d’activité"
                        : activeView === "backups"
                          ? "Sauvegardes"
                        : activeView === "system"
                          ? "Maintenance système"
                        : activeView === "stock-history"
                          ? "Historique du stock"
                          : "Centre de notifications"}
            </h1>
          </div>
          {activeView !== "editor" &&
          activeView !== "orders" &&
          activeView !== "customers" &&
          activeView !== "notifications" &&
          activeView !== "stock-history" &&
          activeView !== "audit" &&
           activeView !== "backups" &&
           activeView !== "documents" &&
           activeView !== "store" &&
           activeView !== "system" ? (
            <Button
              type="button"
              size="sm"
              className="admin-ui-button"
              onClick={() => resetForm("Nouveau produit prêt.")}
            >
              <PackagePlus size={16} aria-hidden="true" />
              Ajouter un produit
            </Button>
          ) : null}
        </div>

        {error ? <p className="admin-error admin-ui-notice">{error}</p> : null}
        {status ? <p className="admin-success admin-ui-notice">{status}</p> : null}

        <div className="admin-ui-grid">
          {activeView === "dashboard" ? (
            <AdminDashboardAnalytics
              stats={dashboardStats}
              notificationSummary={notificationCenter.summary}
              isLoading={isLoadingDashboard}
              onRefresh={async () => {
                await Promise.all([
                  loadDashboard(token),
                  loadNotifications(token),
                ]);
              }}
              onOpenNotifications={() => selectView("notifications")}
            />
          ) : null}

          {activeView === "orders" ? (
            <AdminOrdersPanel
              token={token}
              products={products}
              categories={categories}
              refreshKey={ordersRefreshKey}
              focusReference={orderFocusReference}
              onProductsRefresh={() => loadProducts(token)}
              onDashboardRefresh={async () => {
                await Promise.all([
                  loadDashboard(token),
                  loadNotifications(token),
                ]);
              }}
              onError={setError}
              onStatus={setStatus}
            />
          ) : null}

          {activeView === "customers" ? (
            <AdminCustomersPanel
              key={customerFocusCode || "all-customers"}
              token={token}
              focusCustomerCode={customerFocusCode}
              onOpenOrder={openCustomerOrder}
            />
          ) : null}

          {activeView === "notifications" ? (
            <AdminNotificationsPanel
              token={token}
              result={notificationCenter}
              isLoading={isLoadingNotifications}
              onRefresh={() => loadNotifications(token)}
              onOpenResource={openNotificationResource}
              onError={setError}
              onStatus={setStatus}
            />
          ) : null}

          {activeView === "audit" ? (
            <AdminAuditPanel token={token} />
          ) : null}

          {activeView === "stock-history" ? (
            <AdminStockMovementsPanel token={token} />
          ) : null}

          {activeView === "backups" ? (
            <AdminBackupPanel token={token} />
          ) : null}

          {activeView === "documents" ? (
            <AdminDocumentsPanel
              token={token}
              onOpenOrders={() => selectView("orders")}
              onOpenBackups={() => selectView("backups")}
            />
          ) : null}

          {activeView === "store" ? (
            <AdminStoreSettingsPanel token={token} />
          ) : null}

          {activeView === "system" ? <AdminSystemPanel token={token} /> : null}

          {activeView === "catalogue" ? (
          <section className="admin-ui-card admin-ui-table-card">
            <div className="admin-ui-card-head">
              <div>
                <span className="admin-ui-kicker">Catalogue</span>
                <h2>Produits en base</h2>
              </div>
              <span className="admin-ui-table-count">
                {filteredProducts.length} produit{filteredProducts.length > 1 ? "s" : ""}
              </span>
            </div>

            <div className="admin-catalog-toolbar">
              <button
                type="button"
                className="admin-catalog-filter-trigger"
                aria-expanded={isCatalogFilterOpen}
                aria-controls="admin-catalog-filter-panel"
                onClick={() => setIsCatalogFilterOpen((current) => !current)}
              >
                <span className="admin-catalog-filter-icon">
                  <SlidersHorizontal size={16} strokeWidth={1.8} aria-hidden="true" />
                </span>
                <span className="admin-catalog-filter-copy">
                  <strong>Filtres</strong>
                  <span>
                    ({filteredProducts.length} produit{filteredProducts.length > 1 ? "s" : ""})
                  </span>
                </span>
                {activeCatalogFilterCount > 0 ? (
                  <span className="admin-catalog-filter-count">{activeCatalogFilterCount}</span>
                ) : null}
              </button>

              <label className="admin-catalog-sort">
                <span className="sr-only">Trier les produits</span>
                <select
                  value={sortOption}
                  onChange={(event) => {
                    setSortOption(event.target.value as AdminSortOption);
                    setCatalogPage(1);
                  }}
                >
                  <option value="featured">En vedette</option>
                  <option value="catalogue">Ordre du catalogue</option>
                  <option value="name">Nom : A à Z</option>
                  <option value="stock-desc">Stock : plus élevé</option>
                  <option value="stock-asc">Stock : plus faible</option>
                </select>
                <ChevronDown size={16} strokeWidth={1.8} aria-hidden="true" />
              </label>
            </div>

            {isCatalogFilterOpen ? (
              <div className="admin-catalog-filter-panel" id="admin-catalog-filter-panel">
                <fieldset className="admin-catalog-filter-group">
                  <legend>Grande catégorie</legend>
                  <div className="admin-catalog-filter-options">
                    <button
                      type="button"
                      className={`admin-catalog-filter-option ${categoryFilter === "all" ? "is-active" : ""}`}
                      onClick={() => {
                        setCategoryFilter("all");
                        setCatalogPage(1);
                      }}
                    >
                      Toutes
                    </button>
                    {categories
                      .filter((category) => category.isActive)
                      .map((category) => (
                      <button
                        type="button"
                        className={`admin-catalog-filter-option ${categoryFilter === category.name ? "is-active" : ""}`}
                        key={category._id}
                        onClick={() => {
                          setCategoryFilter(category.name);
                          setCatalogPage(1);
                        }}
                      >
                        {category.name}
                      </button>
                    ))}
                  </div>
                </fieldset>

                <fieldset className="admin-catalog-filter-group">
                  <legend>État du produit</legend>
                  <div className="admin-catalog-filter-options">
                    <button
                      type="button"
                      className={`admin-catalog-filter-option ${lifecycleFilter === "all" ? "is-active" : ""}`}
                      onClick={() => {
                        setLifecycleFilter("all");
                        setCatalogPage(1);
                      }}
                    >
                      Tous
                    </button>
                    {PRODUCT_STATUSES.map((status) => (
                      <button
                        type="button"
                        className={`admin-catalog-filter-option ${lifecycleFilter === status ? "is-active" : ""}`}
                        key={status}
                        onClick={() => {
                          setLifecycleFilter(status);
                          setCatalogPage(1);
                        }}
                      >
                        {PRODUCT_STATUS_LABELS[status]}
                      </button>
                    ))}
                  </div>
                </fieldset>

                <fieldset className="admin-catalog-filter-group">
                  <legend>Taille</legend>
                  <div className="admin-catalog-filter-options">
                    <button
                      type="button"
                      className={`admin-catalog-filter-option ${sizeFilter === "all" ? "is-active" : ""}`}
                      onClick={() => {
                        setSizeFilter("all");
                        setCatalogPage(1);
                      }}
                    >
                      Toutes
                    </button>
                    {CLOTHING_SIZES.map((size) => (
                      <button
                        type="button"
                        className={`admin-catalog-filter-option ${sizeFilter === size ? "is-active" : ""}`}
                        key={size}
                        onClick={() => {
                          setSizeFilter(size);
                          setCatalogPage(1);
                        }}
                      >
                        {CLOTHING_SIZE_LABELS[size]}
                      </button>
                    ))}
                  </div>
                </fieldset>

                <fieldset className="admin-catalog-filter-group">
                  <legend>Stock</legend>
                  <div className="admin-catalog-filter-options">
                    {(
                      [
                        { value: "all", label: "Tous" },
                        { value: "available", label: "En stock" },
                        { value: "low", label: "Stock faible" },
                        { value: "unavailable", label: "Indisponible" },
                      ] as const
                    ).map((option) => (
                      <button
                        type="button"
                        className={`admin-catalog-filter-option ${stockFilter === option.value ? "is-active" : ""}`}
                        key={option.value}
                        onClick={() => {
                          setStockFilter(option.value);
                          setCatalogPage(1);
                        }}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </fieldset>

                <div className="admin-catalog-filter-actions">
                  <button
                    type="button"
                    className="admin-catalog-filter-reset"
                    disabled={activeCatalogFilterCount === 0}
                    onClick={resetCatalogFilters}
                  >
                    Réinitialiser les filtres
                  </button>
                </div>
              </div>
            ) : null}

            <div className="admin-ui-table">
              <div className="admin-ui-table-head">
                <span>Produit</span>
                <span>Catégorie</span>
                <span>Stock</span>
                <span>État</span>
                <span>Actions</span>
              </div>

              {paginatedProducts.map((product) => {
                const stockTone = getStockTone(product);

                return (
                  <article className="admin-ui-table-row" key={product._id ?? product.slug}>
                    <div className="admin-ui-table-product">
                      {product.image ? (
                        <Image
                          src={product.image}
                          alt={product.name}
                          className="admin-ui-table-thumb"
                          width={84}
                          height={96}
                          sizes="84px"
                          quality={60}
                          unoptimized={isLocalPreviewImage(product.image)}
                        />
                      ) : (
                        <span className="admin-ui-table-thumb is-placeholder">
                          <ImagePlus size={18} strokeWidth={1.7} aria-hidden="true" />
                        </span>
                      )}
                      <div>
                        <strong>{product.name}</strong>
                        <span>
                          {product.displayPriceLabel}
                          {product.isPromotionActive ? " · Promo active" : ""}
                        </span>
                        <small>Réf. {product.reference}</small>
                        {product.confirmedOrderCount > 0 ? (
                          <small className="admin-product-popularity">
                            {product.confirmedOrderCount} commande
                            {product.confirmedOrderCount > 1 ? "s" : ""} ·{" "}
                            {product.confirmedQuantity} pièce
                            {product.confirmedQuantity > 1 ? "s" : ""}
                          </small>
                        ) : null}
                      </div>
                    </div>

                    <div className="admin-ui-table-cell">
                      <span className="admin-ui-mobile-label">Catégorie</span>
                      <span>{formatProductCategory(product.category)}</span>
                    </div>

                    <div className="admin-ui-table-cell">
                      <span className="admin-ui-mobile-label">Stock</span>
                      <span className={`admin-ui-pill ${stockTone.tone}`}>{stockTone.label}</span>
                    </div>

                    <div className="admin-ui-table-cell">
                      <span className="admin-ui-mobile-label">État</span>
                      <div className="admin-ui-pill-group">
                        <span
                          className={`admin-ui-pill ${
                            product.status === "published"
                              ? "success"
                              : product.status === "draft"
                                ? "neutral"
                                : product.status === "hidden"
                                  ? "warning"
                                  : "danger"
                          }`}
                        >
                          {PRODUCT_STATUS_LABELS[product.status]}
                        </span>
                        {product.featured ? (
                          <span className="admin-ui-pill violet">Mis en avant</span>
                        ) : null}
                        {product.isNew ? (
                          <span className="admin-ui-pill new">Nouveau</span>
                        ) : null}
                        {product.isPopular ? (
                          <span className="admin-ui-pill popular">
                            Populaire #{product.popularityRank}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="admin-ui-row-actions">
                      {product._id ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="admin-ui-light-button admin-ui-icon-action restock"
                          aria-label={`Réapprovisionner ${product.name}`}
                          title="Réapprovisionner"
                          onClick={() => {
                            setProductPendingRestock(product);
                            setError("");
                            setStatus("");
                          }}
                        >
                          <PackagePlus
                            size={15}
                            strokeWidth={2}
                            aria-hidden="true"
                          />
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="admin-ui-light-button admin-ui-icon-action"
                        aria-label={`Éditer ${product.name}`}
                        title="Éditer"
                        onClick={() => hydrateForm(product)}
                      >
                        <PencilLine size={15} strokeWidth={2} aria-hidden="true" />
                      </Button>
                      {product._id ? (
                        <Button
                          type="button"
                          variant="danger"
                          size="sm"
                          className="admin-ui-danger-button admin-ui-icon-action delete"
                          aria-label={`Supprimer ${product.name}`}
                          title="Supprimer"
                          loading={deletingId === product._id}
                          onClick={() => handleDeleteProduct(product)}
                        >
                          <Trash2 size={15} strokeWidth={2} aria-hidden="true" />
                        </Button>
                      ) : null}
                    </div>
                  </article>
                );
              })}

              {filteredProducts.length === 0 ? (
                <div className="admin-catalog-empty">
                  <Package size={26} strokeWidth={1.5} aria-hidden="true" />
                  <strong>Aucun produit ne correspond</strong>
                  <span>Modifie les filtres ou la recherche pour retrouver tes produits.</span>
                </div>
              ) : null}
            </div>
            {catalogTotalPages > 1 ? (
              <footer className="admin-list-pagination">
                <span>
                  Page {effectiveCatalogPage} sur {catalogTotalPages}
                </span>
                <div>
                  <button
                    type="button"
                    aria-label="Page précédente du catalogue"
                    disabled={effectiveCatalogPage <= 1}
                    onClick={() =>
                      setCatalogPage((current) => Math.max(1, current - 1))
                    }
                  >
                    <ChevronLeft size={15} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    aria-label="Page suivante du catalogue"
                    disabled={effectiveCatalogPage >= catalogTotalPages}
                    onClick={() =>
                      setCatalogPage((current) =>
                        Math.min(catalogTotalPages, current + 1),
                      )
                    }
                  >
                    <ChevronRight size={15} aria-hidden="true" />
                  </button>
                </div>
              </footer>
            ) : null}
          </section>
          ) : null}

          {activeView === "editor" ? (
          <aside className="admin-ui-card admin-ui-editor-card">
            <div className="admin-ui-card-head">
              <div>
                <span className="admin-ui-kicker">{isEditing ? "Modification" : "Création"}</span>
                <h2>{isEditing ? "Éditer le produit" : "Nouveau produit"}</h2>
              </div>
            </div>

            <form className="admin-ui-editor-form" onSubmit={(event) => void handleSaveProduct(event)}>
              <div className="admin-ui-form-grid two admin-ui-span-2">
                <label>
                  Nom
                  <input
                    value={form.name}
                    onChange={(event) => updateFormField("name", event.target.value)}
                    required
                  />
                </label>
                <label>
                  Catégorie
                  <select
                    value={form.categoryId}
                    onChange={(event) => {
                      const category = categories.find(
                        (entry) => entry._id === event.target.value,
                      );

                      setForm((current) => ({
                        ...current,
                        categoryId: event.target.value,
                        category: category?.name ?? "",
                      }));
                    }}
                    required
                  >
                    <option value="">Choisir une catégorie</option>
                    {categories
                      .filter((category) => category.isActive)
                      .map((category) => (
                        <option key={category._id} value={category._id}>
                          {category.name}
                        </option>
                      ))}
                  </select>
                </label>
              </div>

              <label>
                Slug
                <input
                  value={form.slug}
                  onChange={(event) => updateFormField("slug", event.target.value)}
                  onBlur={(event) =>
                    updateFormField("slug", normalizeProductSlug(event.target.value))
                  }
                  placeholder="Ex: robe-soiree"
                  pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                  required
                />
              </label>

              <label>
                Types du produit
                <input
                  value={typesInput}
                  onChange={(event) => setTypesInput(event.target.value)}
                  placeholder="Ex: Robe de soirée, Robe cocktail"
                />
              </label>

              <label>
                Prix normal (FCFA)
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={form.priceAmount ?? ""}
                  onChange={(event) => {
                    const priceAmount = event.target.value
                      ? Number(event.target.value)
                      : null;

                    setForm((current) => ({
                      ...current,
                      priceAmount,
                      priceLabel: priceAmount
                        ? formatProductPrice(
                            priceAmount,
                            current.priceLabel || "À partir de",
                          )
                        : "",
                    }));
                  }}
                  placeholder="Ex: 3000"
                  required
                />
              </label>

              <section className="admin-promotion-editor admin-ui-span-2">
                <div className="admin-promotion-editor-head">
                  <span className="admin-promotion-icon" aria-hidden="true">
                    <BadgePercent size={17} strokeWidth={2} />
                  </span>
                  <div>
                    <h3>Promotion planifiée</h3>
                    <p>
                      Le prix réduit s’active et s’arrête automatiquement aux
                      dates choisies.
                    </p>
                  </div>
                  {form.promotionPrice ? (
                    <button
                      type="button"
                      className="admin-promotion-clear"
                      onClick={() =>
                        setForm((current) => ({
                          ...current,
                          promotionPrice: null,
                          promotionStartAt: null,
                          promotionEndAt: null,
                        }))
                      }
                    >
                      Effacer
                    </button>
                  ) : null}
                </div>

                <div className="admin-promotion-fields">
                  <label>
                    Prix promotionnel (FCFA)
                    <input
                      type="number"
                      min={1}
                      max={
                        form.priceAmount
                          ? Math.max(1, form.priceAmount - 1)
                          : undefined
                      }
                      step={1}
                      value={form.promotionPrice ?? ""}
                      onChange={(event) =>
                        updateFormField(
                          "promotionPrice",
                          event.target.value
                            ? Number(event.target.value)
                            : null,
                        )
                      }
                      placeholder="Ex: 2500"
                    />
                  </label>
                  <label>
                    Début
                    <input
                      type="datetime-local"
                      value={toDateTimeLocalValue(form.promotionStartAt)}
                      onChange={(event) =>
                        updateFormField(
                          "promotionStartAt",
                          fromDateTimeLocalValue(event.target.value),
                        )
                      }
                    />
                  </label>
                  <label>
                    Fin
                    <input
                      type="datetime-local"
                      min={toDateTimeLocalValue(form.promotionStartAt)}
                      value={toDateTimeLocalValue(form.promotionEndAt)}
                      onChange={(event) =>
                        updateFormField(
                          "promotionEndAt",
                          fromDateTimeLocalValue(event.target.value),
                        )
                      }
                    />
                  </label>
                </div>
              </section>

              <label>
                Description courte
                <textarea
                  rows={3}
                  value={form.shortDescription}
                  onChange={(event) => updateFormField("shortDescription", event.target.value)}
                  required
                />
              </label>

              <label>
                Description complète
                <textarea
                  rows={4}
                  value={form.description}
                  onChange={(event) => updateFormField("description", event.target.value)}
                  required
                />
              </label>

              <label className="admin-ui-span-2">
                Avantages
                <input
                  value={form.benefits.join(", ")}
                  onChange={(event) =>
                    updateFormField(
                      "benefits",
                      event.target.value
                        .split(",")
                        .map((item) => item.trim())
                        .filter(Boolean),
                    )
                  }
                  placeholder="Ex: Matière douce, Coupe flatteuse"
                />
              </label>

              <div className="admin-ui-form-grid two admin-ui-span-2">
                <label>
                  Ordre
                  <input
                    type="number"
                    value={form.order}
                    onChange={(event) => updateFormField("order", Number(event.target.value))}
                    required
                  />
                </label>
                <label>
                  Stock total calculé
                  <input
                    type="number"
                    value={form.stock}
                    readOnly
                  />
                </label>
              </div>

              <section className="admin-variant-editor admin-ui-span-2">
                <div className="admin-variant-editor-head">
                  <div>
                    <h3>Couleurs, tailles, stocks et photos</h3>
                    <p>Chaque couleur conserve sa galerie et son stock détaillé par taille.</p>
                  </div>
                  <button
                    type="button"
                    className="admin-variant-add"
                    onClick={addColorVariant}
                  >
                    <Palette size={15} strokeWidth={2} aria-hidden="true" />
                    Couleur personnalisée
                  </button>
                </div>

                <div className="admin-color-palette">
                  <span className="admin-color-palette-label">
                    Couleurs standards
                  </span>
                  <div className="admin-color-palette-options">
                    {PRODUCT_COLOR_PALETTE.map((preset) => {
                      const isAdded = form.variants.some(
                        (variant) =>
                          variant.colorName.trim().toLocaleLowerCase("fr") ===
                          preset.name.toLocaleLowerCase("fr"),
                      );

                      return (
                        <button
                          type="button"
                          className="admin-color-preset"
                          key={preset.name}
                          disabled={isAdded}
                          aria-label={
                            isAdded
                              ? `${preset.name} est déjà ajouté`
                              : `Ajouter la couleur ${preset.name}`
                          }
                          onClick={() => addPresetColor(preset)}
                        >
                          <span
                            className="admin-color-preset-swatch"
                            style={{ backgroundColor: preset.hex }}
                            aria-hidden="true"
                          />
                          {preset.name}
                        </button>
                      );
                    })}
                  </div>
                  <p className="admin-color-palette-help">
                    Choisis uniquement les couleurs réellement disponibles pour ce produit.
                  </p>
                </div>

                {form.variants.map((variant) => (
                  <article className="admin-variant-card" key={variant.id}>
                    <div className="admin-variant-card-head">
                      <div className="admin-variant-card-title">
                        <span style={{ backgroundColor: variant.colorHex }} aria-hidden="true" />
                        <strong>
                          {variant.colorName.trim() || "Nouvelle couleur"}
                        </strong>
                      </div>
                      <button
                        type="button"
                        className="admin-variant-remove"
                        aria-label={`Supprimer ${variant.colorName.trim() || "la nouvelle couleur"}`}
                        disabled={form.variants.length === 1}
                        onClick={() => removeColorVariant(variant.id)}
                      >
                        <X size={14} strokeWidth={2} aria-hidden="true" />
                      </button>
                    </div>

                    <div className="admin-variant-fields">
                      <label>
                        Nom de la couleur
                        <span className="admin-variant-color-field">
                          <input
                            type="color"
                            value={variant.colorHex}
                            aria-label={`Code couleur de ${variant.colorName.trim() || "la nouvelle couleur"}`}
                            onChange={(event) =>
                              updateColorVariant(variant.id, "colorHex", event.target.value)
                            }
                          />
                          <input
                            value={variant.colorName}
                            onChange={(event) =>
                              updateColorVariant(variant.id, "colorName", event.target.value)
                            }
                            placeholder="Ex: Bordeaux"
                            required
                          />
                        </span>
                      </label>

                      <label>
                        Stock couleur calculé
                        <input
                          type="number"
                          value={variant.stock}
                          readOnly
                        />
                      </label>

                      <label
                        className="admin-variant-upload"
                        data-uploading={isUploadingImage ? "true" : undefined}
                      >
                        <input
                          className="sr-only"
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          multiple
                          disabled={isUploadingImage}
                          onChange={(event) =>
                            void handleVariantImageSelection(variant.id, event)
                          }
                        />
                        <ImagePlus size={16} strokeWidth={2} aria-hidden="true" />
                        {isUploadingImage ? "Envoi..." : "Ajouter des photos"}
                      </label>
                    </div>

                    <div className="admin-variant-sizes">
                      <div className="admin-variant-sizes-head">
                        <div>
                          <strong>Tailles et stocks</strong>
                          <span>Ajoute uniquement les tailles réellement disponibles.</span>
                        </div>
                        <div className="admin-variant-size-adders" aria-label="Ajouter une taille">
                          {CLOTHING_SIZES.map((size) => {
                            const isAdded = getVariantSizeStocks(variant).some(
                              (entry) => entry.size === size,
                            );

                            return (
                              <button
                                type="button"
                                key={size}
                                disabled={isAdded}
                                onClick={() => addVariantSize(variant.id, size)}
                              >
                                {CLOTHING_SIZE_LABELS[size]}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="admin-variant-size-rows">
                        {getVariantSizeStocks(variant).map((entry) => (
                          <div className="admin-variant-size-row" key={entry.size}>
                            <span>{CLOTHING_SIZE_LABELS[entry.size]}</span>
                            <label>
                              <span className="sr-only">
                                Stock {variant.colorName || "couleur"}, taille {CLOTHING_SIZE_LABELS[entry.size]}
                              </span>
                              <input
                                type="number"
                                min={0}
                                value={entry.stock}
                                onChange={(event) =>
                                  updateVariantSizeStock(
                                    variant.id,
                                    entry.size,
                                    Number(event.target.value),
                                  )
                                }
                                required
                              />
                            </label>
                            <button
                              type="button"
                              aria-label={`Supprimer la taille ${CLOTHING_SIZE_LABELS[entry.size]}`}
                              disabled={getVariantSizeStocks(variant).length === 1}
                              onClick={() => removeVariantSize(variant.id, entry.size)}
                            >
                              <X size={13} strokeWidth={2} aria-hidden="true" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {variant.images.length > 0 ? (
                      <div className="admin-variant-images">
                        {variant.images.map((image, imageIndex) => (
                          <div className="admin-variant-image" key={`${image}-${imageIndex}`}>
                            <Image
                              src={image}
                              alt={`${variant.colorName.trim() || "Nouvelle couleur"}, photo ${imageIndex + 1}`}
                              width={160}
                              height={200}
                              sizes="160px"
                              quality={60}
                              unoptimized={isLocalPreviewImage(image)}
                            />
                            <button
                              type="button"
                              aria-label={`Supprimer la photo ${imageIndex + 1} de ${variant.colorName.trim() || "la nouvelle couleur"}`}
                              onClick={() => removeVariantImage(variant.id, image)}
                            >
                              <X size={12} strokeWidth={2} aria-hidden="true" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="admin-variant-empty">
                        Aucune photo pour cette couleur. Elle ne pourra pas être publiée ainsi.
                      </p>
                    )}
                  </article>
                ))}
              </section>

              <section className="admin-badge-editor admin-ui-span-2">
                <label>
                  Badge manuel
                  <input
                    value={form.badge ?? ""}
                    onChange={(event) =>
                      updateFormField("badge", event.target.value)
                    }
                    placeholder="Ex: Best-seller"
                  />
                </label>
                <div className="admin-badge-automatic-note">
                  <CalendarClock size={17} strokeWidth={2} aria-hidden="true" />
                  <div>
                    <strong>
                      {editingProduct?.isNew
                        ? 'Badge "Nouveau" actif'
                        : 'Badge "Nouveau" automatique'}
                    </strong>
                    <span>
                      {getNewBadgeAdminMessage(
                        editingProduct,
                        automaticNewBadgeDurationDays,
                      )}
                    </span>
                  </div>
                </div>
                <p>
                  Un badge manuel reste prioritaire. « Nouveau » et
                  « Nouveauté » sont réservés au calcul automatique.
                </p>
              </section>

              <label className="admin-ui-span-2">
                Message WhatsApp
                <input
                  value={form.whatsappMessage}
                  onChange={(event) => updateFormField("whatsappMessage", event.target.value)}
                  required
                />
              </label>

              <div className="admin-ui-switches">
                <label className="admin-ui-switch-card">
                  <input
                    type="checkbox"
                    checked={form.featured}
                    onChange={(event) => updateFormField("featured", event.target.checked)}
                  />
                  <div>
                    <strong>Produit mis en avant</strong>
                    <span>Utilisé dans les zones premium du site</span>
                  </div>
                </label>
                <label className="admin-product-status-card">
                  <div>
                    <strong>État du produit</strong>
                    <span>
                      {form.status === "published"
                        ? "Visible dans le catalogue public"
                        : form.status === "draft"
                          ? "En préparation, uniquement dans le backoffice"
                          : form.status === "hidden"
                            ? "Retiré temporairement du catalogue"
                            : "Conservé en base, hors des opérations courantes"}
                    </span>
                  </div>
                  <select
                    value={form.status}
                    onChange={(event) => {
                      const status = event.target.value as ProductStatus;
                      updateFormField("status", status);
                      updateFormField("isActive", status === "published");
                    }}
                  >
                    {PRODUCT_STATUSES.map((status) => (
                      <option value={status} key={status}>
                        {PRODUCT_STATUS_LABELS[status]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="admin-ui-preview-card">
                {form.image ? (
                  <Image
                    src={form.image}
                    alt={form.name || "Aperçu produit"}
                    className="admin-ui-preview-image"
                    width={360}
                    height={450}
                    sizes="(max-width: 900px) 100vw, 360px"
                    quality={72}
                    unoptimized={isLocalPreviewImage(form.image)}
                  />
                ) : (
                  <span className="admin-ui-preview-image is-placeholder">
                    <ImagePlus size={20} strokeWidth={1.7} aria-hidden="true" />
                  </span>
                )}
                <div>
                  <strong>{form.name || "Nom du produit"}</strong>
                  <span>
                    {form.promotionPrice
                      ? `${formatProductPrice(form.promotionPrice, form.priceLabel)} · au lieu de ${form.priceLabel}`
                      : form.priceLabel || "Prix du produit"}
                  </span>
                  <p>{form.stock > 0 ? `En stock (${form.stock})` : "Indisponible"}</p>
                </div>
              </div>

              <div className="admin-ui-editor-actions admin-ui-span-2">
                <Button
                  type="submit"
                  size="lg"
                  loading={isSaving}
                  disabled={isUploadingImage}
                  className="admin-ui-button"
                >
                  {isEditing ? "Mettre à jour" : "Créer le produit"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="admin-ui-light-button"
                  onClick={() => resetForm("Formulaire réinitialisé.")}
                >
                  Réinitialiser
                </Button>
              </div>
            </form>
          </aside>
          ) : null}

        </div>
      </div>

      <AdminRestockDialog
        key={productPendingRestock?._id ?? "closed"}
        product={productPendingRestock}
        isLoading={isRestocking}
        onCancel={() => {
          if (!isRestocking) {
            setProductPendingRestock(null);
          }
        }}
        onSubmit={(input) => void confirmProductRestock(input)}
      />

      <ConfirmationDialog
        open={Boolean(productPendingDeletion)}
        reference="Catalogue Tata Lulu"
        title="Supprimer ce produit ?"
        description={
          productPendingDeletion
            ? `« ${productPendingDeletion.name} » sera supprimé définitivement du catalogue.`
            : ""
        }
        detail="Cette action est irréversible. Les anciens liens vers ce produit ne fonctionneront plus."
        confirmLabel="Supprimer"
        tone="danger"
        isLoading={Boolean(
          productPendingDeletion?._id &&
            deletingId === productPendingDeletion._id,
        )}
        onCancel={() => {
          if (!deletingId) {
            setProductPendingDeletion(null);
          }
        }}
        onConfirm={() => void confirmDeleteProduct()}
      />
    </section>
  );
}
