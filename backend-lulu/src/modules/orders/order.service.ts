import { randomInt, randomUUID } from "node:crypto";
import mongoose, { Types, type HydratedDocument } from "mongoose";
import { AppError } from "../../utils/AppError";
import { logger } from "../../utils/logger";
import { recordAuditEventSafely } from "../audit/audit-event.service";
import { synchronizeAdminNotificationsSafely } from "../admin-notifications/admin-notification.service";
import { synchronizeCustomersSafely } from "../customers/customer.service";
import { ensureOrderPurchaseOrderSafely } from "../order-documents/order-document.service";
import { LOW_STOCK_THRESHOLD } from "../notifications/low-stock-email.service";
import { sendNewOrderEmail } from "../notifications/new-order-email.service";
import {
  getAvailabilityFromStock,
  getStockFromVariantSizes,
  getStockFromVariants,
  ProductModel,
  type ProductVariantInput,
} from "../products/product.model";
import {
  DEFAULT_CLOTHING_SIZE,
  type ClothingSize,
} from "../products/product-size";
import { resolveProductPricing } from "../products/product-pricing";
import {
  ensureProductDataMigrations,
  notifyLowStockForProduct,
} from "../products/product.service";
import { recordStockMovements } from "../stock-movements/stock-movement.service";
import {
  OrderModel,
  type OrderItemRecord,
  type OrderRecord,
} from "./order.model";
import { buildOrderReferenceDatePart } from "./order-reference";

type PublicOrderInput = {
  clientRequestId: string;
  customerName: string;
  customerPhone: string;
  note?: string;
  items: Array<{
    slug: string;
    variantId: string;
    size?: ClothingSize;
    quantity: number;
  }>;
};

type AdminCatalogItemInput = {
  lineId: string;
  source: "catalog";
  productId: string;
  variantId: string;
  size?: ClothingSize;
  quantity: number;
  unitPrice?: number | null;
};

type AdminManualItemInput = {
  lineId: string;
  source: "manual";
  name: string;
  category?: string;
  colorName?: string;
  colorHex?: string;
  size?: ClothingSize;
  image?: string;
  priceLabel?: string;
  unitPrice?: number | null;
  quantity: number;
};

type AdminOrderUpdateInput = {
  customerName?: string;
  customerPhone?: string;
  note?: string;
  items?: Array<AdminCatalogItemInput | AdminManualItemInput>;
};

type AdminOrderListInput = {
  search?: unknown;
  status?: unknown;
  page?: unknown;
  pageSize?: unknown;
};

const ORDER_EMAIL_CLAIM_TIMEOUT_MS = 5 * 60 * 1000;
let orderSizeMigrationPromise: Promise<void> | null = null;

export async function ensureOrderSizeMigration() {
  if (!orderSizeMigrationPromise) {
    orderSizeMigrationPromise = OrderModel.updateMany(
      { "items.size": { $exists: false } },
      [
        {
          $set: {
            items: {
              $map: {
                input: "$items",
                as: "item",
                in: {
                  $mergeObjects: [
                    "$$item",
                    {
                      size: {
                        $ifNull: ["$$item.size", DEFAULT_CLOTHING_SIZE],
                      },
                    },
                  ],
                },
              },
            },
          },
        },
      ],
    )
      .then(() => undefined)
      .catch((error) => {
        orderSizeMigrationPromise = null;
        throw error;
      });
  }

  await orderSizeMigrationPromise;
}

function readPositiveInteger(value: unknown, fallback: number, maximum: number) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.min(parsed, maximum);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

type OrderStockAuditChange = {
  productId: string;
  productName: string;
  productSlug: string;
  variantId: string;
  colorName: string;
  size: ClothingSize;
  variantBefore: number;
  variantAfter: number;
  productBefore: number;
  productAfter: number;
  difference: number;
};

function getOrderItemCount(items: OrderItemRecord[]) {
  return items.reduce((total, item) => total + item.quantity, 0);
}

