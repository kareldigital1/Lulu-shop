import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import dotenv from "dotenv";

dotenv.config();
process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "silent";
process.env.GMAIL_APP_PASSWORD = "";
process.env.ORDER_NOTIFICATION_EMAIL = "";

const TEST_DATABASE_PREFIX = "tl_orders_check_";

function createTestDatabaseName() {
  return `${TEST_DATABASE_PREFIX}${new Date()
    .toISOString()
    .replace(/\D/g, "")
    .slice(0, 14)}`;
}

function getVariantStock(
  product: {
    variants: Array<{
      id: string;
      stock: number;
      sizes: Array<{ size: string; stock: number }>;
    }>;
  },
  variantId: string,
) {
  const variant = product.variants.find((entry) => entry.id === variantId);
  assert.ok(variant, `Variante ${variantId} introuvable.`);
  return variant.stock;
}

function getSizeStock(
  product: {
    variants: Array<{
      id: string;
      sizes: Array<{ size: string; stock: number }>;
    }>;
  },
  variantId: string,
  size: string,
) {
  const variant = product.variants.find((entry) => entry.id === variantId);
  assert.ok(variant, `Variante ${variantId} introuvable.`);
  const sizeStock = variant.sizes.find((entry) => entry.size === size);
  assert.ok(sizeStock, `Taille ${size} introuvable pour ${variantId}.`);
  return sizeStock.stock;
}

