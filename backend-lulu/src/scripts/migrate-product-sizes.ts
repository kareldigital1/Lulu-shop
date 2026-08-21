import dotenv from "dotenv";
import mongoose from "mongoose";
import { connectToDatabase } from "../config/db";
import { ensureOrderSizeMigration } from "../modules/orders/order.service";
import { ensureProductDataMigrations } from "../modules/products/product.service";
import { DEFAULT_CLOTHING_SIZE } from "../modules/products/product-size";
import { StockMovementModel } from "../modules/stock-movements/stock-movement.model";
import { ensureStockMovementSizeMigration } from "../modules/stock-movements/stock-movement.service";

dotenv.config();

async function migrateProductSizes() {
  await connectToDatabase();
  await ensureProductDataMigrations();
  await ensureOrderSizeMigration();
  const stockMovementsBefore = await StockMovementModel.countDocuments({
    size: { $exists: false },
  });
  await ensureStockMovementSizeMigration();

  console.info(
    JSON.stringify(
      {
        products: "migrés",
        orders: "migrées",
        stockMovementsUpdated: stockMovementsBefore,
        defaultSize: DEFAULT_CLOTHING_SIZE,
      },
      null,
      2,
    ),
  );
}

migrateProductSizes()
  .catch((error) => {
    console.error("Migration des tailles impossible.");
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
