import { Types } from "mongoose";
import { env } from "../../config/env";
import { AppError } from "../../utils/AppError";
import { logger } from "../../utils/logger";
import { CustomerModel } from "../customers/customer.model";
import { LOW_STOCK_THRESHOLD } from "../notifications/low-stock-email.service";
import { OrderModel, type OrderRecord } from "../orders/order.model";
import { ProductModel } from "../products/product.model";
import {
  CLOTHING_SIZE_LABELS,
  DEFAULT_CLOTHING_SIZE,
} from "../products/product-size";
import {
  ADMIN_NOTIFICATION_TYPES,
  AdminNotificationModel,
  type AdminNotificationRecord,
  type AdminNotificationResourceType,
  type AdminNotificationSeverity,
  type AdminNotificationType,
} from "./admin-notification.model";

export const ADMIN_NOTIFICATION_FILTERS = [
  "all",
  "unread",
  "read",
  "orders",
  "stock",
  "customers",
  "system",
] as const;

export type AdminNotificationFilter =
  (typeof ADMIN_NOTIFICATION_FILTERS)[number];

type NotificationInput = {
  type: AdminNotificationType;
  severity: AdminNotificationSeverity;
  resourceType: AdminNotificationResourceType;
  resourceId: string;
  dedupeKey?: string;
  title: string;
  message: string;
  occurredAt: Date;
  details?: Record<string, unknown>;
};

type NotificationListInput = {
  filter?: unknown;
  type?: unknown;
  limit?: unknown;
};

const ORDER_NOTIFICATION_TYPES = [
  "order_pending",
  "order_confirmed",
  "order_cancelled",
  "order_completed",
  "order_expired",
] satisfies AdminNotificationType[];
const STOCK_NOTIFICATION_TYPES = [
  "low_stock",
  "out_of_stock",
] satisfies AdminNotificationType[];

let synchronizationPromise: Promise<void> | null = null;
let synchronizationRequestedAt: Date | null = null;

function readPositiveInteger(value: unknown, fallback: number, maximum: number) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.min(parsed, maximum);
}

function formatCurrency(value: number | null) {
  if (value === null) {
    return "Montant à confirmer";
  }

  return `Montant ${new Intl.NumberFormat("fr-FR")
    .format(value)
    .replace(/\u00a0|\u202f/g, " ")} FCFA`;
}

function getOrderTotal(order: Pick<OrderRecord, "items">) {
  if (order.items.some((item) => item.unitPrice === null || item.unitPrice === undefined)) {
    return null;
  }

  return order.items.reduce(
    (total, item) => total + (item.unitPrice ?? 0) * item.quantity,
    0,
  );
}

function getDefaultDedupeKey(
  type: AdminNotificationType,
  resourceId: string,
) {
  return `${type}:${resourceId}`;
}

async function migrateLegacyNotifications() {
  await AdminNotificationModel.collection.deleteMany({
    type: "system_error",
  });

  const legacyNotifications = await AdminNotificationModel.collection
    .find({
      $or: [
        { isRead: { $exists: false } },
        { source: { $exists: true } },
        { sourceId: { $exists: true } },
        { occurredAt: { $exists: true } },
        { type: "stock_low" },
      ],
    })
    .toArray();

  if (legacyNotifications.length === 0) {
    return;
  }

  await AdminNotificationModel.collection.bulkWrite(
    legacyNotifications.map((notification) => {
      const legacy = notification as typeof notification & {
        source?: string;
        sourceId?: string;
        occurredAt?: Date;
        readAt?: Date | null;
      };
      const nextType =
        legacy.type === "stock_low" ? "low_stock" : legacy.type;

      return {
        updateOne: {
          filter: { _id: legacy._id },
          update: {
            $set: {
              type: nextType,
              resourceType: legacy.resourceType ?? legacy.source ?? null,
              resourceId: legacy.resourceId ?? legacy.sourceId ?? null,
              isRead: Boolean(legacy.readAt),
              createdAt:
                legacy.createdAt ?? legacy.occurredAt ?? new Date(),
              updatedAt: legacy.updatedAt ?? new Date(),
            },
            $unset: {
              source: "",
              sourceId: "",
              occurredAt: "",
            },
          },
        },
      };
    }),
    { ordered: false },
  );
}