export async function main() {
  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    throw new Error("MONGO_URI est requis pour le contrôle des commandes.");
  }

  const databaseName = createTestDatabaseName();
  assert.match(databaseName, /^tl_orders_check_\d{14}$/);

  const mongoose = (await import("mongoose")).default;
  const { AuditEventModel } = await import(
    "../modules/audit/audit-event.model"
  );
  const { getAdminDashboardStats } = await import(
    "../modules/dashboard/dashboard.service"
  );
  const { resolveLegacyCategory } = await import(
    "../modules/categories/category.service"
  );
  const { OrderModel } = await import("../modules/orders/order.model");
  const { buildOrderReferenceDatePart } = await import(
    "../modules/orders/order-reference"
  );
  const { expirePendingOrders } = await import(
    "../modules/orders/order-expiration.service"
  );
  const {
    cancelAdminOrder,
    completeAdminOrder,
    confirmAdminOrder,
    createOrder,
    updateAdminOrder,
  } = await import("../modules/orders/order.service");
  const { ProductModel } = await import("../modules/products/product.model");
  const { StockMovementModel } = await import(
    "../modules/stock-movements/stock-movement.model"
  );
  let connected = false;

  try {
    assert.equal(
      buildOrderReferenceDatePart(new Date("2026-07-30T23:30:00.000Z")),
      "20260731",
    );
    assert.equal(
      buildOrderReferenceDatePart(new Date("2026-07-30T00:30:00.000Z")),
      "20260730",
    );

    await mongoose.connect(mongoUri, {
      dbName: databaseName,
      serverSelectionTimeoutMS: 15_000,
    });
    connected = true;
    await Promise.all([
      ProductModel.init(),
      OrderModel.init(),
      StockMovementModel.init(),
      AuditEventModel.init(),
    ]);
    const robesCategory = await resolveLegacyCategory("Robe");
    const topsCategory = await resolveLegacyCategory("Hauts");

    const mainProduct = await ProductModel.create({
      slug: "audit-robe",
      reference: "TLS-AUDIT-ROBE",
      categoryId: robesCategory._id,
      category: robesCategory.name,
      types: ["Robe de soirée"],
      name: "Robe Audit",
      shortDescription: "Produit temporaire pour le contrôle des commandes.",
      description: "Produit temporaire pour le contrôle des commandes.",
      benefits: [],
      priceLabel: "5 000 FCFA",
      priceAmount: 5_000,
      image: "",
      badge: "",
      whatsappMessage: "Audit",
      featured: false,
      order: 1,
      variants: [
        {
          id: "red",
          colorName: "Rouge",
           colorHex: "#FF0000",
           images: [],
           sizes: [
             { size: "M", stock: 12 },
             { size: "L", stock: 8 },
           ],
           stock: 20,
        },
        {
          id: "blue",
          colorName: "Bleu",
           colorHex: "#0000FF",
           images: [],
           sizes: [{ size: "XL", stock: 3 }],
           stock: 3,
        },
      ],
      stock: 23,
      availability: "available",
      status: "published",
      isActive: true,
    });
    const concurrentProduct = await ProductModel.create({
      slug: "audit-blazer",
      reference: "TLS-AUDIT-BLAZER",
      categoryId: topsCategory._id,
      category: topsCategory.name,
      types: ["Blazer"],
      name: "Blazer Audit",
      shortDescription: "Produit temporaire pour le contrôle concurrent.",
      description: "Produit temporaire pour le contrôle concurrent.",
      benefits: [],
      priceLabel: "7 000 FCFA",
      priceAmount: 7_000,
      image: "",
      badge: "",
      whatsappMessage: "Audit",
      featured: false,
      order: 2,
      variants: [
        {
          id: "yellow",
          colorName: "Jaune",
           colorHex: "#FFFF00",
           images: [],
           sizes: [{ size: "M", stock: 5 }],
           stock: 5,
        },
      ],
      stock: 5,
      availability: "available",
      status: "published",
      isActive: true,
    });

    const requestId = randomUUID();
    const order = await createOrder({
      clientRequestId: requestId,
      customerName: "Cliente Audit",
      customerPhone: "2290100000000",
      items: [{ slug: mainProduct.slug, variantId: "red", size: "M", quantity: 2 }],
    });
    const duplicateRequest = await createOrder({
      clientRequestId: requestId,
      customerName: "Cliente Audit",
      customerPhone: "2290100000000",
      items: [{ slug: mainProduct.slug, variantId: "red", size: "M", quantity: 2 }],
    });

    assert.equal(String(order._id), String(duplicateRequest._id));
    assert.equal(await OrderModel.countDocuments({ clientRequestId: requestId }), 1);
    assert.match(order.reference, /^TL-\d{8}-\d{6}$/);
    assert.equal(order.status, "pending");
    assert.equal(order.items[0].size, "M");
    assert.equal(order.items[0].unitPrice, 5_000);
    assert.equal(getVariantStock(await ProductModel.findById(mainProduct._id).lean() as typeof mainProduct, "red"), 20);

    const confirmed = await confirmAdminOrder(String(order._id));
    assert.equal(confirmed.status, "confirmed");
    assert.ok(confirmed.inventoryAppliedAt);
    assert.equal(getVariantStock(await ProductModel.findById(mainProduct._id).lean() as typeof mainProduct, "red"), 18);
    assert.equal(getSizeStock(await ProductModel.findById(mainProduct._id).lean() as typeof mainProduct, "red", "M"), 10);
    assert.equal(getSizeStock(await ProductModel.findById(mainProduct._id).lean() as typeof mainProduct, "red", "L"), 8);
    assert.equal(
      await StockMovementModel.countDocuments({
        orderId: String(order._id),
        reason: "order_confirmed",
      }),
      1,
    );

    await confirmAdminOrder(String(order._id));
    assert.equal(getVariantStock(await ProductModel.findById(mainProduct._id).lean() as typeof mainProduct, "red"), 18);
    assert.equal(
      await StockMovementModel.countDocuments({ orderId: String(order._id) }),
      1,
    );

    const completionResults = await Promise.all([
      completeAdminOrder(String(order._id)),
      completeAdminOrder(String(order._id)),
    ]);
    assert.ok(completionResults.every((entry) => entry.status === "completed"));
    await assert.rejects(
      () => cancelAdminOrder(String(order._id)),
      /terminée ne peut pas être annulée/,
    );

    const cancellable = await createOrder({
      clientRequestId: randomUUID(),
      customerName: "Cliente Annulation",
      customerPhone: "2290100000001",
      items: [{ slug: mainProduct.slug, variantId: "red", size: "M", quantity: 3 }],
    });
    await confirmAdminOrder(String(cancellable._id));
    assert.equal(getVariantStock(await ProductModel.findById(mainProduct._id).lean() as typeof mainProduct, "red"), 15);
    const cancelled = await cancelAdminOrder(String(cancellable._id));
    assert.equal(cancelled.status, "cancelled");
    assert.ok(cancelled.inventoryRestoredAt);
    await cancelAdminOrder(String(cancellable._id));
    assert.equal(getVariantStock(await ProductModel.findById(mainProduct._id).lean() as typeof mainProduct, "red"), 18);
    assert.equal(getSizeStock(await ProductModel.findById(mainProduct._id).lean() as typeof mainProduct, "red", "M"), 10);
    assert.equal(getSizeStock(await ProductModel.findById(mainProduct._id).lean() as typeof mainProduct, "red", "L"), 8);
    assert.equal(
      await StockMovementModel.countDocuments({
        orderId: String(cancellable._id),
      }),
      2,
    );

    const pendingCancellation = await createOrder({
      clientRequestId: randomUUID(),
      customerName: "Cliente Panier",
      customerPhone: "2290100000002",
      items: [{ slug: mainProduct.slug, variantId: "red", size: "M", quantity: 1 }],
    });
    await cancelAdminOrder(String(pendingCancellation._id));
    assert.equal(getVariantStock(await ProductModel.findById(mainProduct._id).lean() as typeof mainProduct, "red"), 18);
    assert.equal(
      await StockMovementModel.countDocuments({
        orderId: String(pendingCancellation._id),
      }),
      0,
    );

    const expiring = await createOrder({
      clientRequestId: randomUUID(),
      customerName: "Cliente Expiration",
      customerPhone: "2290100000003",
      items: [{ slug: mainProduct.slug, variantId: "red", size: "M", quantity: 1 }],
    });
    const expirationNow = new Date("2026-07-30T12:00:00.000Z");
    await OrderModel.collection.updateOne(
      { _id: expiring._id },
      {
        $set: {
          createdAt: new Date("2026-07-20T12:00:00.000Z"),
        },
      },
    );
    const expiration = await expirePendingOrders(expirationNow);
    assert.equal(expiration.expiredCount, 1);
    const expired = await OrderModel.findById(expiring._id).lean();
    assert.equal(expired?.status, "expired");
    assert.ok(expired?.expiredAt);
    await assert.rejects(
      () => confirmAdminOrder(String(expiring._id)),
      /ne peut plus être confirmée/,
    );
    await assert.rejects(
      () => cancelAdminOrder(String(expiring._id)),
      /expirée ne peut pas être annulée/,
    );

    const insufficient = await createOrder({
      clientRequestId: randomUUID(),
      customerName: "Cliente Stock",
      customerPhone: "2290100000004",
      items: [{ slug: mainProduct.slug, variantId: "blue", size: "XL", quantity: 3 }],
    });
    const productWithReducedStock = await ProductModel.findById(mainProduct._id);
    assert.ok(productWithReducedStock);
    const blueVariant = productWithReducedStock.variants.find(
      (variant) => variant.id === "blue",
    );
    assert.ok(blueVariant);
    const blueSize = blueVariant.sizes.find((entry) => entry.size === "XL");
    assert.ok(blueSize);
    blueSize.stock = 2;
    await productWithReducedStock.save();
    await assert.rejects(
      () => confirmAdminOrder(String(insufficient._id)),
      /Stock insuffisant/,
    );
    assert.equal(
      (await OrderModel.findById(insufficient._id).lean())?.status,
      "pending",
    );
    assert.equal(
      getVariantStock(
        await ProductModel.findById(mainProduct._id).lean() as typeof mainProduct,
        "blue",
      ),
      2,
    );
    await cancelAdminOrder(String(insufficient._id));

    const manualOrder = await createOrder({
      clientRequestId: randomUUID(),
      customerName: "Cliente Hors Catalogue",
      customerPhone: "2290100000005",
      items: [{ slug: mainProduct.slug, variantId: "red", size: "M", quantity: 1 }],
    });
    await updateAdminOrder(String(manualOrder._id), {
      note: "Article ajouté après échange WhatsApp.",
      items: [
        {
          lineId: "catalog-line",
          source: "catalog",
          productId: String(mainProduct._id),
          variantId: "red",
          size: "M",
          quantity: 1,
          unitPrice: 4_500,
        },
        {
          lineId: "manual-line",
          source: "manual",
          name: "Sac hors catalogue",
          category: "Accessoires",
          colorName: "Marron",
          colorHex: "#8B4513",
          size: "TU",
          priceLabel: "3 000 FCFA",
          unitPrice: 3_000,
          quantity: 2,
        },
      ],
    });
    await confirmAdminOrder(String(manualOrder._id));
    await completeAdminOrder(String(manualOrder._id));
    assert.equal(getVariantStock(await ProductModel.findById(mainProduct._id).lean() as typeof mainProduct, "red"), 17);

    const firstConcurrentOrder = await createOrder({
      clientRequestId: randomUUID(),
      customerName: "Cliente Concurrente A",
      customerPhone: "2290100000006",
      items: [
        {
          slug: concurrentProduct.slug,
          variantId: "yellow",
          size: "M",
          quantity: 4,
        },
      ],
    });
    const secondConcurrentOrder = await createOrder({
      clientRequestId: randomUUID(),
      customerName: "Cliente Concurrente B",
      customerPhone: "2290100000007",
      items: [
        {
          slug: concurrentProduct.slug,
          variantId: "yellow",
          size: "M",
          quantity: 4,
        },
      ],
    });
    const concurrentResults = await Promise.allSettled([
      confirmAdminOrder(String(firstConcurrentOrder._id)),
      confirmAdminOrder(String(secondConcurrentOrder._id)),
    ]);
    assert.equal(
      concurrentResults.filter((result) => result.status === "fulfilled").length,
      1,
    );
    assert.equal(
      concurrentResults.filter((result) => result.status === "rejected").length,
      1,
    );
    assert.equal(
      getVariantStock(
        await ProductModel.findById(concurrentProduct._id).lean() as typeof concurrentProduct,
        "yellow",
      ),
      1,
    );
    const concurrentOrders = await OrderModel.find({
      _id: {
        $in: [firstConcurrentOrder._id, secondConcurrentOrder._id],
      },
    }).lean();
    const confirmedConcurrentOrder = concurrentOrders.find(
      (entry) => entry.status === "confirmed",
    );
    const pendingConcurrentOrder = concurrentOrders.find(
      (entry) => entry.status === "pending",
    );
    assert.ok(confirmedConcurrentOrder);
    assert.ok(pendingConcurrentOrder);
    await cancelAdminOrder(String(confirmedConcurrentOrder._id));
    await cancelAdminOrder(String(pendingConcurrentOrder._id));
    assert.equal(
      getVariantStock(
        await ProductModel.findById(concurrentProduct._id).lean() as typeof concurrentProduct,
        "yellow",
      ),
      5,
    );

    const dashboard = await getAdminDashboardStats(
      new Date("2026-07-30T13:00:00.000Z"),
    );
    assert.equal(dashboard.revenue.total, 20_500);
    assert.equal(dashboard.revenue.completedOrders, 2);
    assert.equal(dashboard.revenue.soldItems, 5);
    assert.equal(dashboard.revenue.unpricedItems, 0);

    await assert.rejects(
      () =>
        createOrder({
          clientRequestId: randomUUID(),
          customerName: "Cliente Doublon",
          customerPhone: "2290100000008",
          items: [
            {
              slug: concurrentProduct.slug,
              variantId: "yellow",
              size: "M",
              quantity: 3,
            },
            {
              slug: concurrentProduct.slug,
              variantId: "yellow",
              size: "M",
              quantity: 3,
            },
          ],
        }),
      /Stock insuffisant/,
    );

    const references = await OrderModel.distinct("reference");
    assert.equal(references.length, await OrderModel.countDocuments());
    assert.equal(
      await AuditEventModel.countDocuments({
        action: "order.completed",
        resourceId: String(order._id),
      }),
      1,
    );

    console.info(
      JSON.stringify(
        {
          database: databaseName,
          referencesUniques: references.length,
          revenu: dashboard.revenue.total,
          commandesTerminees: dashboard.revenue.completedOrders,
          articlesVendus: dashboard.revenue.soldItems,
          concurrenceStock: "protégée",
          restaurationStock: "vérifiée",
          expiration: "vérifiée",
          articleHorsCatalogue: "vérifié",
        },
        null,
        2,
      ),
    );
    console.info("Contrôles des commandes réussis.");
  } finally {
    if (
      connected &&
      mongoose.connection.db?.databaseName === databaseName &&
      databaseName.startsWith(TEST_DATABASE_PREFIX)
    ) {
      await mongoose.connection.db.dropDatabase();
    }

    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error("Contrôles des commandes échoués.");
    console.error(error instanceof Error ? error.stack : error);
    process.exitCode = 1;
  });
}
