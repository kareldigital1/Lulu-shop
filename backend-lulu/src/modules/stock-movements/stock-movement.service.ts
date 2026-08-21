import type { ClientSession } from "mongoose";
import {
  DEFAULT_CLOTHING_SIZE,
  type ClothingSize,
} from "../products/product-size";
import {
  STOCK_MOVEMENT_REASONS,
  StockMovementModel,
  type StockMovementReason,
} from "./stock-movement.model";

let stockMovementSizeMigrationPromise: Promise<void> | null = null;

export async function ensureStockMovementSizeMigration() {
  if (!stockMovementSizeMigrationPromise) {
    stockMovementSizeMigrationPromise = StockMovementModel.updateMany(
      { size: { $exists: false } },
      { $set: { size: DEFAULT_CLOTHING_SIZE } },
    )
      .then(() => undefined)
      .catch((error) => {
        stockMovementSizeMigrationPromise = null;
        throw error;
      });
  }

  await stockMovementSizeMigrationPromise;
}

export type StockMovementInput = {
  productId: string;
  productName: string;
  productSlug: string;
  variantId: string;
  colorName: string;
  size?: ClothingSize;
  quantityBefore: number;
  quantityAfter: number;
  difference: number;
  reason: StockMovementReason;
  actor?: "admin" | "system";
  orderId?: string;
  orderReference?: string;
  note?: string;
};

type StockMovementListInput = {
  search?: unknown;
  reason?: unknown;
  dateFrom?: unknown;
  dateTo?: unknown;
  page?: unknown;
  pageSize?: unknown;
};

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
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

export async function recordStockMovements(
  movements: StockMovementInput[],
  session?: ClientSession,
) {
  if (movements.length === 0) {
    return [];
  }

  return StockMovementModel.create(
    movements.map((movement) => ({
      ...movement,
      size: movement.size ?? DEFAULT_CLOTHING_SIZE,
      actor: movement.actor ?? "admin",
      orderId: movement.orderId ?? "",
      orderReference: movement.orderReference ?? "",
      note: movement.note ?? "",
    })),
    session ? { session, ordered: true } : undefined,
  );
}

export async function listStockMovements(input: StockMovementListInput) {
  await ensureStockMovementSizeMigration();
  const search = readString(input.search);
  const requestedReason = readString(input.reason);
  const dateFrom = readString(input.dateFrom);
  const dateTo = readString(input.dateTo);
  const page = readPositiveInteger(input.page, 1, 100_000);
  const pageSize = readPositiveInteger(input.pageSize, 20, 100);
  const filter: Record<string, unknown> = {};

  if (
    requestedReason &&
    STOCK_MOVEMENT_REASONS.includes(
      requestedReason as StockMovementReason,
    )
  ) {
    filter.reason = requestedReason;
  }

  if (search) {
    const expression = new RegExp(escapeRegExp(search), "i");
    filter.$or = [
      { productName: expression },
      { productSlug: expression },
      { colorName: expression },
      { size: expression },
      { orderReference: expression },
    ];
  }

  if (dateFrom || dateTo) {
    const createdAt: Record<string, Date> = {};

    if (dateFrom) {
      createdAt.$gte = new Date(`${dateFrom}T00:00:00.000+01:00`);
    }

    if (dateTo) {
      createdAt.$lte = new Date(`${dateTo}T23:59:59.999+01:00`);
    }

    filter.createdAt = createdAt;
  }

  const [items, total] = await Promise.all([
    StockMovementModel.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    StockMovementModel.countDocuments(filter),
  ]);

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}
