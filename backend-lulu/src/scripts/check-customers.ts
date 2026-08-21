import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import dotenv from "dotenv";

dotenv.config();
process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "silent";
process.env.GMAIL_APP_PASSWORD = "";
process.env.ORDER_NOTIFICATION_EMAIL = "";

const TEST_DATABASE_PREFIX = "tl_customers_check_";

function createTestDatabaseName() {
  return `${TEST_DATABASE_PREFIX}${new Date()
    .toISOString()
    .replace(/\D/g, "")
    .slice(0, 14)}`;
}

async function main() {
  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    throw new Error("MONGO_URI est requis pour le contrôle des clientes.");
  }

  const databaseName = createTestDatabaseName();
  assert.match(databaseName, /^tl_customers_check_\d{14}$/);

  const mongoose = (await import("mongoose")).default;
  const { CustomerModel } = await import(
    "../modules/customers/customer.model"
  );
  const {
    buildCustomerCode,
    getCustomerDetails,
    listCustomers,
    normalizeCustomerPhone,
    synchronizeCustomers,
  } = await import("../modules/customers/customer.service");
  const { getAdminDashboardStats } = await import(
    "../modules/dashboard/dashboard.service"
  );
  const { OrderModel } = await import("../modules/orders/order.model");
  const {
    completeAdminOrder,
    confirmAdminOrder,
    createOrder,
    updateAdminOrder,
  } = await import("../modules/orders/order.service");
  const { resolveLegacyCategory } = await import(
    "../modules/categories/category.service"
  );
  const { ProductModel } = await import("../modules/products/product.model");
  let connected = false;

  try {
    assert.equal(
      normalizeCustomerPhone("+229 01 90 00 00 01"),
      "2290190000001",
    );
    assert.equal(
      normalizeCustomerPhone("01 90 00 00 01"),
      "2290190000001",
    );
    assert.equal(normalizeCustomerPhone("90 00 00 01"), "2290190000001");
    assert.match(
      buildCustomerCode("2290190000001"),
      /^TLS-C-[A-F0-9]{12}$/,
    );

    await mongoose.connect(mongoUri, {
      dbName: databaseName,
      serverSelectionTimeoutMS: 15_000,
    });
    connected = true;
    await Promise.all([
      CustomerModel.init(),
      OrderModel.init(),
      ProductModel.init(),
    ]);

    const productCategory = await resolveLegacyCategory("Robe");
    assert.ok(productCategory);

    await ProductModel.create({
      slug: "audit-clientes-robe",
      reference: "TLS-AUDIT-CLIENTES",
      categoryId: productCategory._id,
      category: productCategory.name,
      types: ["Robe de soirée"],
      name: "Robe Audit Clientes",
      shortDescription: "Produit temporaire pour le contrôle des clientes.",
      description: "Produit temporaire pour le contrôle des clientes.",
      benefits: [],
      priceLabel: "5 000 FCFA",
      priceAmount: 5_000,
      image: "",
      badge: "",
      whatsappMessage: "Audit clientes",
      featured: false,
      order: 1,
      variants: [
        {
          id: "red",
          colorName: "Rouge",
          colorHex: "#FF0000",
          images: [],
          stock: 20,
        },
      ],
      stock: 20,
      availability: "available",
      status: "published",
      isActive: true,
    });

    const firstOrder = await createOrder({
      clientRequestId: randomUUID(),
      customerName: "Afi Première",
      customerPhone: "01 90 00 00 01",
      items: [
        {
          slug: "audit-clientes-robe",
          variantId: "red",
          quantity: 1,
        },
      ],
    });
    const secondOrder = await createOrder({
      clientRequestId: randomUUID(),
      customerName: "Afi Dernière",
      customerPhone: "+229 01 90 00 00 01",
      items: [
        {
          slug: "audit-clientes-robe",
          variantId: "red",
          quantity: 2,
        },
      ],
    });

    const [concurrentOrderA, concurrentOrderB] = await Promise.all([
      createOrder({
        clientRequestId: randomUUID(),
        customerName: "Mariam",
        customerPhone: "01 95 00 00 02",
        items: [
          {
            slug: "audit-clientes-robe",
            variantId: "red",
            quantity: 1,
          },
        ],
      }),
      createOrder({
        clientRequestId: randomUUID(),
        customerName: "Mariam",
        customerPhone: "+2290195000002",
        items: [
          {
            slug: "audit-clientes-robe",
            variantId: "red",
            quantity: 1,
          },
        ],
      }),
    ]);

    await synchronizeCustomers();
    assert.equal(await CustomerModel.countDocuments(), 2);

    const afiBeforeCompletion = await CustomerModel.findOne({
      normalizedPhone: "2290190000001",
    }).lean();
    assert.ok(afiBeforeCompletion);
    assert.equal(
      afiBeforeCompletion.customerCode,
      buildCustomerCode("2290190000001"),
    );
    assert.equal(afiBeforeCompletion.orderCount, 2);
    assert.equal(afiBeforeCompletion.completedOrderCount, 0);
    assert.equal(afiBeforeCompletion.totalSpent, 0);

    const mariam = await CustomerModel.findOne({
      normalizedPhone: "2290195000002",
    }).lean();
    assert.ok(mariam);
    assert.equal(mariam.orderCount, 2);
    assert.notEqual(mariam.customerCode, afiBeforeCompletion.customerCode);

    const linkedOrders = await OrderModel.find({
      _id: {
        $in: [
          firstOrder._id,
          secondOrder._id,
          concurrentOrderA._id,
          concurrentOrderB._id,
        ],
      },
      customerId: { $ne: null },
    }).lean();
    assert.equal(linkedOrders.length, 4);

    await confirmAdminOrder(String(firstOrder._id));
    await completeAdminOrder(String(firstOrder._id));

    const afiCompleted = await CustomerModel.findOne({
      normalizedPhone: "2290190000001",
    }).lean();
    assert.ok(afiCompleted);
    assert.equal(afiCompleted.completedOrderCount, 1);
    assert.equal(afiCompleted.totalSpent, 5_000);

    await updateAdminOrder(String(secondOrder._id), {
      customerName: "Afi Nouveau numéro",
      customerPhone: "01 96 00 00 03",
    });

    assert.equal(await CustomerModel.countDocuments(), 3);
    const originalAfi = await CustomerModel.findOne({
      normalizedPhone: "2290190000001",
    }).lean();
    const movedAfi = await CustomerModel.findOne({
      normalizedPhone: "2290196000003",
    }).lean();
    assert.ok(originalAfi);
    assert.ok(movedAfi);
    assert.equal(originalAfi.orderCount, 1);
    assert.equal(originalAfi.totalSpent, 5_000);
    assert.equal(movedAfi.orderCount, 1);
    assert.equal(movedAfi.totalSpent, 0);

    const paginated = await listCustomers({
      sort: "orders-desc",
      page: 1,
      pageSize: 1,
    });
    assert.equal(paginated.total, 3);
    assert.equal(paginated.totalPages, 3);
    assert.equal(paginated.items.length, 1);
    assert.equal(paginated.items[0]?.name, "Mariam");

    const searchResult = await listCustomers({
      search: "Nouveau numéro",
      sort: "recent",
      page: 1,
      pageSize: 12,
    });
    assert.equal(searchResult.total, 1);
    assert.equal(searchResult.items[0]?._id.toString(), movedAfi._id.toString());

    const codeSearchResult = await listCustomers({
      search: originalAfi.customerCode,
      sort: "recent",
      page: 1,
      pageSize: 12,
    });
    assert.equal(codeSearchResult.total, 1);
    assert.equal(
      codeSearchResult.items[0]?._id.toString(),
      originalAfi._id.toString(),
    );

    const details = await getCustomerDetails(String(originalAfi._id));
    assert.equal(details.orders.length, 1);
    assert.equal(details.orders[0]?.reference, firstOrder.reference);
    assert.equal(details.orders[0]?.status, "completed");

    const dashboard = await getAdminDashboardStats();
    assert.equal(dashboard.customers.total, 3);
    assert.equal(dashboard.customers.newThisMonth, 3);
    assert.equal(dashboard.customers.averageSpent, 1_667);
    assert.equal(dashboard.customers.top[0]?.customerId, String(originalAfi._id));
    assert.equal(dashboard.customers.top[0]?.totalSpent, 5_000);

    console.log(
      JSON.stringify(
        {
          database: databaseName,
          clientes: await CustomerModel.countDocuments(),
          commandesLiees: await OrderModel.countDocuments({
            customerId: { $ne: null },
          }),
          normalisation: "vérifiée",
          concurrence: "vérifiée",
          totalDepense: originalAfi.totalSpent,
          changementTelephone: "vérifié",
          rechercheTriPagination: "vérifiés",
          historique: "vérifié",
          codesClients: "vérifiés",
          statistiquesDashboard: dashboard.customers,
        },
        null,
        2,
      ),
    );
    console.log("Contrôles des clientes réussis.");
  } finally {
    if (connected) {
      await mongoose.connection.db?.dropDatabase();
      await mongoose.disconnect();
    }
  }
}

main().catch((error) => {
  console.error("Contrôle des clientes impossible.");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