function formatPriceLabel(unitPrice: number | null | undefined, fallback: string) {
  return unitPrice === null || unitPrice === undefined
    ? fallback
    : `${unitPrice.toLocaleString("fr-FR")} FCFA`;
}

async function createUniqueReference(now = new Date()) {
  const datePart = buildOrderReferenceDatePart(now);

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const suffix = randomInt(0, 1_000_000).toString().padStart(6, "0");
    const reference = `TL-${datePart}-${suffix}`;
    const exists = await OrderModel.exists({ reference });

    if (!exists) {
      return reference;
    }
  }

  throw new AppError("Impossible de générer une référence de commande.", 500);
}

function aggregatePublicOrderItems(input: PublicOrderInput["items"]) {
  const aggregatedItems = new Map<string, PublicOrderInput["items"][number]>();

  for (const item of input) {
    const size = item.size ?? DEFAULT_CLOTHING_SIZE;
    const key = `${item.slug}\u0000${item.variantId}\u0000${size}`;
    const existingItem = aggregatedItems.get(key);

    if (existingItem) {
      existingItem.quantity += item.quantity;
      continue;
    }

    aggregatedItems.set(key, { ...item, size });
  }

  return Array.from(aggregatedItems.values());
}

async function buildPublicCatalogItems(input: PublicOrderInput["items"]) {
  await ensureProductDataMigrations();
  const aggregatedInput = aggregatePublicOrderItems(input);
  const slugs = Array.from(new Set(aggregatedInput.map((item) => item.slug)));
  const products = await ProductModel.find({
    slug: { $in: slugs },
    status: "published",
  }).lean();
  const productMap = new Map(products.map((product) => [product.slug, product]));

  return aggregatedInput.map<OrderItemRecord>((item) => {
    const product = productMap.get(item.slug);

    if (!product) {
      throw new AppError(`Le produit "${item.slug}" n'est plus disponible.`, 409);
    }

    const variant = product.variants.find((entry) => entry.id === item.variantId);

    if (!variant) {
      throw new AppError(`Une couleur de "${product.name}" n'est plus disponible.`, 409);
    }

    const size = item.size ?? DEFAULT_CLOTHING_SIZE;
    const sizeStock = variant.sizes.find((entry) => entry.size === size);

    if (!sizeStock) {
      throw new AppError(
        `La taille ${size} de "${product.name}" n'est plus disponible.`,
        409,
      );
    }

    if (sizeStock.stock < item.quantity) {
      throw new AppError(
        `Stock insuffisant pour "${product.name}" en ${variant.colorName}, taille ${size}.`,
        409,
      );
    }

    const pricing = resolveProductPricing(product);

    return {
      lineId: randomUUID(),
      source: "catalog",
      productId: new Types.ObjectId(String(product._id)),
      productSlug: product.slug,
      variantId: variant.id,
      name: product.name,
      category: product.category,
      colorName: variant.colorName,
      colorHex: variant.colorHex,
      size,
      image: variant.images[0] ?? product.image,
      priceLabel: pricing.displayPriceLabel,
      unitPrice: pricing.currentPrice,
      quantity: item.quantity,
    };
  });
}

function isMongoDuplicateKeyError(
  error: unknown,
): error is {
  code: number;
  keyPattern?: Record<string, unknown>;
  keyValue?: Record<string, unknown>;
} {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === 11000
  );
}

function isDuplicateKeyFor(error: unknown, field: string) {
  if (!isMongoDuplicateKeyError(error)) {
    return false;
  }

  const keyPattern =
    "keyPattern" in error && typeof error.keyPattern === "object"
      ? error.keyPattern
      : null;
  const keyValue =
    "keyValue" in error && typeof error.keyValue === "object"
      ? error.keyValue
      : null;

  return Boolean(
    (keyPattern && field in keyPattern) ||
      (keyValue && field in keyValue),
  );
}

