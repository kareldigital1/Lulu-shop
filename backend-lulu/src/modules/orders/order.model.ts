import { Schema, Types, model } from "mongoose";
import {
  CLOTHING_SIZES,
  DEFAULT_CLOTHING_SIZE,
  type ClothingSize,
} from "../products/product-size";

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "cancelled"
  | "completed"
  | "expired";
export type OrderItemSource = "catalog" | "manual";

export type OrderItemRecord = {
  lineId: string;
  source: OrderItemSource;
  productId?: Types.ObjectId | null;
  productSlug?: string;
  variantId?: string;
  name: string;
  category: string;
  colorName: string;
  colorHex: string;
  size: ClothingSize;
  image: string;
  priceLabel: string;
  unitPrice?: number | null;
  quantity: number;
};

export type PurchaseOrderDocumentRecord = {
  number: string;
  fileId: Types.ObjectId;
  fileName: string;
  generatedAt: Date;
};

export type OrderRecord = {
  reference: string;
  clientRequestId: string;
  customerId?: Types.ObjectId | null;
  customerName: string;
  customerPhone: string;
  note: string;
  items: OrderItemRecord[];
  status: OrderStatus;
  expiredAt?: Date | null;
  inventoryAppliedAt?: Date | null;
  inventoryRestoredAt?: Date | null;
  confirmedAt?: Date | null;
  cancelledAt?: Date | null;
  completedAt?: Date | null;
  notificationEmailRequestedAt?: Date | null;
  notificationEmailSentAt?: Date | null;
  notificationEmailClaimedAt?: Date | null;
  purchaseOrder?: PurchaseOrderDocumentRecord | null;
  createdAt: Date;
  updatedAt: Date;
};

const orderItemSchema = new Schema<OrderItemRecord>(
  {
    lineId: { type: String, required: true, trim: true },
    source: {
      type: String,
      required: true,
      enum: ["catalog", "manual"],
      trim: true,
    },
    productId: { type: Schema.Types.ObjectId, ref: "Product", default: null },
    productSlug: { type: String, default: "", trim: true },
    variantId: { type: String, default: "", trim: true },
    name: { type: String, required: true, trim: true },
    category: { type: String, default: "", trim: true },
    colorName: { type: String, default: "", trim: true },
    colorHex: { type: String, default: "#D8C4A3", trim: true },
    size: {
      type: String,
      required: true,
      enum: CLOTHING_SIZES,
      default: DEFAULT_CLOTHING_SIZE,
      trim: true,
    },
    image: { type: String, default: "", trim: true },
    priceLabel: { type: String, default: "Prix à confirmer", trim: true },
    unitPrice: { type: Number, default: null, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
  },
  { _id: false },
);

const purchaseOrderDocumentSchema = new Schema<PurchaseOrderDocumentRecord>(
  {
    number: { type: String, required: true, trim: true },
    fileId: { type: Schema.Types.ObjectId, required: true },
    fileName: { type: String, required: true, trim: true },
    generatedAt: { type: Date, required: true },
  },
  { _id: false },
);

const orderSchema = new Schema<OrderRecord>(
  {
    reference: { type: String, required: true, unique: true, index: true, trim: true },
    clientRequestId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      default: null,
      index: true,
    },
    customerName: { type: String, required: true, trim: true },
    customerPhone: { type: String, required: true, trim: true },
    note: { type: String, default: "", trim: true },
    items: { type: [orderItemSchema], required: true },
    status: {
      type: String,
      required: true,
      enum: ["pending", "confirmed", "cancelled", "completed", "expired"],
      default: "pending",
      index: true,
    },
    expiredAt: { type: Date, default: null },
    inventoryAppliedAt: { type: Date, default: null },
    inventoryRestoredAt: { type: Date, default: null },
    confirmedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    notificationEmailRequestedAt: { type: Date, default: null },
    notificationEmailSentAt: { type: Date, default: null },
    notificationEmailClaimedAt: { type: Date, default: null },
    purchaseOrder: {
      type: purchaseOrderDocumentSchema,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

orderSchema.index({ createdAt: -1 });
orderSchema.index({ status: 1, createdAt: 1 });
orderSchema.index({ status: 1, expiredAt: 1 }, { name: "order_expired_state" });
orderSchema.index({ status: 1, "items.productId": 1 });
orderSchema.index({ customerId: 1, createdAt: -1 });
orderSchema.index(
  { "purchaseOrder.number": 1 },
  {
    name: "purchase_order_number_unique",
    unique: true,
    partialFilterExpression: { "purchaseOrder.number": { $type: "string" } },
  },
);

export const OrderModel = model<OrderRecord>("Order", orderSchema);
