"use client";

import Image from "next/image";
import {
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  ExternalLink,
  FilePlus2,
  ImagePlus,
  Link2,
  PackagePlus,
  Plus,
  RefreshCw,
  Save,
  Search,
  Send,
  ShoppingBag,
  Trash2,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import type {
  AdminCatalogOrderItemInput,
  AdminManualOrderItemInput,
  AdminOrderUpdateInput,
  Order,
  OrderPage,
  OrderItem,
  OrderStatus,
} from "@/core/domain/models/order";
import type { ProductCategory } from "@/core/domain/models/category";
import {
  CLOTHING_SIZES,
  CLOTHING_SIZE_LABELS,
  DEFAULT_CLOTHING_SIZE,
  getProductVariants,
  getVariantSizeStock,
  getVariantSizeStocks,
  PRODUCT_STATUS_LABELS,
  type Product,
} from "@/core/domain/models/product";
import { normalizeProductSlug } from "@/lib/product-slug";
import { getApiErrorMessage } from "@/core/infrastructure/http/request-manager";
import {
  createAdminProduct,
  deleteAdminProduct,
  uploadAdminProductImage,
} from "@/services/admin.service";
import {
  cancelAdminOrder,
  completeAdminOrder,
  confirmAdminOrder,
  downloadAdminOrderPurchaseOrder,
  fetchAdminOrders,
  generateAdminOrderPurchaseOrder,
  updateAdminOrder,
} from "@/services/order.service";
import { Button } from "../ui/button";
import { ConfirmationDialog } from "../ui/confirmation-dialog";

type EditableOrderItem =
  | AdminCatalogOrderItemInput
  | AdminManualOrderItemInput;

type OrderDraft = {
  customerName: string;
  customerPhone: string;
  note: string;
  items: EditableOrderItem[];
};

type AdminOrdersPanelProps = {
  token: string;
  products: Product[];
  categories: ProductCategory[];
  refreshKey: number;
  focusReference?: string;
  onProductsRefresh: () => Promise<void>;
  onDashboardRefresh: () => Promise<void>;
  onError: (message: string) => void;
  onStatus: (message: string) => void;
};

const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "En attente",
  confirmed: "Confirmée",
  cancelled: "Annulée",
  completed: "Terminée",
  expired: "Expirée",
};
const ADMIN_ORDER_PAGE_SIZE = 8;
const EMPTY_ORDER_PAGE: OrderPage = {
  items: [],
  total: 0,
  page: 1,
  pageSize: ADMIN_ORDER_PAGE_SIZE,
  totalPages: 1,
};

function toDraft(order: Order): OrderDraft {
  return {
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    note: order.note,
    items: order.items.map<EditableOrderItem>((item) =>
      item.source === "catalog"
        ? {
            lineId: item.lineId,
            source: "catalog",
            productId: item.productId ?? "",
            variantId: item.variantId ?? "",
            size: item.size ?? DEFAULT_CLOTHING_SIZE,
            quantity: item.quantity,
            unitPrice: item.unitPrice ?? null,
          }
        : {
            lineId: item.lineId,
            source: "manual",
            name: item.name,
            category: item.category,
            colorName: item.colorName,
            colorHex: item.colorHex,
            size: item.size ?? DEFAULT_CLOTHING_SIZE,
            image: item.image,
            priceLabel: item.priceLabel,
            unitPrice: item.unitPrice ?? null,
            quantity: item.quantity,
          },
    ),
  };
}

function formatOrderDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatMoney(value: number) {
  return `${value.toLocaleString("fr-FR")} FCFA`;
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}

function getItemSnapshot(order: Order, lineId: string): OrderItem | undefined {
  return order.items.find((item) => item.lineId === lineId);
}