async function buildAdminItems(
  input: Array<AdminCatalogItemInput | AdminManualItemInput>,
) {
  const catalogInputs = input.filter(
    (item): item is AdminCatalogItemInput => item.source === "catalog",
  );
  const productIds = Array.from(new Set(catalogInputs.map((item) => item.productId)));

  if (productIds.some((id) => !Types.ObjectId.isValid(id))) {
    throw new AppError("Une référence produit de la commande est invalide.", 400);
  }

  const products = await ProductModel.find({ _id: { $in: productIds } }).lean();
  const productMap = new Map(products.map((product) => [String(product._id), product]));

  return input.map<OrderItemRecord>((item) => {
    if (item.source === "manual") {
      return {
        lineId: item.lineId || randomUUID(),
        source: "manual",
        productId: null,
        productSlug: "",
        variantId: "",
        name: item.name,
        category: item.category ?? "Hors catalogue",
        colorName: item.colorName ?? "",
        colorHex: item.colorHex ?? "#D8C4A3",
        size: item.size ?? DEFAULT_CLOTHING_SIZE,
        image: item.image ?? "",
        priceLabel: formatPriceLabel(
          item.unitPrice,
          item.priceLabel ?? "Prix à confirmer",
        ),
        unitPrice: item.unitPrice ?? null,
        quantity: item.quantity,
      };
    }

    const product = productMap.get(item.productId);

    if (!product) {
      throw new AppError("Un produit lié à la commande est introuvable.", 409);
    }

    const variant = product.variants.find((entry) => entry.id === item.variantId);

    if (!variant) {
      throw new AppError(`La couleur choisie pour "${product.name}" est introuvable.`, 409);
    }

    const size = item.size ?? DEFAULT_CLOTHING_SIZE;
    const sizeStock = variant.sizes.find((entry) => entry.size === size);

    if (!sizeStock) {
      throw new AppError(
        `La taille ${size} choisie pour "${product.name}" est introuvable.`,
        409,
      );
    }

    const pricing = resolveProductPricing(product);

    return {
      lineId: item.lineId || randomUUID(),
      source: "catalog",
      productId: new Types.ObjectId(String(product._id)),
      productSlug: product.slug,
      variantId: variant.id,
      name: product.name,
      category: product.category,
      colorName: variant.colorName,
      colorHex: variant.colorHex,
      size,
      image: variant.images[0] ?? product.image,
      priceLabel: formatPriceLabel(
        item.unitPrice,
        pricing.displayPriceLabel,
      ),
      unitPrice: item.unitPrice ?? pricing.currentPrice,
      quantity: item.quantity,
    };
  });
}

export async function createOrder(input: PublicOrderInput) {
  await ensureOrderSizeMigration();
  const existingOrder = await OrderModel.findOne({
    clientRequestId: input.clientRequestId,
  }).lean();

  if (existingOrder) {
    await synchronizeCustomersSafely();
    await synchronizeAdminNotificationsSafely();
    await notifyNewOrder(existingOrder._id);
    return existingOrder;
  }

  const items = await buildPublicCatalogItems(input.items);
  let order: HydratedDocument<OrderRecord> | null = null;
  let wasCreated = false;

  for (let attempt = 0; attempt < 10 && !order; attempt += 1) {
    const reference = await createUniqueReference();

    try {
      order = await OrderModel.create({
        reference,
        clientRequestId: input.clientRequestId,
        customerName: input.customerName,
        customerPhone: input.customerPhone,
        note: input.note ?? "",
        items,
        status: "pending",
        notificationEmailRequestedAt: new Date(),
      });
      wasCreated = true;
    } catch (error) {
      if (!isMongoDuplicateKeyError(error)) {
        throw error;
      }

      const duplicateOrder = await OrderModel.findOne({
        clientRequestId: input.clientRequestId,
      });

      if (duplicateOrder) {
        order = duplicateOrder;
        break;
      }

      if (!isDuplicateKeyFor(error, "reference") || attempt === 9) {
        throw error;
      }
    }
  }

  if (!order) {
    throw new AppError("Impossible de créer la commande.", 500);
  }

  await notifyNewOrder(order._id);
  await synchronizeCustomersSafely();
  await synchronizeAdminNotificationsSafely();

  if (wasCreated) {
    await recordAuditEventSafely({
      action: "order.created",
      actor: "customer",
      resource: "order",
      resourceId: String(order._id),
      resourceLabel: order.reference,
      summary: `Commande ${order.reference} créée par ${order.customerName}.`,
      details: {
        customerName: order.customerName,
        itemCount: getOrderItemCount(order.items),
        lines: order.items.length,
        status: order.status,
      },
    });
  }

  return order;
}

