"use client";

import {
  BadgeCheck,
  BellRing,
  Check,
  CheckCheck,
  ChevronRight,
  Clock3,
  PackageCheck,
  PackageX,
  RefreshCw,
  RotateCcw,
  ShoppingBag,
  Trash2,
  UserPlus,
  Users,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import type {
  AdminNotification,
  AdminNotificationCenter,
  AdminNotificationFilter,
  AdminNotificationType,
} from "@/core/domain/models/admin-notification";
import { getApiErrorMessage } from "@/core/infrastructure/http/request-manager";
import {
  deleteReadAdminNotifications,
  readAdminNotification,
  readAllAdminNotifications,
  unreadAdminNotification,
  unreadAllAdminNotifications,
} from "@/services/admin-notification.service";
import { ConfirmationDialog } from "../ui/confirmation-dialog";

type AdminNotificationsPanelProps = {
  token: string;
  result: AdminNotificationCenter;
  isLoading: boolean;
  onRefresh: () => Promise<void>;
  onOpenResource: (notification: AdminNotification) => void;
  onError: (message: string) => void;
  onStatus: (message: string) => void;
};

const ORDER_TYPES: AdminNotificationType[] = [
  "order_pending",
  "order_confirmed",
  "order_cancelled",
  "order_completed",
  "order_expired",
];
const STOCK_TYPES: AdminNotificationType[] = ["low_stock", "out_of_stock"];

const NOTIFICATION_DETAILS: Record<
  AdminNotificationType,
  { label: string; shortLabel: string }
> = {
  order_pending: { label: "Commande", shortLabel: "Nouvelle" },
  order_confirmed: { label: "Commande", shortLabel: "Confirmée" },
  order_cancelled: { label: "Commande", shortLabel: "Annulée" },
  order_completed: { label: "Commande", shortLabel: "Terminée" },
  order_expired: { label: "Commande", shortLabel: "Expirée" },
  low_stock: { label: "Stock", shortLabel: "Stock faible" },
  out_of_stock: { label: "Stock", shortLabel: "Rupture" },
  new_customer: { label: "Cliente", shortLabel: "Cliente" },
  system: { label: "Système", shortLabel: "Système" },
};

const FILTER_DETAILS: Array<{
  value: AdminNotificationFilter;
  label: string;
}> = [
  { value: "all", label: "Toutes" },
  { value: "unread", label: "Non lues" },
  { value: "read", label: "Lues" },
  { value: "orders", label: "Commandes" },
  { value: "stock", label: "Stock" },
  { value: "customers", label: "Clientes" },
  { value: "system", label: "Système" },
];

function formatDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Porto-Novo",
  }).format(new Date(value));
}

function getTypeTotal(
  result: AdminNotificationCenter,
  types: AdminNotificationType[],
) {
  return types.reduce(
    (total, type) => total + result.summary.byType[type].total,
    0,
  );
}

function getFilterCount(
  filter: AdminNotificationFilter,
  result: AdminNotificationCenter,
) {
  if (filter === "unread") return result.summary.unreadCount;
  if (filter === "read") return result.summary.readCount;
  if (filter === "orders") return getTypeTotal(result, ORDER_TYPES);
  if (filter === "stock") return getTypeTotal(result, STOCK_TYPES);
  if (filter === "customers") return result.summary.byType.new_customer.total;
  if (filter === "system") return result.summary.byType.system.total;
  return result.summary.totalCount;
}

function matchesFilter(
  notification: AdminNotification,
  filter: AdminNotificationFilter,
) {
  if (filter === "unread") return !notification.isRead;
  if (filter === "read") return notification.isRead;
  if (filter === "orders") return ORDER_TYPES.includes(notification.type);
  if (filter === "stock") return STOCK_TYPES.includes(notification.type);
  if (filter === "customers") return notification.type === "new_customer";
  if (filter === "system") return notification.type === "system";
  return true;
}

function NotificationIcon({ type }: { type: AdminNotificationType }) {
  if (type === "order_pending") {
    return <ShoppingBag size={17} strokeWidth={1.9} aria-hidden="true" />;
  }
  if (type === "order_confirmed") {
    return <Check size={17} strokeWidth={2} aria-hidden="true" />;
  }
  if (type === "order_cancelled") {
    return <XCircle size={17} strokeWidth={1.9} aria-hidden="true" />;
  }
  if (type === "order_completed") {
    return <BadgeCheck size={17} strokeWidth={1.9} aria-hidden="true" />;
  }
  if (type === "order_expired") {
    return <Clock3 size={17} strokeWidth={1.9} aria-hidden="true" />;
  }
  if (type === "low_stock") {
    return <PackageCheck size={17} strokeWidth={1.9} aria-hidden="true" />;
  }
  if (type === "out_of_stock") {
    return <PackageX size={17} strokeWidth={1.9} aria-hidden="true" />;
  }
  if (type === "new_customer") {
    return <UserPlus size={17} strokeWidth={1.9} aria-hidden="true" />;
  }
  return <BellRing size={17} strokeWidth={1.9} aria-hidden="true" />;
}