async function upsertNotification(input: NotificationInput) {
  const dedupeKey =
    input.dedupeKey ?? getDefaultDedupeKey(input.type, input.resourceId);
  const existing = await AdminNotificationModel.findOne({ dedupeKey })
    .select("_id resolvedAt deletedAt")
    .lean();
  const update: Record<string, unknown> = {
    type: input.type,
    severity: input.severity,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    title: input.title,
    message: input.message,
    details: input.details ?? {},
    resolvedAt: null,
  };

  // Une situation résolue qui revient doit redevenir visible et non lue.
  if (existing?.resolvedAt) {
    update.isRead = false;
    update.readAt = null;
    update.deletedAt = null;
    update.createdAt = input.occurredAt;
  }

  await AdminNotificationModel.findOneAndUpdate(
    { dedupeKey },
    {
      $set: update,
      $setOnInsert: {
        dedupeKey,
        isRead: false,
        readAt: null,
        deletedAt: null,
        createdAt: input.occurredAt,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  return dedupeKey;
}

async function resolveInactiveNotifications(
  type: AdminNotificationType,
  activeKeys: string[],
  now: Date,
) {
  await AdminNotificationModel.updateMany(
    {
      type,
      resolvedAt: null,
      dedupeKey: { $nin: activeKeys },
    },
    { $set: { resolvedAt: now } },
  );
}

function getOrderNotification(order: OrderRecord & { _id: Types.ObjectId }) {
  const total = getOrderTotal(order);
  const common = {
    resourceType: "order" as const,
    resourceId: String(order._id),
    details: {
      reference: order.reference,
      customerName: order.customerName,
      total,
    },
  };

  switch (order.status) {
    case "confirmed":
      return {
        ...common,
        type: "order_confirmed" as const,
        severity: "success" as const,
        title: "Commande confirmée",
        message: `La commande ${order.reference} a été confirmée.`,
        occurredAt: order.confirmedAt ?? order.updatedAt,
      };
    case "cancelled":
      return {
        ...common,
        type: "order_cancelled" as const,
        severity: "warning" as const,
        title: "Commande annulée",
        message: `La commande ${order.reference} a été annulée.`,
        occurredAt: order.cancelledAt ?? order.updatedAt,
      };
    case "completed":
      return {
        ...common,
        type: "order_completed" as const,
        severity: "success" as const,
        title: "Commande terminée",
        message: `La commande ${order.reference} est terminée.`,
        occurredAt: order.completedAt ?? order.updatedAt,
      };
    case "expired":
      return {
        ...common,
        type: "order_expired" as const,
        severity: "warning" as const,
        title: "Commande expirée après délai",
        message: `La commande ${order.reference} a dépassé son délai de validation.`,
        occurredAt: order.expiredAt ?? order.updatedAt,
      };
    default:
      return {
        ...common,
        type: "order_pending" as const,
        severity: "info" as const,
        title: "Nouvelle commande",
        message: `Référence ${order.reference} · ${formatCurrency(total)}`,
        occurredAt: order.createdAt,
      };
  }
}

async function synchronizeOrderNotifications(now: Date) {
  const orders = await OrderModel.find()
    .select(
      "_id reference customerName items status createdAt updatedAt confirmedAt cancelledAt completedAt expiredAt",
    )
    .sort({ createdAt: 1, _id: 1 })
    .lean();
  const activeKeys = new Map<AdminNotificationType, string[]>(
    ORDER_NOTIFICATION_TYPES.map((type) => [type, []]),
  );
  const notificationInputs = orders.map(getOrderNotification);
  const keys = await Promise.all(notificationInputs.map(upsertNotification));

  notificationInputs.forEach((input, index) => {
    const key = keys[index];

    if (key) {
      activeKeys.get(input.type)?.push(key);
    }
  });

  await Promise.all(
    ORDER_NOTIFICATION_TYPES.map((type) =>
      resolveInactiveNotifications(type, activeKeys.get(type) ?? [], now),
    ),
  );
}

async function synchronizeStockNotifications(now: Date) {
  const products = await ProductModel.find({ status: "published" })
    .select("_id name reference variants updatedAt")
    .sort({ name: 1, _id: 1 })
    .lean();
  const activeKeys = new Map<AdminNotificationType, string[]>([
    ["low_stock", []],
    ["out_of_stock", []],
  ]);
  const notificationInputs: NotificationInput[] = [];

  for (const product of products) {
    for (const variant of product.variants) {
      const sizeStocks =
        variant.sizes?.length > 0
          ? variant.sizes
          : [{ size: DEFAULT_CLOTHING_SIZE, stock: variant.stock }];

      for (const sizeStock of sizeStocks) {
        if (sizeStock.stock >= LOW_STOCK_THRESHOLD) {
          continue;
        }

        const isOutOfStock = sizeStock.stock === 0;
        const type = isOutOfStock ? "out_of_stock" : "low_stock";
        notificationInputs.push({
          type,
          severity: isOutOfStock ? "critical" : "warning",
          resourceType: "product",
          resourceId: String(product._id),
          dedupeKey: `${type}:${String(product._id)}:${variant.id}:${sizeStock.size}`,
          title: isOutOfStock
            ? "Produit en rupture de stock"
            : "Stock faible",
          message: `Produit : ${product.name} · Couleur : ${variant.colorName} · Taille : ${CLOTHING_SIZE_LABELS[sizeStock.size]} · Stock : ${sizeStock.stock}`,
          occurredAt: product.updatedAt ?? now,
          details: {
            reference: product.reference,
            productName: product.name,
            variantId: variant.id,
            colorName: variant.colorName,
            size: sizeStock.size,
            stock: sizeStock.stock,
          },
        });
      }
    }
  }

  const keys = await Promise.all(notificationInputs.map(upsertNotification));

  notificationInputs.forEach((input, index) => {
    const key = keys[index];

    if (key) {
      activeKeys.get(input.type)?.push(key);
    }
  });

  await Promise.all(
    STOCK_NOTIFICATION_TYPES.map((type) =>
      resolveInactiveNotifications(type, activeKeys.get(type) ?? [], now),
    ),
  );
}

async function synchronizeCustomerNotifications() {
  const customers = await CustomerModel.find()
    .select(
      "_id customerCode name completedOrderCount createdAt updatedAt",
    )
    .sort({ createdAt: 1, _id: 1 })
    .lean();
  const notificationInputs: NotificationInput[] = [];

  for (const customer of customers) {
    const customerId = String(customer._id);

    notificationInputs.push({
      type: "new_customer",
      severity: "info",
      resourceType: "customer",
      resourceId: customerId,
      dedupeKey: `new_customer:${customerId}`,
      title: "Nouvelle cliente enregistrée",
      message: `${customer.name} · ${customer.customerCode}`,
      occurredAt: customer.createdAt,
      details: {
        kind: "new_customer",
        customerCode: customer.customerCode,
        customerName: customer.name,
      },
    });

    if (customer.completedOrderCount >= 10) {
      notificationInputs.push({
        type: "new_customer",
        severity: "success",
        resourceType: "customer",
        resourceId: customerId,
        dedupeKey: `new_customer:loyal-10:${customerId}`,
        title: "Cliente fidèle",
        message: `${customer.name} a atteint 10 commandes terminées.`,
        occurredAt: customer.updatedAt,
        details: {
          kind: "loyal_customer",
          milestone: 10,
          completedOrderCount: customer.completedOrderCount,
          customerCode: customer.customerCode,
          customerName: customer.name,
        },
      });
    }
  }

  await Promise.all(notificationInputs.map(upsertNotification));
}

async function synchronizeAdminNotificationsOnce(now = new Date()) {
  await migrateLegacyNotifications();
  await Promise.all([
    synchronizeOrderNotifications(now),
    synchronizeStockNotifications(now),
    synchronizeCustomerNotifications(),
  ]);
}

export async function synchronizeAdminNotifications(now = new Date()) {
  synchronizationRequestedAt = now;

  if (!synchronizationPromise) {
    synchronizationPromise = (async () => {
      while (synchronizationRequestedAt) {
        const requestedAt = synchronizationRequestedAt;
        synchronizationRequestedAt = null;
        await synchronizeAdminNotificationsOnce(requestedAt);
      }
    })().finally(() => {
      synchronizationPromise = null;
    });
  }

  await synchronizationPromise;
}

export async function synchronizeAdminNotificationsSafely() {
  try {
    await synchronizeAdminNotifications();
  } catch (error) {
    logger.error("Impossible de synchroniser les notifications administrateur.", {
      event: "admin_notifications.sync_failed",
      error,
    });
  }
}

function createEmptyTypeSummary() {
  return Object.fromEntries(
    ADMIN_NOTIFICATION_TYPES.map((type) => [
      type,
      { total: 0, active: 0, unread: 0 },
    ]),
  ) as Record<
    AdminNotificationType,
    { total: number; active: number; unread: number }
  >;
}

export async function getAdminNotificationSummary() {
  const visibleFilter = { deletedAt: null };
  const [totalCount, unreadCount, grouped, lowStockProductIds, newCustomers] =
    await Promise.all([
      AdminNotificationModel.countDocuments(visibleFilter),
      AdminNotificationModel.countDocuments({
        ...visibleFilter,
        isRead: false,
      }),
      AdminNotificationModel.aggregate<{
        _id: AdminNotificationType;
        total: number;
        active: number;
        unread: number;
      }>([
        { $match: visibleFilter },
        {
          $group: {
            _id: "$type",
            total: { $sum: 1 },
            active: {
              $sum: { $cond: [{ $eq: ["$resolvedAt", null] }, 1, 0] },
            },
            unread: {
              $sum: { $cond: [{ $eq: ["$isRead", false] }, 1, 0] },
            },
          },
        },
      ]),
      AdminNotificationModel.distinct("resourceId", {
        ...visibleFilter,
        type: { $in: STOCK_NOTIFICATION_TYPES },
        resolvedAt: null,
      }),
      AdminNotificationModel.countDocuments({
        ...visibleFilter,
        type: "new_customer",
        isRead: false,
        "details.kind": "new_customer",
      }),
    ]);
  const byType = createEmptyTypeSummary();

  grouped.forEach((entry) => {
    if (ADMIN_NOTIFICATION_TYPES.includes(entry._id)) {
      byType[entry._id] = {
        total: entry.total,
        active: entry.active,
        unread: entry.unread,
      };
    }
  });

  return {
    totalCount,
    activeCount: totalCount,
    unreadCount,
    readCount: totalCount - unreadCount,
    byType,
    dashboard: {
      pendingOrders: byType.order_pending.active,
      lowStockProducts: lowStockProductIds.length,
      expiredOrders: byType.order_expired.active,
      newCustomers,
    },
  };
}

function getListFilter(input: NotificationListInput) {
  const requestedFilter =
    typeof input.filter === "string" &&
    ADMIN_NOTIFICATION_FILTERS.includes(input.filter as AdminNotificationFilter)
      ? (input.filter as AdminNotificationFilter)
      : "all";
  const filter: Record<string, unknown> = { deletedAt: null };

  if (
    typeof input.type === "string" &&
    ADMIN_NOTIFICATION_TYPES.includes(input.type as AdminNotificationType)
  ) {
    filter.type = input.type;
    return filter;
  }

  if (requestedFilter === "unread") {
    filter.isRead = false;
  } else if (requestedFilter === "read") {
    filter.isRead = true;
  } else if (requestedFilter === "orders") {
    filter.type = { $in: ORDER_NOTIFICATION_TYPES };
  } else if (requestedFilter === "stock") {
    filter.type = { $in: STOCK_NOTIFICATION_TYPES };
  } else if (requestedFilter === "customers") {
    filter.type = "new_customer";
  } else if (requestedFilter === "system") {
    filter.type = "system";
  }

  return filter;
}

export async function listAdminNotifications(input: NotificationListInput) {
  const limit = readPositiveInteger(input.limit, 100, 200);
  const filter = getListFilter(input);
  const [items, summary] = await Promise.all([
    AdminNotificationModel.aggregate<
      AdminNotificationRecord & { _id: Types.ObjectId }
    >([
      { $match: filter },
      {
        $addFields: {
          sortRead: { $cond: [{ $eq: ["$isRead", false] }, 0, 1] },
        },
      },
      { $sort: { sortRead: 1, createdAt: -1, _id: -1 } },
      { $limit: limit },
      { $project: { sortRead: 0 } },
    ]),
    getAdminNotificationSummary(),
  ]);

  return { items, summary };
}

async function updateReadState(id: string, isRead: boolean, now = new Date()) {
  if (!Types.ObjectId.isValid(id)) {
    throw new AppError("Notification introuvable.", 404);
  }

  const notification = await AdminNotificationModel.findOneAndUpdate(
    { _id: id, deletedAt: null },
    {
      $set: {
        isRead,
        readAt: isRead ? now : null,
      },
    },
    { new: true },
  ).lean();

  if (!notification) {
    throw new AppError("Notification introuvable.", 404);
  }

  return notification;
}

export function markAdminNotificationRead(id: string, now = new Date()) {
  return updateReadState(id, true, now);
}

export function markAdminNotificationUnread(id: string) {
  return updateReadState(id, false);
}

export async function markAllAdminNotificationsRead(now = new Date()) {
  const result = await AdminNotificationModel.updateMany(
    { deletedAt: null, isRead: false },
    { $set: { isRead: true, readAt: now } },
  );

  return { updatedCount: result.modifiedCount };
}

export async function markAllAdminNotificationsUnread() {
  const result = await AdminNotificationModel.updateMany(
    { deletedAt: null, isRead: true },
    { $set: { isRead: false, readAt: null } },
  );

  return { updatedCount: result.modifiedCount };
}

export async function deleteReadAdminNotifications(now = new Date()) {
  const result = await AdminNotificationModel.updateMany(
    { deletedAt: null, isRead: true },
    { $set: { deletedAt: now } },
  );

  return { deletedCount: result.modifiedCount };
}

export async function cleanupOldAdminNotifications(now = new Date()) {
  const cutoff = new Date(
    now.getTime() - env.NOTIFICATION_RETENTION_DAYS * 24 * 60 * 60 * 1_000,
  );
  const result = await AdminNotificationModel.deleteMany({
    $or: [
      { deletedAt: { $lte: cutoff } },
      {
        isRead: true,
        readAt: { $lte: cutoff },
        resolvedAt: { $ne: null },
      },
    ],
  });

  return {
    deletedCount: result.deletedCount,
    cutoff,
    retentionDays: env.NOTIFICATION_RETENTION_DAYS,
  };
}