export function AdminOrdersPanel({
  token,
  products,
  categories,
  refreshKey,
  focusReference = "",
  onProductsRefresh,
  onDashboardRefresh,
  onError,
  onStatus,
}: AdminOrdersPanelProps) {
  const [ordersPage, setOrdersPage] = useState<OrderPage>(EMPTY_ORDER_PAGE);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all");
  const [searchTerm, setSearchTerm] = useState(focusReference);
  const [appliedSearch, setAppliedSearch] = useState(focusReference);
  const [page, setPage] = useState(1);
  const [draftState, setDraftState] = useState<OrderDraft | null>(null);
  const [busyAction, setBusyAction] = useState("");
  const [uploadingLineId, setUploadingLineId] = useState("");
  const [isCatalogPickerOpen, setIsCatalogPickerOpen] = useState(false);
  const [catalogSearchTerm, setCatalogSearchTerm] = useState("");
  const [pendingStatusAction, setPendingStatusAction] = useState<
    "confirm" | "cancel" | "complete" | null
  >(null);
  const orders = ordersPage.items;
  const totalPages = ordersPage.totalPages;
  const effectivePage = Math.min(page, totalPages);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setAppliedSearch(searchTerm.trim());
    }, 250);

    return () => window.clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    let isCurrent = true;

    void fetchAdminOrders(
      {
        search: appliedSearch || undefined,
        status: statusFilter === "all" ? undefined : statusFilter,
        page,
        pageSize: ADMIN_ORDER_PAGE_SIZE,
      },
      token,
    )
      .then((result) => {
        if (!isCurrent) {
          return;
        }

        if (page > result.totalPages) {
          setPage(result.totalPages);
          return;
        }

        setOrdersPage(result);
      })
      .catch((requestError) => {
        if (isCurrent) {
          onError(
            getApiErrorMessage(
              requestError,
              "Impossible de charger les commandes du backoffice.",
            ),
          );
        }
      })
      .finally(() => {
        if (isCurrent) {
          setIsLoading(false);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [appliedSearch, onError, page, refreshKey, statusFilter, token]);

  async function refreshOrders() {
    setIsLoading(true);

    try {
      const result = await fetchAdminOrders(
        {
          search: appliedSearch || undefined,
          status: statusFilter === "all" ? undefined : statusFilter,
          page,
          pageSize: ADMIN_ORDER_PAGE_SIZE,
        },
        token,
      );

      if (page > result.totalPages) {
        setPage(result.totalPages);
      } else {
        setOrdersPage(result);
      }
    } catch (requestError) {
      onError(
        getApiErrorMessage(
          requestError,
          "Impossible de charger les commandes du backoffice.",
        ),
      );
    } finally {
      setIsLoading(false);
    }
  }

  const effectiveSelectedOrderId =
    orders.find((order) => order._id === selectedOrderId)?._id ??
    orders.find((order) => order.status === "pending")?._id ??
    orders[0]?._id ??
    "";
  const selectedOrder =
    orders.find((order) => order._id === effectiveSelectedOrderId) ?? null;
  const draft =
    selectedOrder && selectedOrder._id === selectedOrderId && draftState
      ? draftState
      : selectedOrder
        ? toDraft(selectedOrder)
        : null;

  const knownTotal = (() => {
    if (!draft) {
      return 0;
    }

    return draft.items.reduce(
      (total, item) => total + (item.unitPrice ?? 0) * item.quantity,
      0,
    );
  })();

  const hasUnknownPrice = Boolean(
    draft?.items.some(
      (item) => item.unitPrice === null || item.unitPrice === undefined,
    ),
  );

  function selectOrder(order: Order) {
    setSelectedOrderId(order._id);
    setDraftState(toDraft(order));
    onError("");
    onStatus("");
  }

  function applyStatusFilter(status: OrderStatus | "all") {
    setIsLoading(true);
    setStatusFilter(status);
    setPage(1);
    setSelectedOrderId("");
    setDraftState(null);
  }

  function changePage(nextPage: number) {
    setIsLoading(true);
    setPage(nextPage);
    setSelectedOrderId("");
    setDraftState(null);
  }

  function mutateDraft(updater: (current: OrderDraft) => OrderDraft) {
    setDraftState((current) => {
      const baseDraft = current ?? draft;
      return baseDraft ? updater(baseDraft) : current;
    });
  }

  function updateDraftItem(
    lineId: string,
    updater: (item: EditableOrderItem) => EditableOrderItem,
  ) {
    mutateDraft((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.lineId === lineId ? updater(item) : item,
      ),
    }));
  }

  function removeDraftItem(lineId: string) {
    mutateDraft((current) => ({
      ...current,
      items: current.items.filter((item) => item.lineId !== lineId),
    }));
  }

  function openCatalogPicker() {
    if (products.length === 0) {
      onError("Ajoute d'abord un produit dans le catalogue.");
      return;
    }

    setCatalogSearchTerm("");
    setIsCatalogPickerOpen(true);
  }

  function addCatalogItem(product: Product) {
    const variant = getProductVariants(product)[0] ?? null;
    const sizeStock = variant ? getVariantSizeStocks(variant)[0] : null;

    if (!product?._id || !variant || !sizeStock) {
      onError("Ajoute d'abord un produit avec une couleur et une taille dans le catalogue.");
      return;
    }

    mutateDraft((current) => ({
      ...current,
      items: [
        ...current.items,
        {
          lineId: window.crypto.randomUUID(),
          source: "catalog",
          productId: product._id ?? "",
          variantId: variant.id,
          size: sizeStock.size,
          quantity: 1,
          unitPrice: product.currentPrice ?? product.priceAmount ?? null,
        },
      ],
    }));
    setIsCatalogPickerOpen(false);
    setCatalogSearchTerm("");
  }

  function addManualItem() {
    mutateDraft((current) => ({
      ...current,
      items: [
        ...current.items,
        {
          lineId: window.crypto.randomUUID(),
          source: "manual",
          name: "",
          category: categories.find((category) => category.isActive)?.name ?? "",
          colorName: "",
          colorHex: "#D8C4A3",
          size: DEFAULT_CLOTHING_SIZE,
          image: "",
          priceLabel: "Prix à confirmer",
          unitPrice: null,
          quantity: 1,
        },
      ],
    }));
  }

  async function handleSave() {
    if (!selectedOrder || !draft || draft.items.length === 0) {
      onError("La commande doit contenir au moins un article.");
      return;
    }

    setBusyAction("save");
    onError("");
    onStatus("");

    try {
      const input: AdminOrderUpdateInput = {
        customerName: draft.customerName.trim(),
        customerPhone: draft.customerPhone.trim(),
        note: draft.note.trim(),
        items: draft.items,
      };

      await updateAdminOrder(selectedOrder._id, input, token);
      setDraftState(null);
      await refreshOrders();
      onStatus(`Commande ${selectedOrder.reference} mise à jour.`);
    } catch (requestError) {
      onError(
        getApiErrorMessage(
          requestError,
          "La commande n'a pas pu être enregistrée. Vérifie les articles et les quantités.",
        ),
      );
    } finally {
      setBusyAction("");
    }
  }

  async function runStatusAction(
    action: "confirm" | "cancel" | "complete",
  ) {
    if (!selectedOrder) {
      setPendingStatusAction(null);
      return;
    }

    setBusyAction(action);
    onError("");
    onStatus("");

    try {
      if (action === "confirm") {
        await confirmAdminOrder(selectedOrder._id, token);
      } else if (action === "cancel") {
        await cancelAdminOrder(selectedOrder._id, token);
      } else {
        await completeAdminOrder(selectedOrder._id, token);
      }

      setDraftState(null);
      await Promise.all([
        refreshOrders(),
        onProductsRefresh(),
        onDashboardRefresh(),
      ]);
      onStatus(`Commande ${selectedOrder.reference} mise à jour.`);
    } catch (requestError) {
      onError(
        getApiErrorMessage(
          requestError,
          action === "confirm"
            ? "Confirmation impossible : vérifie que chaque couleur possède encore assez de stock."
            : "Cette action n'a pas pu être appliquée à la commande.",
        ),
      );
    } finally {
      setBusyAction("");
      setPendingStatusAction(null);
    }
  }

  async function handleGeneratePurchaseOrder() {
    if (!selectedOrder) {
      return;
    }

    setBusyAction("generate-purchase-order");
    onError("");
    onStatus("");

    try {
      const updatedOrder = await generateAdminOrderPurchaseOrder(
        selectedOrder._id,
        token,
      );
      setDraftState(null);
      await refreshOrders();
      onStatus(
        `Bon de commande ${updatedOrder.purchaseOrder?.number ?? ""} prêt au téléchargement.`,
      );
    } catch (requestError) {
      onError(
        getApiErrorMessage(
          requestError,
          "Le bon de commande n'a pas pu être généré.",
        ),
      );
    } finally {
      setBusyAction("");
    }
  }

  async function handleDownloadPurchaseOrder() {
    if (!selectedOrder?.purchaseOrder) {
      return;
    }

    setBusyAction("download-purchase-order");
    onError("");
    onStatus("");

    try {
      const result = await downloadAdminOrderPurchaseOrder(
        selectedOrder._id,
        token,
      );
      downloadBlob(result.blob, result.fileName);
      onStatus(
        `Bon de commande ${selectedOrder.purchaseOrder.number} téléchargé.`,
      );
    } catch (requestError) {
      onError(
        getApiErrorMessage(
          requestError,
          "Le téléchargement du bon de commande a échoué.",
        ),
      );
    } finally {
      setBusyAction("");
    }
  }

  async function handleManualImage(
    lineId: string,
    file: File | undefined,
  ) {
    if (!file) {
      return;
    }

    setUploadingLineId(lineId);
    onError("");

    try {
      const image = await uploadAdminProductImage(file, token);
      updateDraftItem(lineId, (item) =>
        item.source === "manual" ? { ...item, image } : item,
      );
    } catch (requestError) {
      onError(
        getApiErrorMessage(
          requestError,
          "La photo de l'article manuel n'a pas pu être envoyée.",
        ),
      );
    } finally {
      setUploadingLineId("");
    }
  }

  async function convertManualItemToHiddenProduct(
    item: AdminManualOrderItemInput,
  ) {
    if (!selectedOrder || !draft || !item.name.trim()) {
      onError("Donne un nom à l'article avant de créer sa fiche masquée.");
      return;
    }

    const category = categories.find(
      (entry) => entry.isActive && entry.name === item.category,
    );

    if (!category) {
      onError("Choisis une catégorie avant de créer la fiche produit.");
      return;
    }

    const compactReference = selectedOrder.reference.split("-").at(-1) ?? "commande";
    const slug = normalizeProductSlug(`${item.name}-${compactReference}`);
    const variantId = `manual-${window.crypto.randomUUID().slice(0, 8)}`;
    const images = item.image ? [item.image] : [];

    setBusyAction(`convert-${item.lineId}`);
    onError("");
    onStatus("");
    let createdProductId = "";
    let orderWasLinked = false;

    try {
      const product = await createAdminProduct(
        {
          slug,
          categoryId: category._id,
          category: category.name,
          types: [],
          name: item.name.trim(),
          shortDescription: `Article ajouté depuis la commande ${selectedOrder.reference}.`,
          description:
            `Article hors catalogue ajouté après échange WhatsApp pour la commande ${selectedOrder.reference}.`,
          benefits: ["Disponible sur demande"],
          priceLabel:
            item.unitPrice === null || item.unitPrice === undefined
              ? item.priceLabel || "Prix à confirmer"
              : formatMoney(item.unitPrice),
          priceAmount: item.unitPrice ?? null,
          promotionPrice: null,
          promotionStartAt: null,
          promotionEndAt: null,
          image: item.image ?? "",
          badge: "",
          whatsappMessage: `Bonjour Tata Lulu, je souhaite cet article : ${item.name.trim()}.`,
          featured: false,
          order: products.length,
          variants: [
            {
              id: variantId,
              colorName: item.colorName?.trim() || "Couleur unique",
              colorHex: item.colorHex || "#D8C4A3",
              images,
              sizes: [
                {
                  size: item.size ?? DEFAULT_CLOTHING_SIZE,
                  stock: item.quantity,
                },
              ],
              stock: item.quantity,
            },
          ],
          stock: item.quantity,
          availability: item.quantity > 0 ? "available" : "unavailable",
          status: "hidden",
          isActive: false,
        },
        token,
      );

      if (!product._id) {
        throw new Error("Produit sans identifiant");
      }

      createdProductId = product._id;
      const catalogItem: AdminCatalogOrderItemInput = {
        lineId: item.lineId,
        source: "catalog",
        productId: product._id,
        variantId,
        size: item.size ?? DEFAULT_CLOTHING_SIZE,
        quantity: item.quantity,
        unitPrice: item.unitPrice ?? null,
      };
      const nextDraft: OrderDraft = {
        ...draft,
        items: draft.items.map((entry) =>
          entry.lineId === item.lineId ? catalogItem : entry,
        ),
      };

      await updateAdminOrder(
        selectedOrder._id,
        {
          customerName: nextDraft.customerName.trim(),
          customerPhone: nextDraft.customerPhone.trim(),
          note: nextDraft.note.trim(),
          items: nextDraft.items,
        },
        token,
      );
      orderWasLinked = true;
      setDraftState(null);
      await Promise.all([
        onProductsRefresh(),
        refreshOrders(),
        onDashboardRefresh(),
      ]);
      onStatus(
        `"${item.name}" a été créé comme produit masqué et relié à la commande.`,
      );
    } catch (requestError) {
      if (createdProductId && !orderWasLinked) {
        try {
          await deleteAdminProduct(createdProductId, token);
        } catch {
          // Le produit reste masqué et peut être supprimé depuis le catalogue.
        }
      }

      onError(
        getApiErrorMessage(
          requestError,
          "Impossible de créer et relier le produit masqué. Aucun stock de commande n'a été modifié.",
        ),
      );
    } finally {
      setBusyAction("");
    }
  }

  if (
    ordersPage.total === 0 &&
    !isLoading &&
    statusFilter === "all" &&
    !appliedSearch
  ) {
    return (
      <section className="admin-ui-card admin-orders-empty">
        <ShoppingBag size={24} strokeWidth={1.7} aria-hidden="true" />
        <h2>Aucune commande pour le moment</h2>
        <p>Les demandes créées depuis le panier apparaîtront ici.</p>
        <Button type="button" variant="outline" onClick={() => void refreshOrders()}>
          <RefreshCw size={15} aria-hidden="true" />
          Actualiser
        </Button>
      </section>
    );
  }

  return (
    <section className="admin-orders-layout">
      <aside className="admin-ui-card admin-orders-list">
        <div className="admin-orders-list-head">
          <div>
            <span className="admin-ui-kicker">Demandes</span>
            <h2>
              {ordersPage.total} commande{ordersPage.total > 1 ? "s" : ""}
            </h2>
          </div>
          <button
            type="button"
            aria-label="Actualiser les commandes"
            onClick={() => void refreshOrders()}
            disabled={isLoading}
          >
            <RefreshCw size={15} aria-hidden="true" />
          </button>
        </div>

        <div className="admin-orders-filters" aria-label="Filtrer les commandes">
          {([
            "all",
            "pending",
            "confirmed",
            "completed",
            "cancelled",
            "expired",
          ] as const).map(
            (status) => (
              <button
                type="button"
                className={statusFilter === status ? "active" : ""}
                key={status}
                onClick={() => applyStatusFilter(status)}
              >
                {status === "all" ? "Toutes" : ORDER_STATUS_LABELS[status]}
              </button>
            ),
          )}
        </div>

        <label className="admin-orders-search">
          <span className="sr-only">Rechercher une commande</span>
          <Search size={14} strokeWidth={2} aria-hidden="true" />
          <input
            type="search"
            placeholder="Référence, cliente, téléphone, article..."
            value={searchTerm}
            onChange={(event) => {
              setIsLoading(true);
              setSearchTerm(event.target.value);
              setPage(1);
              setSelectedOrderId("");
              setDraftState(null);
            }}
          />
        </label>

        <div className="admin-orders-list-scroll">
          {orders.map((order) => (
            <button
              type="button"
              className={`admin-order-list-item ${effectiveSelectedOrderId === order._id ? "active" : ""}`}
              key={order._id}
              onClick={() => selectOrder(order)}
            >
              <span className="admin-order-list-item-top">
                <strong>{order.reference}</strong>
                <span className={`admin-order-status ${order.status}`}>
                  {ORDER_STATUS_LABELS[order.status]}
                </span>
              </span>
              <span>{order.customerName}</span>
              <small>
                {order.items.reduce((total, item) => total + item.quantity, 0)} article
                {order.items.length > 1 ? "s" : ""} · {formatOrderDate(order.createdAt)}
              </small>
            </button>
          ))}
          {orders.length === 0 ? (
            <p className="admin-orders-no-result">
              Aucune commande ne correspond à cette recherche.
            </p>
          ) : null}
        </div>
        {totalPages > 1 ? (
          <footer className="admin-list-pagination admin-orders-pagination">
            <span>
              Page {effectivePage} sur {totalPages}
            </span>
            <div>
              <button
                type="button"
                aria-label="Page précédente des commandes"
                disabled={effectivePage <= 1}
                onClick={() => changePage(Math.max(1, effectivePage - 1))}
              >
                <ChevronLeft size={15} aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label="Page suivante des commandes"
                disabled={effectivePage >= totalPages}
                onClick={() =>
                  changePage(Math.min(totalPages, effectivePage + 1))
                }
              >
                <ChevronRight size={15} aria-hidden="true" />
              </button>
            </div>
          </footer>
        ) : null}
      </aside>

      {selectedOrder && draft ? (
        <article className="admin-ui-card admin-order-editor">
          <header className="admin-order-editor-head">
            <div>
              <span className="admin-ui-kicker">Dossier client</span>
              <h2>{selectedOrder.reference}</h2>
              <p>Créée le {formatOrderDate(selectedOrder.createdAt)}</p>
              {selectedOrder.expiredAt ? (
                <p>Expirée le {formatOrderDate(selectedOrder.expiredAt)}</p>
              ) : null}
            </div>
            <span className={`admin-order-status ${selectedOrder.status}`}>
              {ORDER_STATUS_LABELS[selectedOrder.status]}
            </span>
          </header>

          <div className="admin-order-customer-grid">
            <label>
              Client
              <input
                value={draft.customerName}
                disabled={selectedOrder.status !== "pending"}
                onChange={(event) =>
                  mutateDraft((current) => ({
                    ...current,
                    customerName: event.target.value,
                  }))
                }
              />
            </label>
            <label>
              WhatsApp
              <input
                value={draft.customerPhone}
                disabled={selectedOrder.status !== "pending"}
                onChange={(event) =>
                  mutateDraft((current) => ({
                    ...current,
                    customerPhone: event.target.value,
                  }))
                }
              />
            </label>
            <label className="admin-order-note-field">
              Note
              <textarea
                value={draft.note}
                disabled={selectedOrder.status !== "pending"}
                rows={2}
                onChange={(event) =>
                  mutateDraft((current) => ({
                    ...current,
                    note: event.target.value,
                  }))
                }
              />
            </label>
          </div>

          <div className="admin-order-items-head">
            <div>
              <h3>Articles</h3>
              <p>
                {selectedOrder.status === "pending"
                  ? "Prix, couleur, taille et quantité restent modifiables. Le stock ne bouge qu’à la confirmation."
                  : `Commande ${ORDER_STATUS_LABELS[
                      selectedOrder.status
                    ].toLowerCase()} : les lignes ne sont plus modifiables. Seule une commande en attente peut être ajustée.`}
              </p>
            </div>
            {selectedOrder.status === "pending" ? (
              <div>
                <button type="button" onClick={openCatalogPicker}>
                  <Link2 size={14} aria-hidden="true" />
                  Catalogue
                </button>
                <button type="button" onClick={addManualItem}>
                  <Plus size={14} aria-hidden="true" />
                  Hors catalogue
                </button>
              </div>
            ) : null}
          </div>

          <div className="admin-order-lines">
            {draft.items.map((item, index) => {
              const snapshot = getItemSnapshot(selectedOrder, item.lineId);

              if (item.source === "catalog") {
                const product = products.find(
                  (entry) => entry._id === item.productId,
                );
                const variants = product ? getProductVariants(product) : [];
                const variant = variants.find(
                  (entry) => entry.id === item.variantId,
                );
                const sizeStock = variant
                  ? getVariantSizeStock(variant, item.size)
                  : undefined;
                const insufficientStock = Boolean(
                  sizeStock && sizeStock.stock < item.quantity,
                );

                return (
                  <div className="admin-order-line catalog" key={item.lineId}>
                    <span className="admin-order-line-index">{index + 1}</span>
                    <div className="admin-order-line-image">
                      {variant?.images[0] || product?.image || snapshot?.image ? (
                        <Image
                          src={variant?.images[0] || product?.image || snapshot?.image || ""}
                          alt=""
                          width={96}
                          height={110}
                        />
                      ) : (
                        <ShoppingBag size={18} aria-hidden="true" />
                      )}
                    </div>
                    <div className="admin-order-line-fields">
                      <div className="admin-order-product-field">
                        <span>Produit catalogue</span>
                        <div className="admin-order-product-name">
                          <strong>{snapshot?.name ?? product?.name ?? "Produit introuvable"}</strong>
                          <small>
                            {product
                              ? PRODUCT_STATUS_LABELS[product.status]
                              : snapshot?.category ?? "Référence indisponible"}
                          </small>
                        </div>
                      </div>
                      <label>
                        Couleur
                        <select
                          value={item.variantId}
                          disabled={selectedOrder.status !== "pending"}
                          onChange={(event) => {
                            const nextVariant = variants.find(
                              (entry) => entry.id === event.target.value,
                            );
                            const nextSizeStock = nextVariant
                              ? getVariantSizeStocks(nextVariant)[0]
                              : null;
                            updateDraftItem(item.lineId, (current) =>
                              current.source === "catalog"
                                ? {
                                    ...current,
                                    variantId: event.target.value,
                                    size:
                                      nextSizeStock?.size ??
                                      DEFAULT_CLOTHING_SIZE,
                                  }
                                : current,
                            );
                          }}
                        >
                          {variants.map((entry) => (
                            <option value={entry.id} key={entry.id}>
                              {entry.colorName} · stock {entry.stock}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Taille
                        <select
                          value={item.size}
                          disabled={selectedOrder.status !== "pending"}
                          onChange={(event) =>
                            updateDraftItem(item.lineId, (current) =>
                              current.source === "catalog"
                                ? {
                                    ...current,
                                    size: event.target.value as typeof current.size,
                                  }
                                : current,
                            )
                          }
                        >
                          {variant
                            ? getVariantSizeStocks(variant).map((entry) => (
                                <option value={entry.size} key={entry.size}>
                                  {CLOTHING_SIZE_LABELS[entry.size]} · stock {entry.stock}
                                </option>
                              ))
                            : null}
                        </select>
                      </label>
                      <label>
                        Quantité
                        <input
                          type="number"
                          min={1}
                          value={item.quantity}
                          disabled={selectedOrder.status !== "pending"}
                          onChange={(event) =>
                            updateDraftItem(item.lineId, (current) => ({
                              ...current,
                              quantity: Math.max(1, Number(event.target.value)),
                            }))
                          }
                        />
                      </label>
                      <label>
                        Prix unitaire
                        <input
                          type="number"
                          min={0}
                          placeholder="À confirmer"
                          value={item.unitPrice ?? ""}
                          disabled={selectedOrder.status !== "pending"}
                          onChange={(event) =>
                            updateDraftItem(item.lineId, (current) => ({
                              ...current,
                              unitPrice: event.target.value
                                ? Math.max(0, Number(event.target.value))
                                : null,
                            }))
                          }
                        />
                      </label>
                    </div>
                    <div className="admin-order-line-meta">
                      <span className={insufficientStock ? "danger" : ""}>
                        {variant
                          ? `${variant.stock} disponible${variant.stock > 1 ? "s" : ""}`
                          : "Référence introuvable"}
                      </span>
                      {selectedOrder.status === "pending" ? (
                        <button
                          type="button"
                          aria-label="Retirer cet article"
                          onClick={() => removeDraftItem(item.lineId)}
                        >
                          <Trash2 size={15} aria-hidden="true" />
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              }

              return (
                <div className="admin-order-line manual" key={item.lineId}>
                  <span className="admin-order-line-index">{index + 1}</span>
                  <label className="admin-order-line-image upload">
                    {item.image ? (
                      <Image src={item.image} alt="" width={96} height={110} />
                    ) : (
                      <ImagePlus size={18} aria-hidden="true" />
                    )}
                    {selectedOrder.status === "pending" ? (
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        disabled={uploadingLineId === item.lineId}
                        onChange={(event) =>
                          void handleManualImage(item.lineId, event.target.files?.[0])
                        }
                      />
                    ) : null}
                  </label>
                  <div className="admin-order-line-fields">
                    {snapshot ? (
                      <div className="admin-order-product-field">
                        <span>Article hors catalogue</span>
                        <div className="admin-order-product-name">
                          <strong>{snapshot.name}</strong>
                          <small>Nom enregistré</small>
                        </div>
                      </div>
                    ) : (
                      <label>
                        Article hors catalogue
                        <input
                          value={item.name}
                          placeholder="Nom de l'article"
                          disabled={selectedOrder.status !== "pending"}
                          onChange={(event) =>
                            updateDraftItem(item.lineId, (current) =>
                              current.source === "manual"
                                ? { ...current, name: event.target.value }
                                : current,
                            )
                          }
                        />
                      </label>
                    )}
                    <label>
                      Catégorie
                      <select
                        value={item.category ?? ""}
                        disabled={selectedOrder.status !== "pending"}
                        onChange={(event) =>
                          updateDraftItem(item.lineId, (current) =>
                            current.source === "manual"
                              ? { ...current, category: event.target.value }
                              : current,
                          )
                        }
                      >
                        <option value="">Choisir</option>
                        {categories
                          .filter((category) => category.isActive)
                          .map((category) => (
                            <option value={category.name} key={category._id}>
                              {category.name}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label>
                      Couleur
                      <span className="admin-order-manual-color">
                        <input
                          type="color"
                          value={item.colorHex ?? "#D8C4A3"}
                          disabled={selectedOrder.status !== "pending"}
                          onChange={(event) =>
                            updateDraftItem(item.lineId, (current) =>
                              current.source === "manual"
                                ? { ...current, colorHex: event.target.value }
                                : current,
                            )
                          }
                        />
                        <input
                          value={item.colorName ?? ""}
                          placeholder="Ex: Rouge"
                          disabled={selectedOrder.status !== "pending"}
                          onChange={(event) =>
                            updateDraftItem(item.lineId, (current) =>
                              current.source === "manual"
                                ? { ...current, colorName: event.target.value }
                                : current,
                            )
                          }
                        />
                      </span>
                    </label>
                    <label>
                      Taille
                      <select
                        value={item.size ?? DEFAULT_CLOTHING_SIZE}
                        disabled={selectedOrder.status !== "pending"}
                        onChange={(event) =>
                          updateDraftItem(item.lineId, (current) =>
                            current.source === "manual"
                              ? {
                                  ...current,
                                  size: event.target.value as typeof current.size,
                                }
                              : current,
                          )
                        }
                      >
                        {CLOTHING_SIZES.map((size) => (
                          <option value={size} key={size}>
                            {CLOTHING_SIZE_LABELS[size]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Quantité
                      <input
                        type="number"
                        min={1}
                        value={item.quantity}
                        disabled={selectedOrder.status !== "pending"}
                        onChange={(event) =>
                          updateDraftItem(item.lineId, (current) => ({
                            ...current,
                            quantity: Math.max(1, Number(event.target.value)),
                          }))
                        }
                      />
                    </label>
                    <label>
                      Prix unitaire
                      <input
                        type="number"
                        min={0}
                        placeholder="À confirmer"
                        value={item.unitPrice ?? ""}
                        disabled={selectedOrder.status !== "pending"}
                        onChange={(event) =>
                          updateDraftItem(item.lineId, (current) => ({
                            ...current,
                            unitPrice: event.target.value
                              ? Math.max(0, Number(event.target.value))
                              : null,
                          }))
                        }
                      />
                    </label>
                  </div>
                  <div className="admin-order-line-meta">
                    <span>Sans gestion automatique du stock</span>
                    {selectedOrder.status === "pending" ? (
                      <div>
                        <button
                          type="button"
                          title="Créer comme produit masqué"
                          disabled={busyAction === `convert-${item.lineId}`}
                          onClick={() => void convertManualItemToHiddenProduct(item)}
                        >
                          <PackagePlus size={15} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          aria-label="Retirer cet article"
                          onClick={() => removeDraftItem(item.lineId)}
                        >
                          <Trash2 size={15} aria-hidden="true" />
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="admin-order-total">
            <span>Total renseigné</span>
            <strong>{formatMoney(knownTotal)}</strong>
            {hasUnknownPrice ? <small>Certains prix restent à confirmer.</small> : null}
          </div>

          <footer className="admin-order-editor-actions">
            <div className="admin-order-contact-actions">
              <a
                href={`https://wa.me/${draft.customerPhone.replace(/\D/g, "")}?text=${encodeURIComponent(`Bonjour ${draft.customerName}, concernant votre commande ${selectedOrder.reference}...`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="admin-order-whatsapp"
              >
                <ExternalLink size={14} aria-hidden="true" />
                Ouvrir WhatsApp
              </a>

              {selectedOrder.purchaseOrder ? (
                <>
                  <button
                    type="button"
                    className="admin-order-document-action"
                    disabled={Boolean(busyAction)}
                    onClick={() => void handleDownloadPurchaseOrder()}
                  >
                    <Download size={14} aria-hidden="true" />
                    {busyAction === "download-purchase-order"
                      ? "Téléchargement..."
                      : "Télécharger le bon"}
                  </button>
                  <a
                    href={`https://wa.me/${draft.customerPhone.replace(/\D/g, "")}?text=${encodeURIComponent(
                      `Bonjour ${draft.customerName},\n\nVotre commande ${selectedOrder.reference} a été confirmée.\n\nMontant total : ${hasUnknownPrice ? "à confirmer" : formatMoney(knownTotal)}.\n\nVotre bon de commande ${selectedOrder.purchaseOrder.number} est prêt.\n\nMerci pour votre confiance.\n\nTata Lulu Shop.`,
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="admin-order-document-share"
                  >
                    <Send size={14} aria-hidden="true" />
                    Envoyer le bon
                  </a>
                </>
              ) : selectedOrder.status === "confirmed" ||
                selectedOrder.status === "completed" ? (
                <button
                  type="button"
                  className="admin-order-document-action"
                  disabled={Boolean(busyAction)}
                  onClick={() => void handleGeneratePurchaseOrder()}
                >
                  <FilePlus2 size={14} aria-hidden="true" />
                  {busyAction === "generate-purchase-order"
                    ? "Génération..."
                    : "Générer le bon"}
                </button>
              ) : null}
            </div>

            <div className="admin-order-lifecycle-actions">
              {selectedOrder.status === "pending" ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    loading={busyAction === "save"}
                    onClick={() => void handleSave()}
                  >
                    <Save size={14} aria-hidden="true" />
                    Enregistrer
                  </Button>
                  <Button
                    type="button"
                    loading={busyAction === "confirm"}
                    onClick={() => setPendingStatusAction("confirm")}
                  >
                    <Check size={14} aria-hidden="true" />
                    Confirmer
                  </Button>
                  <button
                    type="button"
                    className="admin-order-danger-action"
                    disabled={Boolean(busyAction)}
                    onClick={() => setPendingStatusAction("cancel")}
                  >
                    <XCircle size={14} aria-hidden="true" />
                    Annuler
                  </button>
                </>
              ) : null}

              {selectedOrder.status === "confirmed" ? (
                <>
                  <Button
                    type="button"
                    loading={busyAction === "complete"}
                    onClick={() => setPendingStatusAction("complete")}
                  >
                    <CheckCircle2 size={14} aria-hidden="true" />
                    Terminer
                  </Button>
                  <button
                    type="button"
                    className="admin-order-danger-action"
                    disabled={Boolean(busyAction)}
                    onClick={() => setPendingStatusAction("cancel")}
                  >
                    <RefreshCw size={14} aria-hidden="true" />
                    Annuler et restaurer
                  </button>
                </>
              ) : null}

              {selectedOrder.status === "completed" ? (
                <span className="admin-order-locked">
                  <CheckCircle2 size={14} aria-hidden="true" />
                  Commande terminée
                </span>
              ) : null}

              {selectedOrder.status === "cancelled" ? (
                <span className="admin-order-locked">
                  <Clock3 size={14} aria-hidden="true" />
                  Commande archivée
                </span>
              ) : null}

              {selectedOrder.status === "expired" ? (
                <span className="admin-order-locked">
                  <Clock3 size={14} aria-hidden="true" />
                  Expirée automatiquement, stock inchangé
                </span>
              ) : null}
            </div>
          </footer>
        </article>
      ) : (
        <article className="admin-ui-card admin-orders-filter-empty">
          <ShoppingBag size={24} strokeWidth={1.7} aria-hidden="true" />
          <h2>Aucune commande à afficher</h2>
          <p>Modifie la recherche ou le statut sélectionné.</p>
        </article>
      )}

      {isCatalogPickerOpen ? (
        <div
          className="admin-order-catalog-picker-backdrop"
          role="presentation"
          onMouseDown={() => setIsCatalogPickerOpen(false)}
        >
          <section
            className="admin-order-catalog-picker"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-order-catalog-picker-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <span>Catalogue</span>
                <h2 id="admin-order-catalog-picker-title">Choisir un produit</h2>
              </div>
              <button
                type="button"
                aria-label="Fermer la sélection"
                onClick={() => setIsCatalogPickerOpen(false)}
              >
                <XCircle size={18} aria-hidden="true" />
              </button>
            </header>

            <label className="admin-order-catalog-picker-search">
              <Search size={16} aria-hidden="true" />
              <input
                autoFocus
                value={catalogSearchTerm}
                placeholder="Rechercher un produit"
                onChange={(event) => setCatalogSearchTerm(event.target.value)}
              />
            </label>

            <div className="admin-order-catalog-picker-list">
              {products
                .filter((product) =>
                  normalizeProductSlug(product.name).includes(
                    normalizeProductSlug(catalogSearchTerm),
                  ),
                )
                .map((product) => {
                  const variant = getProductVariants(product)[0];
                  const canAdd = Boolean(
                    product._id &&
                      variant &&
                      getVariantSizeStocks(variant).length > 0,
                  );

                  return (
                    <button
                      type="button"
                      disabled={!canAdd}
                      onClick={() => addCatalogItem(product)}
                      key={product._id ?? product.slug}
                    >
                      <span>
                        <strong>{product.name}</strong>
                        <small>
                          {product.category} · {PRODUCT_STATUS_LABELS[product.status]}
                        </small>
                      </span>
                      <span>{product.displayPriceLabel}</span>
                    </button>
                  );
                })}
            </div>
          </section>
        </div>
      ) : null}

      <ConfirmationDialog
        open={Boolean(selectedOrder && pendingStatusAction)}
        reference={selectedOrder?.reference}
        title={
          pendingStatusAction === "confirm"
            ? "Confirmer cette commande ?"
            : pendingStatusAction === "complete"
              ? "Terminer cette commande ?"
              : selectedOrder?.status === "confirmed"
                ? "Annuler et restaurer le stock ?"
                : "Annuler cette commande ?"
        }
        description={
          pendingStatusAction === "confirm"
            ? "La commande passera au statut confirmé et pourra ensuite être finalisée."
            : pendingStatusAction === "complete"
              ? "La commande sera marquée comme terminée dans le backoffice."
              : "La commande sera annulée et restera consultable dans l’historique."
        }
        detail={
          pendingStatusAction === "confirm"
            ? "Le stock des articles du catalogue sera immédiatement diminué."
            : pendingStatusAction === "cancel" &&
                selectedOrder?.status === "confirmed"
              ? "Les quantités précédemment retirées seront restaurées."
              : undefined
        }
        confirmLabel={
          pendingStatusAction === "confirm"
            ? "Confirmer"
            : pendingStatusAction === "complete"
              ? "Terminer"
              : "Annuler la commande"
        }
        tone={pendingStatusAction === "cancel" ? "danger" : "primary"}
        isLoading={Boolean(
          pendingStatusAction && busyAction === pendingStatusAction,
        )}
        onCancel={() => {
          if (!busyAction) {
            setPendingStatusAction(null);
          }
        }}
        onConfirm={() => {
          if (pendingStatusAction) {
            void runStatusAction(pendingStatusAction);
          }
        }}
      />
    </section>
  );
}
