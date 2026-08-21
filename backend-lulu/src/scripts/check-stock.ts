import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import dotenv from "dotenv";

dotenv.config();
process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "silent";
process.env.GMAIL_APP_PASSWORD = "";
process.env.ORDER_NOTIFICATION_EMAIL = "";

const TEST_DATABASE_PREFIX = "tl_stock_check_";

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
    throw new Error("MONGO_URI est requis pour le contrôle du stock.");
  }

  const databaseName = createTestDatabaseName();
  assert.match(databaseName, /^tl_stock_check_\d{14}$/);

  const mongoose = (await import("mongoose")).default;
  const { AuditEventModel } = await import(
    "../modules/audit/audit-event.model"
  );
  const { getAdminDashboardStats } = await import(
    "../modules/dashboard/dashboard.service"
  );
  const { OrderModel } = await import("../modules/orders/order.model");
  const { expirePendingOrders } = await import(
    "../modules/orders/order-expiration.service"
  );
  const {
    cancelAdminOrder,
    confirmAdminOrder,
    createOrder,
  } = await import("../modules/orders/order.service");
  const { ProductModel } = await import("../modules/products/product.model");
  const { resolveLegacyCategory } = await import(
    "../modules/categories/category.service"
  );
  const {
    createProduct,
    deleteProduct,
    restockProduct,
    updateProduct,
  } = await import("../modules/products/product.service");
  const { StockMovementModel } = await import(
    "../modules/stock-movements/stock-movement.model"
  );
  const { listStockMovements } = await import(
    "../modules/stock-movements/stock-movement.service"
  );
  let connected = false;

  try {
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

    const created = await createProduct({
      slug: "audit-stock-robe",
      categoryId: String(robesCategory._id),
      category: "Robe",
      types: ["Robe de soirée"],
      name: "Robe Audit Stock",
      shortDescription: "Produit temporaire pour contrôler le stock.",
      description:
        "Produit temporaire utilisé pour contrôler tout le cycle du stock.",
      benefits: ["Contrôle automatisé"],
      priceLabel: "5 000 FCFA",
      priceAmount: 5_000,
      image: "https://example.com/robe-rouge.jpg",
      badge: "",
      whatsappMessage: "Audit du stock",
      featured: false,
      order: 1,
      variants: [
        {
          id: "red",
          colorName: "Rouge",
          colorHex: "#FF0000",
          images: ["https://example.com/robe-rouge.jpg"],
          sizes: [
            { size: "M", stock: 3 },
            { size: "L", stock: 2 },
          ],
          stock: 5,
        },
        {
          id: "blue",
          colorName: "Bleu",
          colorHex: "#0000FF",
          images: ["https://example.com/robe-bleue.jpg"],
          sizes: [{ size: "XL", stock: 2 }],
          stock: 2,
        },
      ],
      stock: 999,
      availability: "unavailable",
      status: "published",
      isActive: true,
    });

    assert.equal(created.stock, 7);
    assert.equal(created.availability, "available");
    assert.equal(
      await StockMovementModel.countDocuments({
        productId: String(created._id),
        reason: "product_created",
      }),
      3,
    );
    await StockMovementModel.collection.updateMany(
      { productId: String(created._id) },
      { $set: { createdAt: new Date("2026-07-28T12:00:00.000Z") } },
    );

    const updated = await updateProduct(String(created._id), {
      variants: [
        {
          id: "red",
          colorName: "Rouge",
          colorHex: "#FF0000",
          images: ["https://example.com/robe-rouge.jpg"],
          sizes: [
            { size: "M", stock: 2 },
            { size: "L", stock: 2 },
          ],
          stock: 4,
        },
        {
          id: "blue",
          colorName: "Bleu",
          colorHex: "#0000FF",
          images: ["https://example.com/robe-bleue.jpg"],
          sizes: [{ size: "XL", stock: 3 }],
          stock: 3,
        },
      ],
    });
    assert.equal(updated.stock, 7);
    assert.equal(getVariantStock(updated, "red"), 4);
    assert.equal(getVariantStock(updated, "blue"), 3);

    const restocked = await restockProduct(String(created._id), {
      items: [
        { variantId: "red", size: "M", quantity: 2 },
        { variantId: "blue", size: "XL", quantity: 1 },
      ],
      note: "Arrivage de contrôle.",
    });
    assert.equal(restocked.stock, 10);
    assert.equal(getVariantStock(restocked, "red"), 6);
    assert.equal(getVariantStock(restocked, "blue"), 4);

    const order = await createOrder({
      clientRequestId: randomUUID(),
      customerName: "Cliente Stock",
      customerPhone: "2290100000010",
      items: [{ slug: created.slug, variantId: "red", size: "M", quantity: 2 }],
    });
    assert.equal((await ProductModel.findById(created._id).lean())?.stock, 10);
    await confirmAdminOrder(String(order._id));
    const confirmedProduct = await ProductModel.findById(created._id).lean();
    assert.equal(confirmedProduct?.stock, 8);
    assert.equal(getSizeStock(confirmedProduct!, "red", "M"), 2);
    assert.equal(getSizeStock(confirmedProduct!, "red", "L"), 2);
    await assert.rejects(
      () =>
        updateProduct(String(created._id), {
          variants: [
            {
              id: "blue",
              colorName: "Bleu",
              colorHex: "#0000FF",
              images: ["https://example.com/robe-bleue.jpg"],
              stock: 4,
            },
          ],
        }),
      /commande confirmée/,
    );
    await assert.rejects(
      () => deleteProduct(String(created._id)),
      /commande confirmée/,
    );
    await cancelAdminOrder(String(order._id));
    const cancelledProduct = await ProductModel.findById(created._id).lean();
    assert.equal(cancelledProduct?.stock, 10);
    assert.equal(getSizeStock(cancelledProduct!, "red", "M"), 4);
    assert.equal(getSizeStock(cancelledProduct!, "red", "L"), 2);

    const expiringOrder = await createOrder({
      clientRequestId: randomUUID(),
      customerName: "Cliente Expiration Stock",
      customerPhone: "2290100000011",
      items: [{ slug: created.slug, variantId: "blue", size: "XL", quantity: 1 }],
    });
    const movementCountBeforeExpiration =
      await StockMovementModel.countDocuments();
    await OrderModel.collection.updateOne(
      { _id: expiringOrder._id },
      { $set: { createdAt: new Date("2026-07-20T12:00:00.000Z") } },
    );
    const expiration = await expirePendingOrders(
      new Date("2026-07-30T12:00:00.000Z"),
    );
    assert.equal(expiration.expiredCount, 1);
    assert.equal(
      await StockMovementModel.countDocuments(),
      movementCountBeforeExpiration,
    );
    assert.equal((await ProductModel.findById(created._id).lean())?.stock, 10);

    const movementCountBeforeInvalidRestock =
      await StockMovementModel.countDocuments();
    await assert.rejects(
      () =>
        restockProduct(String(created._id), {
          items: [
            { variantId: "red", size: "M", quantity: 1 },
            { variantId: "missing", size: "M", quantity: 1 },
          ],
        }),
      /n'existe plus/,
    );
    assert.equal((await ProductModel.findById(created._id).lean())?.stock, 10);
    assert.equal(
      await StockMovementModel.countDocuments(),
      movementCountBeforeInvalidRestock,
    );

    await StockMovementModel.collection.updateMany(
      {
        productId: String(created._id),
        createdAt: { $gt: new Date("2026-07-28T23:59:59.999Z") },
      },
      { $set: { createdAt: new Date("2026-07-29T12:00:00.000Z") } },
    );

    const restockHistory = await listStockMovements({
      reason: "restock",
      dateFrom: "2026-07-29",
      dateTo: "2026-07-29",
      page: 1,
      pageSize: 20,
    });
    assert.equal(restockHistory.total, 2);
    assert.ok(
      restockHistory.items.every((movement) => movement.reason === "restock"),
    );

    await deleteProduct(String(created._id));
    assert.equal(await ProductModel.countDocuments(), 0);

    const deletionMovements = await StockMovementModel.find({
      productId: String(created._id),
      reason: "product_deleted",
      note: "Stock retiré lors de la suppression du produit.",
    }).lean();
    assert.equal(deletionMovements.length, 3);
    assert.equal(
      deletionMovements.reduce(
        (total, movement) => total + movement.difference,
        0,
      ),
      -10,
    );
    await StockMovementModel.collection.updateMany(
      { _id: { $in: deletionMovements.map((movement) => movement._id) } },
      { $set: { createdAt: new Date("2026-07-30T12:00:00.000Z") } },
    );

    const movements = await StockMovementModel.find({
      productId: String(created._id),
    })
      .sort({ createdAt: 1, _id: 1 })
      .lean();
    const movementTotals = new Map<string, number>();

    for (const movement of movements) {
      assert.equal(
        movement.quantityAfter - movement.quantityBefore,
        movement.difference,
      );
      assert.equal(
        movement.quantityBefore,
        movementTotals.get(`${movement.variantId}::${movement.size}`) ?? 0,
      );
      movementTotals.set(
        `${movement.variantId}::${movement.size}`,
        movement.quantityAfter,
      );
    }

    assert.ok(Array.from(movementTotals.values()).every((stock) => stock === 0));
    assert.equal(
      movements.reduce((total, movement) => total + movement.difference, 0),
      0,
    );

    const dashboard = await getAdminDashboardStats(
      new Date("2026-07-30T18:00:00.000Z"),
    );
    const stockByDate = new Map(
      dashboard.stockEvolution.map((point) => [point.key, point.value]),
    );
    assert.equal(stockByDate.get("2026-07-28"), 7);
    assert.equal(stockByDate.get("2026-07-29"), 10);
    assert.equal(stockByDate.get("2026-07-30"), 0);
    assert.equal(dashboard.catalog.totalUnits, 0);

    const cappedProduct = await createProduct({
      slug: "audit-stock-plafond",
      categoryId: String(topsCategory._id),
      category: "Hauts",
      types: ["Blazer"],
      name: "Blazer Audit Plafond",
      shortDescription: "Produit temporaire pour contrôler le plafond.",
      description:
        "Produit temporaire utilisé pour contrôler le plafond du stock.",
      benefits: ["Contrôle automatisé"],
      priceLabel: "8 000 FCFA",
      priceAmount: 8_000,
      image: "https://example.com/blazer.jpg",
      badge: "",
      whatsappMessage: "Audit du plafond",
      featured: false,
      order: 2,
      variants: [
        {
          id: "black",
          colorName: "Noir",
          colorHex: "#000000",
          images: ["https://example.com/blazer.jpg"],
          stock: 999_999,
        },
      ],
      stock: 999_999,
      availability: "available",
      status: "published",
      isActive: true,
    });
    await assert.rejects(
      () =>
        restockProduct(String(cappedProduct._id), {
          items: [{ variantId: "black", quantity: 2 }],
        }),
      /limite maximale/,
    );
    assert.equal(
      (await ProductModel.findById(cappedProduct._id).lean())?.stock,
      999_999,
    );
    await deleteProduct(String(cappedProduct._id));

    const draftProduct = await createProduct({
      slug: "audit-stock-brouillon",
      categoryId: String(topsCategory._id),
      category: "Hauts",
      types: ["Chemise"],
      name: "Chemise Audit Brouillon",
      shortDescription: "Produit temporaire pour contrôler un brouillon.",
      description:
        "Produit temporaire utilisé pour contrôler un brouillon sans couleur.",
      benefits: ["Contrôle automatisé"],
      priceLabel: "4 000 FCFA",
      priceAmount: 4_000,
      image: "",
      badge: "",
      whatsappMessage: "Audit du brouillon",
      featured: false,
      order: 3,
      variants: [],
      stock: 9,
      availability: "available",
      status: "draft",
      isActive: false,
    });
    assert.equal(draftProduct.stock, 0);
    assert.equal(draftProduct.availability, "unavailable");
    assert.equal(
      await StockMovementModel.countDocuments({
        productId: String(draftProduct._id),
      }),
      0,
    );
    await deleteProduct(String(draftProduct._id));

    const variantDraft = await createProduct({
      slug: "audit-stock-retrait-variante",
      categoryId: String(topsCategory._id),
      category: "Hauts",
      types: ["Chemise"],
      name: "Chemise Audit Variante",
      shortDescription: "Produit temporaire avec une couleur en brouillon.",
      description:
        "Produit temporaire utilisé pour contrôler le retrait d'une couleur.",
      benefits: ["Contrôle automatisé"],
      priceLabel: "4 500 FCFA",
      priceAmount: 4_500,
      image: "https://example.com/chemise.jpg",
      badge: "",
      whatsappMessage: "Audit du retrait",
      featured: false,
      order: 4,
      variants: [
        {
          id: "white",
          colorName: "Blanc",
          colorHex: "#FFFFFF",
          images: ["https://example.com/chemise.jpg"],
          stock: 3,
        },
      ],
      stock: 3,
      availability: "available",
      status: "draft",
      isActive: false,
    });
    const emptiedDraft = await updateProduct(String(variantDraft._id), {
      variants: [],
      status: "draft",
    });
    assert.equal(emptiedDraft.stock, 0);
    assert.equal(emptiedDraft.availability, "unavailable");
    await deleteProduct(String(variantDraft._id));

    console.info(
      JSON.stringify(
        {
          database: databaseName,
          variantes: 2,
          mouvements: movements.length,
          stockApresCreation: 7,
          stockApresReapprovisionnement: 10,
          stockApresSuppression: 0,
          confirmation: "vérifiée",
          annulation: "vérifiée",
          expirationSansMouvement: "vérifiée",
          continuiteHistorique: "vérifiée",
          evolutionDashboard: "vérifiée",
        },
        null,
        2,
      ),
    );
    console.info("Contrôles du stock réussis.");
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
    console.error("Contrôles du stock échoués.");
    console.error(error instanceof Error ? error.stack : error);
    process.exitCode = 1;
  });
}
