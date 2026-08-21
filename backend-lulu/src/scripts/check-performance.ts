import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { listAdminNotifications } from "../modules/admin-notifications/admin-notification.service";
import { CustomerModel } from "../modules/customers/customer.model";
import { listCustomers } from "../modules/customers/customer.service";
import { OrderModel } from "../modules/orders/order.model";
import { listAdminOrders } from "../modules/orders/order.service";
import { ProductModel } from "../modules/products/product.model";

dotenv.config();
process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "silent";

type TimedResult = {
  label: string;
  medianMs: number;
  payloadBytes: number;
};

function median(values: number[]) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

async function measure<T>(
  label: string,
  action: () => Promise<T>,
): Promise<TimedResult> {
  await action();
  const durations: number[] = [];
  let result: T | null = null;

  for (let iteration = 0; iteration < 3; iteration += 1) {
    const startedAt = performance.now();
    result = await action();
    durations.push(performance.now() - startedAt);
  }

  return {
    label,
    medianMs: Number(median(durations).toFixed(1)),
    payloadBytes: Buffer.byteLength(JSON.stringify(result)),
  };
}

function assertIndex(indexNames: Set<string>, indexName: string) {
  assert.ok(indexNames.has(indexName), `Index MongoDB manquant : ${indexName}`);
}

async function main() {
  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    throw new Error("MONGO_URI est requis pour le contrôle de performance.");
  }

  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 15_000 });

  try {
    await Promise.all([
      CustomerModel.createIndexes(),
      OrderModel.createIndexes(),
      ProductModel.createIndexes(),
    ]);

    const [customerIndexes, orderIndexes, productIndexes] = await Promise.all([
      CustomerModel.collection.indexes(),
      OrderModel.collection.indexes(),
      ProductModel.collection.indexes(),
    ]);
    const customerIndexNames = new Set(
      customerIndexes.flatMap((index) => (index.name ? [index.name] : [])),
    );
    const orderIndexNames = new Set(
      orderIndexes.flatMap((index) => (index.name ? [index.name] : [])),
    );
    const productIndexNames = new Set(
      productIndexes.flatMap((index) => (index.name ? [index.name] : [])),
    );

    assertIndex(customerIndexNames, "customer_recent");
    assertIndex(orderIndexNames, "status_1_createdAt_1");
    assertIndex(orderIndexNames, "order_expired_state");
    assertIndex(productIndexNames, "product_low_stock_state");

    const [customerPlan, orderPlan, productPlan] = await Promise.all([
      CustomerModel.find()
        .sort({ lastOrderAt: -1, name: 1 })
        .limit(12)
        .explain("executionStats"),
      OrderModel.find({ status: "pending" })
        .sort({ createdAt: -1 })
        .limit(8)
        .explain("executionStats"),
      ProductModel.find({ status: "published", stock: { $lt: 4 } })
        .sort({ stock: 1, name: 1 })
        .explain("executionStats"),
    ]);

    assert.match(JSON.stringify(customerPlan), /customer_recent/);
    assert.match(JSON.stringify(orderPlan), /status_1_createdAt_1/);
    assert.match(JSON.stringify(productPlan), /product_low_stock_state/);

    const timings = await Promise.all([
      measure("clientes", () =>
        listCustomers({ page: 1, pageSize: 12, sort: "recent" }),
      ),
      measure("commandes", () =>
        listAdminOrders({ page: 1, pageSize: 8 }),
      ),
      measure("notifications", () =>
        listAdminNotifications({ limit: 30 }),
      ),
    ]);
    const counts = await Promise.all([
      ProductModel.estimatedDocumentCount(),
      OrderModel.estimatedDocumentCount(),
      CustomerModel.estimatedDocumentCount(),
    ]);

    console.log("Contrôle de performance réussi.");
    console.table(timings);
    console.table([
      { collection: "products", documents: counts[0] },
      { collection: "orders", documents: counts[1] },
      { collection: "customers", documents: counts[2] },
    ]);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error("Contrôle de performance échoué.");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
