import { Schema, model } from "mongoose";
import {
  CLOTHING_SIZES,
  DEFAULT_CLOTHING_SIZE,
  type ClothingSize,
} from "../products/product-size";

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

export type StockMovementRecord = {
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
  createdAt: Date;
};

const stockMovementSchema = new Schema<StockMovementRecord>(
  {
    productId: { type: String, required: true, trim: true, index: true },
    productName: { type: String, required: true, trim: true },
    productSlug: { type: String, required: true, trim: true },
    variantId: { type: String, required: true, trim: true },
    colorName: { type: String, required: true, trim: true },
    size: {
      type: String,
      required: true,
      enum: CLOTHING_SIZES,
      default: DEFAULT_CLOTHING_SIZE,
      trim: true,
    },
    quantityBefore: { type: Number, required: true, min: 0 },
    quantityAfter: { type: Number, required: true, min: 0 },
    difference: { type: Number, required: true },
    reason: {
      type: String,
      required: true,
      enum: STOCK_MOVEMENT_REASONS,
      index: true,
    },
    actor: {
      type: String,
      required: true,
      enum: ["admin", "system"],
      default: "admin",
    },
    orderId: { type: String, default: "", trim: true },
    orderReference: { type: String, default: "", trim: true },
    note: { type: String, default: "", trim: true },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  },
);

stockMovementSchema.index({ createdAt: -1 });
stockMovementSchema.index({ reason: 1, createdAt: -1 });
stockMovementSchema.index({ productId: 1, variantId: 1, size: 1, createdAt: -1 });

export const StockMovementModel = model<StockMovementRecord>(
  "StockMovement",
  stockMovementSchema,
);