function getResourceActionLabel(notification: AdminNotification) {
  if (notification.resourceType === "order") return "Voir la commande";
  if (notification.resourceType === "product") return "Voir le produit";
  if (notification.resourceType === "customer") return "Voir la cliente";
  return "";
}

export function AdminNotificationsPanel({
  token,
  result,
  isLoading,
  onRefresh,
  onOpenResource,
  onError,
  onStatus,
}: AdminNotificationsPanelProps) {
  const [filter, setFilter] = useState<AdminNotificationFilter>("all");
  const [processingId, setProcessingId] = useState("");
  const [globalAction, setGlobalAction] = useState("");
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const visibleItems = useMemo(
    () => result.items.filter((notification) => matchesFilter(notification, filter)),
    [filter, result.items],
  );
  const orderCount = getTypeTotal(result, ORDER_TYPES);
  const stockCount = getTypeTotal(result, STOCK_TYPES);

  async function changeReadState(
    notification: AdminNotification,
    isRead: boolean,
  ) {
    if (notification.isRead === isRead) return;

    setProcessingId(notification._id);
    onError("");

    try {
      if (isRead) {
        await readAdminNotification(notification._id, token);
      } else {
        await unreadAdminNotification(notification._id, token);
      }
      await onRefresh();
    } catch (requestError) {
      onError(
        getApiErrorMessage(
          requestError,
          `Impossible de marquer cette notification comme ${isRead ? "lue" : "non lue"}.`,
        ),
      );
    } finally {
      setProcessingId("");
    }
  }

  async function runGlobalAction(action: "read" | "unread") {
    setGlobalAction(action);
    onError("");

    try {
      const response =
        action === "read"
          ? await readAllAdminNotifications(token)
          : await unreadAllAdminNotifications(token);
      await onRefresh();
      onStatus(
        response.updatedCount > 0
          ? `${response.updatedCount} notification${response.updatedCount > 1 ? "s" : ""} marquée${response.updatedCount > 1 ? "s" : ""} comme ${action === "read" ? "lue" : "non lue"}${response.updatedCount > 1 ? "s" : ""}.`
          : `Aucune notification à marquer comme ${action === "read" ? "lue" : "non lue"}.`,
      );
    } catch (requestError) {
      onError(
        getApiErrorMessage(
          requestError,
          "Impossible de modifier les notifications.",
        ),
      );
    } finally {
      setGlobalAction("");
    }
  }

  async function deleteReadNotifications() {
    setGlobalAction("delete");
    onError("");

    try {
      const response = await deleteReadAdminNotifications(token);
      await onRefresh();
      setIsDeleteDialogOpen(false);
      onStatus(
        response.deletedCount > 0
          ? `${response.deletedCount} notification${response.deletedCount > 1 ? "s lues supprimées" : " lue supprimée"}.`
          : "Aucune notification lue à supprimer.",
      );
    } catch (requestError) {
      onError(
        getApiErrorMessage(
          requestError,
          "Impossible de supprimer les notifications lues.",
        ),
      );
    } finally {
      setGlobalAction("");
    }
  }

  async function openResource(notification: AdminNotification) {
    if (!notification.isRead) {
      await changeReadState(notification, true);
    }
    onOpenResource(notification);
  }

  return (
    <>
      <section className="admin-ui-card admin-notifications-center">
        <header className="admin-notifications-head">
          <div>
            <span className="admin-ui-kicker">Suivi métier</span>
            <h2>Notifications ({result.summary.totalCount})</h2>
            <p>
              Commandes, disponibilité du stock et activité des clientes.
            </p>
          </div>
          <div className="admin-notifications-head-actions">
            <button
              type="button"
              className="admin-notifications-refresh"
              onClick={() => void onRefresh()}
              disabled={isLoading}
            >
              <RefreshCw
                size={15}
                strokeWidth={2}
                aria-hidden="true"
                className={isLoading ? "is-spinning" : ""}
              />
              Actualiser
            </button>
            <button
              type="button"
              className="admin-notifications-read-all"
              onClick={() => void runGlobalAction("read")}
              disabled={Boolean(globalAction) || result.summary.unreadCount === 0}
            >
              <CheckCheck size={15} strokeWidth={2} aria-hidden="true" />
              Tout marquer comme lu
            </button>
            <button
              type="button"
              onClick={() => void runGlobalAction("unread")}
              disabled={Boolean(globalAction) || result.summary.readCount === 0}
            >
              <RotateCcw size={14} strokeWidth={2} aria-hidden="true" />
              Tout marquer comme non lu
            </button>
            <button
              type="button"
              className="admin-notifications-delete-read"
              onClick={() => setIsDeleteDialogOpen(true)}
              disabled={Boolean(globalAction) || result.summary.readCount === 0}
            >
              <Trash2 size={14} strokeWidth={2} aria-hidden="true" />
              Supprimer les lues
            </button>
          </div>
        </header>

        <div className="admin-notifications-summary">
          <button
            type="button"
            className={filter === "orders" ? "active" : ""}
            onClick={() => setFilter("orders")}
          >
            <span className="admin-notification-summary-icon order_pending">
              <ShoppingBag size={17} strokeWidth={1.9} aria-hidden="true" />
            </span>
            <span><strong>{orderCount}</strong><small>Commandes</small></span>
          </button>
          <button
            type="button"
            className={filter === "stock" ? "active" : ""}
            onClick={() => setFilter("stock")}
          >
            <span className="admin-notification-summary-icon low_stock">
              <PackageCheck size={17} strokeWidth={1.9} aria-hidden="true" />
            </span>
            <span><strong>{stockCount}</strong><small>Stock</small></span>
          </button>
          <button
            type="button"
            className={filter === "customers" ? "active" : ""}
            onClick={() => setFilter("customers")}
          >
            <span className="admin-notification-summary-icon new_customer">
              <Users size={17} strokeWidth={1.9} aria-hidden="true" />
            </span>
            <span>
              <strong>{result.summary.byType.new_customer.total}</strong>
              <small>Clientes</small>
            </span>
          </button>
          <button
            type="button"
            className={filter === "unread" ? "active" : ""}
            onClick={() => setFilter("unread")}
          >
            <span className="admin-notification-summary-icon unread">
              <BellRing size={17} strokeWidth={1.9} aria-hidden="true" />
            </span>
            <span><strong>{result.summary.unreadCount}</strong><small>Non lues</small></span>
          </button>
        </div>

        <div className="admin-notifications-toolbar">
          {FILTER_DETAILS.map((entry) => (
            <button
              type="button"
              className={filter === entry.value ? "active" : ""}
              onClick={() => setFilter(entry.value)}
              key={entry.value}
            >
              {entry.label}
              <span>{getFilterCount(entry.value, result)}</span>
            </button>
          ))}
        </div>

        {isLoading && result.items.length === 0 ? (
          <div className="admin-notifications-empty" aria-busy="true">
            <span className="admin-ui-session-loader" aria-hidden="true" />
            <p>Synchronisation des notifications...</p>
          </div>
        ) : visibleItems.length === 0 ? (
          <div className="admin-notifications-empty">
            <BellRing size={22} strokeWidth={1.8} aria-hidden="true" />
            <strong>Aucune notification dans cette catégorie</strong>
            <p>Les nouveaux événements apparaîtront ici automatiquement.</p>
          </div>
        ) : (
          <div className="admin-notifications-list">
            {visibleItems.map((notification) => {
              const resourceLabel = getResourceActionLabel(notification);

              return (
                <article
                  className={`admin-notification-row ${notification.severity} ${notification.isRead ? "read" : "unread"}`}
                  key={notification._id}
                >
                  <span className={`admin-notification-row-icon ${notification.type}`}>
                    <NotificationIcon type={notification.type} />
                  </span>
                  <div className="admin-notification-copy">
                    <div>
                      <span>{NOTIFICATION_DETAILS[notification.type].label}</span>
                      {!notification.isRead ? (
                        <i aria-label="Non lue" title="Non lue" />
                      ) : null}
                    </div>
                    <strong>{notification.title}</strong>
                    <p>{notification.message}</p>
                    <time dateTime={notification.createdAt}>
                      {formatDate(notification.createdAt)}
                    </time>
                  </div>
                  <div className="admin-notification-actions">
                    <button
                      type="button"
                      onClick={() => void changeReadState(notification, !notification.isRead)}
                      disabled={processingId === notification._id}
                    >
                      {notification.isRead ? (
                        <RotateCcw size={14} strokeWidth={2} aria-hidden="true" />
                      ) : (
                        <Check size={14} strokeWidth={2} aria-hidden="true" />
                      )}
                      {notification.isRead ? "Marquer non lue" : "Marquer comme lue"}
                    </button>
                    {resourceLabel ? (
                      <button
                        type="button"
                        className="primary"
                        onClick={() => void openResource(notification)}
                      >
                        {resourceLabel}
                        <ChevronRight size={14} strokeWidth={2} aria-hidden="true" />
                      </button>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <ConfirmationDialog
        open={isDeleteDialogOpen}
        title="Supprimer les notifications lues ?"
        description="Elles disparaîtront du centre de notifications. Les alertes non lues et les situations importantes seront conservées."
        detail={`${result.summary.readCount} notification${result.summary.readCount > 1 ? "s lues sont concernées" : " lue est concernée"}.`}
        confirmLabel="Supprimer les lues"
        tone="danger"
        isLoading={globalAction === "delete"}
        onCancel={() => setIsDeleteDialogOpen(false)}
        onConfirm={() => void deleteReadNotifications()}
      />
    </>
  );
}
