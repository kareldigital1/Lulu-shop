import type { ClothingSize } from "./product";

export const STOCK_MOVEMENT_REASONS = [
  "product_created",
  "product_deleted",
  "order_confirmed",
  "order_cancelled",
  "manual_correction",
  "restock",
] as const;

export type StockMovementReason =
  (typeof STOCK_MOVEMENT_REASONS)[number];

export type StockMovement = {
  _id: string;
  productId: string;
  productName: string;
  productSlug: string;
  variantId: string;
  colorName: string;
  size: ClothingSize;
  quantityBefore: number;
  quantityAfter: number;
  difference: number;
  reason: StockMovementReason;
  actor: "admin" | "system";
  orderId: string;
  orderReference: string;
  note: string;
  createdAt: string;
};

export type StockMovementFilters = {
  search?: string;
  reason?: StockMovementReason | "";
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
};

export type StockMovementPage = {
  items: StockMovement[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};
