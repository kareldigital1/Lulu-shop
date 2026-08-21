import assert from "node:assert/strict";
import dotenv from "dotenv";

dotenv.config();
process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "silent";
process.env.GMAIL_APP_PASSWORD = "";
process.env.ORDER_NOTIFICATION_EMAIL = "";

const TEST_DATABASE_PREFIX = "tl_notifications_check_";

function createTestDatabaseName() {
  return `${TEST_DATABASE_PREFIX}${new Date()
    .toISOString()
    .replace(/\D/g, "")
    .slice(0, 14)}`;
}

async function main() {
  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    throw new Error("MONGO_URI est requis pour le contrôle des notifications.");
  }

  const databaseName = createTestDatabaseName();
  assert.match(databaseName, /^tl_notifications_check_\d{14}$/);

  const mongoose = (await import("mongoose")).default;
  const { CategoryModel } = await import("../modules/categories/category.model");
  const { CustomerModel } = await import("../modules/customers/customer.model");
  const { synchronizeCustomers } = await import(
    "../modules/customers/customer.service"
  );
  const { AdminNotificationModel } = await import(
    "../modules/admin-notifications/admin-notification.model"
  );
  const {
    cleanupOldAdminNotifications,
    deleteReadAdminNotifications,
    listAdminNotifications,
    markAdminNotificationRead,
    markAdminNotificationUnread,
    markAllAdminNotificationsRead,
    markAllAdminNotificationsUnread,
    synchronizeAdminNotifications,
  } = await import(
    "../modules/admin-notifications/admin-notification.service"
  );
  const { OrderModel } = await import("../modules/orders/order.model");
  const { ProductModel } = await import("../modules/products/product.model");
  let connected = false;

  try {
    await mongoose.connect(mongoUri, {
      dbName: databaseName,
      serverSelectionTimeoutMS: 15_000,
    });
    connected = true;
    await Promise.all([
      AdminNotificationModel.init(),
      CategoryModel.init(),
      CustomerModel.init(),
      OrderModel.init(),
      ProductModel.init(),
    ]);

    const category = await CategoryModel.create({
      name: "Hauts",
      slug: "hauts",
      order: 1,
      defaultTypes: ["Audit"],
      isActive: true,
    });
    await ProductModel.create({
      slug: "audit-notification-stock",
      reference: "TLS-AUDIT-NOTIFICATION-STOCK",
      categoryId: category._id,
      category: category.name,
      types: ["Audit"],
      name: "Produit Notification",
      shortDescription: "Produit temporaire.",
      description: "Produit temporaire pour tester les notifications.",
      benefits: [],
      priceLabel: "2 500 FCFA",
      priceAmount: 2_500,
      image: "",
      badge: "",
      whatsappMessage: "Audit notification",
      featured: false,
      order: 1,
      variants: [
        {
          id: "rouge",
          colorName: "Rouge",
          colorHex: "#FF0000",
          images: [],
          stock: 2,
        },
        {
          id: "bleu",
          colorName: "Bleu",
          colorHex: "#0000FF",
          images: [],
          stock: 0,
        },
      ],
      stock: 2,
      availability: "available",
      status: "published",
      isActive: true,
    });

    const makeOrder = (
      index: number,
      status: "pending" | "confirmed" | "cancelled" | "completed" | "expired",
      customerName: string,
      customerPhone: string,
    ) => {
      const date = new Date(Date.UTC(2026, 6, 1, 8, index));
      return {
        reference: `TL-20260731-N${String(index).padStart(5, "0")}`,
        clientRequestId: `f9096a39-a8f7-41d4-9944-${String(index).padStart(12, "0")}`,
        customerName,
        customerPhone,
        note: "",
        items: [
          {
            lineId: `manual-audit-${index}`,
            source: "manual" as const,
            productId: null,
            productSlug: "",
            variantId: "",
            name: "Article Audit",
            category: "Audit",
            colorName: "Rouge",
            colorHex: "#FF0000",
            image: "",
            priceLabel: "2 500 FCFA",
            unitPrice: 2_500,
            quantity: 1,
          },
        ],
        status,
        createdAt: date,
        updatedAt: date,
        ...(status === "confirmed" ? { confirmedAt: date } : {}),
        ...(status === "cancelled" ? { cancelledAt: date } : {}),
        ...(status === "completed" ? { completedAt: date } : {}),
        ...(status === "expired" ? { expiredAt: date } : {}),
      };
    };

    await OrderModel.create([
      makeOrder(1, "pending", "Cliente En Attente", "01 90 00 00 01"),
      makeOrder(2, "confirmed", "Cliente Confirmée", "01 90 00 00 02"),
      makeOrder(3, "cancelled", "Cliente Annulée", "01 90 00 00 03"),
      makeOrder(4, "expired", "Cliente Expirée", "01 90 00 00 04"),
      ...Array.from({ length: 10 }, (_, offset) =>
        makeOrder(
          5 + offset,
          "completed",
          "Cliente Fidèle",
          "01 90 00 00 10",
        ),
      ),
    ]);

    await synchronizeCustomers();
    await synchronizeAdminNotifications();
    let result = await listAdminNotifications({});

    assert.equal(result.summary.totalCount, 22);
    assert.equal(result.summary.unreadCount, 22);
    assert.equal(result.summary.byType.order_pending.active, 1);
    assert.equal(result.summary.byType.order_confirmed.active, 1);
    assert.equal(result.summary.byType.order_cancelled.active, 1);
    assert.equal(result.summary.byType.order_completed.active, 10);
    assert.equal(result.summary.byType.order_expired.active, 1);
    assert.equal(result.summary.byType.low_stock.active, 1);
    assert.equal(result.summary.byType.out_of_stock.active, 1);
    assert.equal(result.summary.byType.new_customer.active, 6);
    assert.equal(result.summary.dashboard.pendingOrders, 1);
    assert.equal(result.summary.dashboard.lowStockProducts, 1);
    assert.equal(result.summary.dashboard.expiredOrders, 1);
    assert.equal(result.summary.dashboard.newCustomers, 5);

    assert.equal((await listAdminNotifications({ filter: "orders" })).items.length, 14);
    assert.equal((await listAdminNotifications({ filter: "stock" })).items.length, 2);
    assert.equal((await listAdminNotifications({ filter: "customers" })).items.length, 6);
    assert.equal((await listAdminNotifications({ filter: "unread" })).items.length, 22);
    assert.equal((await listAdminNotifications({ filter: "read" })).items.length, 0);

    const pendingNotification = result.items.find(
      (item) => item.type === "order_pending",
    );
    assert.ok(pendingNotification);
    await markAdminNotificationRead(String(pendingNotification._id));
    result = await listAdminNotifications({});
    assert.equal(result.summary.unreadCount, 21);
    await markAdminNotificationUnread(String(pendingNotification._id));
    result = await listAdminNotifications({});
    assert.equal(result.summary.unreadCount, 22);

    const readAllResult = await markAllAdminNotificationsRead();
    assert.equal(readAllResult.updatedCount, 22);
    result = await listAdminNotifications({});
    assert.equal(result.summary.readCount, 22);
    const unreadAllResult = await markAllAdminNotificationsUnread();
    assert.equal(unreadAllResult.updatedCount, 22);

    await markAdminNotificationRead(String(pendingNotification._id));
    const deleteResult = await deleteReadAdminNotifications();
    assert.equal(deleteResult.deletedCount, 1);
    await synchronizeAdminNotifications();
    result = await listAdminNotifications({});
    assert.equal(result.summary.totalCount, 21);

    await AdminNotificationModel.collection.insertOne({
      type: "system_error",
      severity: "critical",
      source: "system",
      sourceId: "legacy-error",
      dedupeKey: "system_error:legacy-error",
      title: "Ancienne erreur API",
      message: "Cette erreur ne doit plus apparaître.",
      details: {},
      occurredAt: new Date(),
      readAt: null,
      resolvedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await synchronizeAdminNotifications();
    assert.equal(
      await AdminNotificationModel.collection.countDocuments({
        type: "system_error",
      }),
      0,
    );

    const now = new Date();
    const oldDate = new Date(now.getTime() - 100 * 24 * 60 * 60 * 1_000);
    await AdminNotificationModel.create([
      {
        type: "system",
        severity: "info",
        resourceType: "system",
        resourceId: "old-resolved",
        dedupeKey: "system:old-resolved",
        title: "Information résolue",
        message: "Ancienne information lue et résolue.",
        details: {},
        isRead: true,
        readAt: oldDate,
        resolvedAt: oldDate,
        createdAt: oldDate,
      },
      {
        type: "system",
        severity: "warning",
        resourceType: "system",
        resourceId: "important-active",
        dedupeKey: "system:important-active",
        title: "Information importante",
        message: "Cette information active doit être conservée.",
        details: {},
        isRead: true,
        readAt: oldDate,
        resolvedAt: null,
        createdAt: oldDate,
      },
    ]);
    const cleanupResult = await cleanupOldAdminNotifications(now);
    assert.equal(cleanupResult.deletedCount, 1);
    assert.equal(
      await AdminNotificationModel.countDocuments({
        dedupeKey: "system:important-active",
      }),
      1,
    );

    console.log(
      JSON.stringify(
        {
          database: databaseName,
          types: 9,
          notificationsMétier: 22,
          lectureIndividuelle: "vérifiée",
          lectureGlobale: "vérifiée",
          nonLecture: "vérifiée",
          filtres: 7,
          suppressionLogique: "vérifiée",
          erreursApiExclues: "vérifié",
          rétention: `${cleanupResult.retentionDays} jours`,
        },
        null,
        2,
      ),
    );
    console.log("Contrôles des notifications réussis.");
  } finally {
    if (connected) {
      await mongoose.connection.db?.dropDatabase();
      await mongoose.disconnect();
    }
  }
}

main().catch((error) => {
  console.error("Contrôle des notifications impossible.");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
