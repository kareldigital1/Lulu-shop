import { Schema, model } from "mongoose";

export type CategoryRecord = {
  name: string;
  slug: string;
  order: number;
  defaultTypes: string[];
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
};

const categorySchema = new Schema<CategoryRecord>(
  {
    name: { type: String, required: true, trim: true, unique: true },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
    },
    order: { type: Number, required: true, min: 0, default: 0 },
    defaultTypes: { type: [String], default: [] },
    isActive: { type: Boolean, required: true, default: true, index: true },
  },
  { timestamps: true },
);

categorySchema.index(
  { isActive: 1, order: 1, name: 1 },
  { name: "category_public_list" },
);

export const CategoryModel = model<CategoryRecord>("Category", categorySchema);
