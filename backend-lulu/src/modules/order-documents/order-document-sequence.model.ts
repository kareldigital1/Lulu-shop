import { Schema, model } from "mongoose";

export type OrderDocumentSequenceRecord = {
  key: string;
  value: number;
  createdAt: Date;
  updatedAt: Date;
};

const orderDocumentSequenceSchema = new Schema<OrderDocumentSequenceRecord>(
  {
    key: { type: String, required: true, unique: true, trim: true },
    value: { type: Number, required: true, min: 1 },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

export const OrderDocumentSequenceModel = model<OrderDocumentSequenceRecord>(
  "OrderDocumentSequence",
  orderDocumentSequenceSchema,
);
