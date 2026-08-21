import { Schema, Types, model } from "mongoose";

export type CustomerRecord = {
  customerCode: string;
  name: string;
  phone: string;
  normalizedPhone: string;
  orderCount: number;
  completedOrderCount: number;
  totalSpent: number;
  lastOrderId: Types.ObjectId;
  lastOrderReference: string;
  lastOrderAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

const customerSchema = new Schema<CustomerRecord>(
  {
    customerCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 24,
    },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    phone: { type: String, required: true, trim: true, maxlength: 30 },
    normalizedPhone: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
      maxlength: 20,
    },
    orderCount: { type: Number, required: true, default: 0, min: 0 },
    completedOrderCount: { type: Number, required: true, default: 0, min: 0 },
    totalSpent: { type: Number, required: true, default: 0, min: 0 },
    lastOrderId: {
      type: Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
    lastOrderReference: {
      type: String,
      required: true,
      trim: true,
    },
    lastOrderAt: { type: Date, required: true, index: true },
    createdAt: { type: Date, required: true },
    updatedAt: { type: Date, required: true },
  },
  {
    versionKey: false,
  },
);

customerSchema.index({ name: 1 });
customerSchema.index(
  { customerCode: 1 },
  {
    name: "customer_code_unique",
    unique: true,
    partialFilterExpression: { customerCode: { $type: "string" } },
  },
);
customerSchema.index({ totalSpent: -1, lastOrderAt: -1 });
customerSchema.index({ orderCount: -1, lastOrderAt: -1 });
customerSchema.index(
  { lastOrderAt: -1, name: 1 },
  { name: "customer_recent" },
);

export const CustomerModel = model<CustomerRecord>("Customer", customerSchema);