export async function listAdminOrders(input: AdminOrderListInput = {}) {
  await ensureOrderSizeMigration();
  const search = typeof input.search === "string" ? input.search.trim() : "";
  const status =
    typeof input.status === "string" &&
    ["pending", "confirmed", "cancelled", "completed", "expired"].includes(
      input.status,
    )
      ? input.status
      : "";
  const page = readPositiveInteger(input.page, 1, 100_000);
  const pageSize = readPositiveInteger(input.pageSize, 8, 100);
  const filter: Record<string, unknown> = {};

  if (status) {
    filter.status = status;
  }

  if (search) {
    const expression = new RegExp(escapeRegExp(search), "i");
    filter.$or = [
      { reference: expression },
      { customerName: expression },
      { customerPhone: expression },
      { note: expression },
      { "items.name": expression },
      { "items.category": expression },
      { "items.colorName": expression },
      { "items.size": expression },
    ];
  }

  const [items, total] = await Promise.all([
    OrderModel.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    OrderModel.countDocuments(filter),
  ]);

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

async function notifyNewOrder(orderId: Types.ObjectId) {
  const staleClaimDate = new Date(Date.now() - ORDER_EMAIL_CLAIM_TIMEOUT_MS);
  const order = await OrderModel.findOneAndUpdate(
    {
      _id: orderId,
      status: "pending",
      notificationEmailRequestedAt: { $ne: null },
      notificationEmailSentAt: null,
      $or: [
        { notificationEmailClaimedAt: null },
        { notificationEmailClaimedAt: { $lt: staleClaimDate } },
      ],
    },
    {
      $set: { notificationEmailClaimedAt: new Date() },
    },
    { new: true },
  ).lean();

  if (!order) {
    return;
  }

  try {
    const wasSent = await sendNewOrderEmail(order);

    await OrderModel.updateOne(
      { _id: order._id },
      {
        $set: {
          notificationEmailClaimedAt: null,
          ...(wasSent ? { notificationEmailSentAt: new Date() } : {}),
        },
      },
    );
  } catch (error) {
    await OrderModel.updateOne(
      { _id: order._id },
      { $set: { notificationEmailClaimedAt: null } },
    );
    logger.error(
      `Impossible d'envoyer la notification de la commande ${order.reference}.`,
      error,
    );
  }
}

export async function sendPendingOrderEmails() {
  await ensureOrderSizeMigration();
  const orders = await OrderModel.find({
    status: "pending",
    notificationEmailRequestedAt: { $ne: null },
    notificationEmailSentAt: null,
  })
    .select("_id")
    .sort({ createdAt: 1 })
    .limit(100)
    .lean();

  for (const order of orders) {
    await notifyNewOrder(order._id);
  }
}

export async function updateAdminOrder(id: string, input: AdminOrderUpdateInput) {
  await Promise.all([ensureOrderSizeMigration(), ensureProductDataMigrations()]);
  const order = await OrderModel.findById(id);

  if (!order) {
    throw new AppError("Commande introuvable.", 404);
  }

  if (order.status !== "pending") {
    throw new AppError("Seule une commande en attente peut être modifiée.", 409);
  }

  const before = {
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    note: order.note,
    lines: order.items.length,
    itemCount: getOrderItemCount(order.items),
  };

  if (input.customerName !== undefined) {
    order.customerName = input.customerName;
  }

  if (input.customerPhone !== undefined) {
    order.customerPhone = input.customerPhone;
  }

  if (input.note !== undefined) {
    order.note = input.note;
  }

  if (input.items) {
    order.items = await buildAdminItems(input.items);
  }

  await order.save();
  await synchronizeCustomersSafely();
  await synchronizeAdminNotificationsSafely();

  await recordAuditEventSafely({
    action: "order.updated",
    actor: "admin",
    resource: "order",
    resourceId: String(order._id),
    resourceLabel: order.reference,
    summary: `Commande ${order.reference} modifiée.`,
    details: {
      before,
      after: {
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        note: order.note,
        lines: order.items.length,
        itemCount: getOrderItemCount(order.items),
      },
    },
  });

  return order;
}

function aggregateCatalogQuantities(items: OrderItemRecord[]) {
  const quantities = new Map<
    string,
    {
      productId: string;
      variantId: string;
      size: ClothingSize;
      quantity: number;
    }
  >();

  for (const item of items) {
    if (item.source !== "catalog" || !item.productId || !item.variantId) {
      continue;
    }

    const productId = String(item.productId);
    const size = item.size ?? DEFAULT_CLOTHING_SIZE;
    const key = `${productId}::${item.variantId}::${size}`;
    const current = quantities.get(key);

    quantities.set(key, {
      productId,
      variantId: item.variantId,
      size,
      quantity: (current?.quantity ?? 0) + item.quantity,
    });
  }

  return Array.from(quantities.values());
}

export async function confirmAdminOrder(id: string) {
  await Promise.all([ensureOrderSizeMigration(), ensureProductDataMigrations()]);
  const session = await mongoose.startSession();
  const affectedProductIds = new Set<string>();
  const stockAuditChanges: OrderStockAuditChange[] = [];
  let confirmedOrder: OrderRecord | null = null;
  let wasConfirmed = false;

  try {
    await session.withTransaction(async () => {
      affectedProductIds.clear();
      stockAuditChanges.length = 0;
      wasConfirmed = false;
      const order = await OrderModel.findById(id).session(session);

      if (!order) {
        throw new AppError("Commande introuvable.", 404);
      }

      if (order.status === "confirmed" || order.status === "completed") {
        confirmedOrder = order.toObject();
        return;
      }

      if (order.status !== "pending") {
        throw new AppError("Cette commande ne peut plus être confirmée.", 409);
      }

      const quantities = aggregateCatalogQuantities(order.items);

      for (const line of quantities) {
        const product = await ProductModel.findById(line.productId)
          .select("+lowStockAlertSentAt")
          .session(session);

        if (!product) {
          throw new AppError("Un produit de la commande n'existe plus.", 409);
        }

        const variant = product.variants.find(
          (entry) => entry.id === line.variantId,
        );
        const sizeStock = variant?.sizes.find(
          (entry) => entry.size === line.size,
        );

        if (!variant || !sizeStock || sizeStock.stock < line.quantity) {
          const color = variant?.colorName ?? "couleur inconnue";
          throw new AppError(
            `Stock insuffisant pour "${product.name}" en ${color}, taille ${line.size}.`,
            409,
          );
        }

        const variantBefore = sizeStock.stock;
        const productBefore = product.stock;
        sizeStock.stock -= line.quantity;
        variant.stock = getStockFromVariantSizes(variant.sizes, variant.stock);
        product.stock = getStockFromVariants(
          product.variants as ProductVariantInput[],
          product.stock,
        );
        product.availability = getAvailabilityFromStock(product.stock);
        stockAuditChanges.push({
          productId: String(product._id),
          productName: product.name,
          productSlug: product.slug,
          variantId: variant.id,
          colorName: variant.colorName,
          size: line.size,
          variantBefore,
          variantAfter: sizeStock.stock,
          productBefore,
          productAfter: product.stock,
          difference: -line.quantity,
        });
        await product.save({ session });
        affectedProductIds.add(String(product._id));
      }

      const now = new Date();
      order.status = "confirmed";
      order.confirmedAt = now;
      order.inventoryAppliedAt = now;
      order.inventoryRestoredAt = null;
      await order.save({ session });
      await recordStockMovements(
        stockAuditChanges.map((change) => ({
          productId: change.productId,
          productName: change.productName,
          productSlug: change.productSlug,
          variantId: change.variantId,
          colorName: change.colorName,
          size: change.size,
          quantityBefore: change.variantBefore,
          quantityAfter: change.variantAfter,
          difference: change.difference,
          reason: "order_confirmed",
          actor: "admin",
          orderId: String(order._id),
          orderReference: order.reference,
          note: "Stock retiré lors de la confirmation de la commande.",
        })),
        session,
      );
      confirmedOrder = order.toObject();
      wasConfirmed = true;
    });
  } finally {
    await session.endSession();
  }

  for (const productId of affectedProductIds) {
    await notifyLowStockForProduct(productId);
  }

  const finalizedOrder = confirmedOrder as OrderRecord | null;

  if (!finalizedOrder) {
    throw new AppError("La confirmation de la commande a échoué.", 500);
  }

  if (wasConfirmed) {
    for (const change of stockAuditChanges) {
      await recordAuditEventSafely({
        action: "product.stock_changed",
        actor: "admin",
        resource: "product",
        resourceId: change.productId,
        resourceLabel: change.productName,
        summary: `Stock de "${change.productName}" diminué pour la commande ${finalizedOrder.reference}.`,
        details: {
          ...change,
          reason: "order_confirmed",
          orderId: id,
          orderReference: finalizedOrder.reference,
        },
      });
    }

    await recordAuditEventSafely({
      action: "order.confirmed",
      actor: "admin",
      resource: "order",
      resourceId: id,
      resourceLabel: finalizedOrder.reference,
      summary: `Commande ${finalizedOrder.reference} confirmée.`,
      details: {
        itemCount: getOrderItemCount(finalizedOrder.items),
        productsAffected: affectedProductIds.size,
      },
    });
  }

  await synchronizeCustomersSafely();
  await synchronizeAdminNotificationsSafely();
  return (await ensureOrderPurchaseOrderSafely(id)) ?? finalizedOrder;
}

export async function cancelAdminOrder(id: string) {
  await Promise.all([ensureOrderSizeMigration(), ensureProductDataMigrations()]);
  const session = await mongoose.startSession();
  const stockAuditChanges: OrderStockAuditChange[] = [];
  let cancelledOrder: OrderRecord | null = null;
  let previousStatus: OrderRecord["status"] | null = null;
  let wasCancelled = false;

  try {
    await session.withTransaction(async () => {
      stockAuditChanges.length = 0;
      previousStatus = null;
      wasCancelled = false;
      const order = await OrderModel.findById(id).session(session);

      if (!order) {
        throw new AppError("Commande introuvable.", 404);
      }

      if (order.status === "cancelled") {
        cancelledOrder = order.toObject();
        return;
      }

      if (order.status === "completed") {
        throw new AppError("Une commande terminée ne peut pas être annulée.", 409);
      }

      if (order.status === "expired") {
        throw new AppError("Une commande expirée ne peut pas être annulée.", 409);
      }

      previousStatus = order.status;

      if (order.status === "confirmed" && !order.inventoryRestoredAt) {
        const quantities = aggregateCatalogQuantities(order.items);

        for (const line of quantities) {
          const product = await ProductModel.findById(line.productId)
            .select("+lowStockAlertSentAt")
            .session(session);

          if (!product) {
            throw new AppError(
              "Impossible de restaurer le stock d'un produit supprimé.",
              409,
            );
          }

          const variant = product.variants.find(
            (entry) => entry.id === line.variantId,
          );
          const sizeStock = variant?.sizes.find(
            (entry) => entry.size === line.size,
          );

          if (!variant || !sizeStock) {
            throw new AppError(
              `Impossible de restaurer ${line.size} pour une couleur de "${product.name}".`,
              409,
            );
          }

          const variantBefore = sizeStock.stock;
          const productBefore = product.stock;
          sizeStock.stock += line.quantity;
          variant.stock = getStockFromVariantSizes(variant.sizes, variant.stock);
          product.stock = getStockFromVariants(
            product.variants as ProductVariantInput[],
            product.stock,
          );
          product.availability = getAvailabilityFromStock(product.stock);
          if (product.stock >= LOW_STOCK_THRESHOLD) {
            product.lowStockAlertSentAt = null;
          }
          stockAuditChanges.push({
            productId: String(product._id),
            productName: product.name,
            productSlug: product.slug,
            variantId: variant.id,
            colorName: variant.colorName,
            size: line.size,
            variantBefore,
            variantAfter: sizeStock.stock,
            productBefore,
            productAfter: product.stock,
            difference: line.quantity,
          });
          await product.save({ session });
        }

        order.inventoryRestoredAt = new Date();
      }

      order.status = "cancelled";
      order.cancelledAt = new Date();
      await order.save({ session });
      await recordStockMovements(
        stockAuditChanges.map((change) => ({
          productId: change.productId,
          productName: change.productName,
          productSlug: change.productSlug,
          variantId: change.variantId,
          colorName: change.colorName,
          size: change.size,
          quantityBefore: change.variantBefore,
          quantityAfter: change.variantAfter,
          difference: change.difference,
          reason: "order_cancelled",
          actor: "admin",
          orderId: String(order._id),
          orderReference: order.reference,
          note: "Stock restauré après annulation de la commande.",
        })),
        session,
      );
      cancelledOrder = order.toObject();
      wasCancelled = true;
    });
  } finally {
    await session.endSession();
  }

  const finalizedOrder = cancelledOrder as OrderRecord | null;

  if (!finalizedOrder) {
    throw new AppError("L'annulation de la commande a échoué.", 500);
  }

  if (wasCancelled) {
    for (const change of stockAuditChanges) {
      await recordAuditEventSafely({
        action: "product.stock_changed",
        actor: "admin",
        resource: "product",
        resourceId: change.productId,
        resourceLabel: change.productName,
        summary: `Stock de "${change.productName}" restauré après annulation de ${finalizedOrder.reference}.`,
        details: {
          ...change,
          reason: "order_cancelled",
          orderId: id,
          orderReference: finalizedOrder.reference,
        },
      });
    }

    await recordAuditEventSafely({
      action: "order.cancelled",
      actor: "admin",
      resource: "order",
      resourceId: id,
      resourceLabel: finalizedOrder.reference,
      summary: `Commande ${finalizedOrder.reference} annulée.`,
      details: {
        previousStatus,
        stockRestored: stockAuditChanges.length > 0,
      },
    });
  }

  await synchronizeCustomersSafely();
  await synchronizeAdminNotificationsSafely();
  return finalizedOrder;
}

export async function completeAdminOrder(id: string) {
  const completedAt = new Date();
  const order = await OrderModel.findOneAndUpdate(
    { _id: id, status: "confirmed" },
    {
      $set: {
        status: "completed",
        completedAt,
      },
    },
    { new: true },
  );

  if (!order) {
    const existingOrder = await OrderModel.findById(id);

    if (!existingOrder) {
      throw new AppError("Commande introuvable.", 404);
    }

    if (existingOrder.status === "completed") {
      return existingOrder;
    }

    throw new AppError("Seule une commande confirmée peut être terminée.", 409);
  }

  await recordAuditEventSafely({
    action: "order.completed",
    actor: "admin",
    resource: "order",
    resourceId: String(order._id),
    resourceLabel: order.reference,
    summary: `Commande ${order.reference} terminée.`,
    details: {
      itemCount: getOrderItemCount(order.items),
      confirmedAt: order.confirmedAt,
    },
  });

  await synchronizeCustomersSafely();
  await synchronizeAdminNotificationsSafely();
  return order;
}
