import { Schema, Types, model } from "mongoose";
import {
  CLOTHING_SIZES,
  DEFAULT_CLOTHING_SIZE,
  type ClothingSize,
} from "./product-size";

export const PRODUCT_STATUSES = [
  "draft",
  "published",
  "hidden",
  "archived",
] as const;
export const MAX_VARIANT_STOCK = 1_000_000;
export const MAX_PRODUCT_STOCK = 30_000_000;

export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export function getAvailabilityFromStock(stock: number): "available" | "unavailable" {
  return stock > 0 ? "available" : "unavailable";
}

export type ProductSizeStockInput = {
  size: ClothingSize;
  stock: number;
};

export type ProductVariantInput = {
  id: string;
  colorName: string;
  colorHex: string;
  images: string[];
  sizes: ProductSizeStockInput[];
  stock: number;
};

export type ProductRecord = {
  slug: string;
  reference: string;
  categoryId: Types.ObjectId;
  category: string;
  types: string[];
  name: string;
  shortDescription: string;
  description: string;
  benefits: string[];
  priceLabel: string;
  priceAmount?: number | null;
  promotionPrice?: number | null;
  promotionStartAt?: Date | null;
  promotionEndAt?: Date | null;
  image: string;
  badge: string;
  whatsappMessage: string;
  featured: boolean;
  order: number;
  variants: ProductVariantInput[];
  stock: number;
  availability: "available" | "unavailable";
  status: ProductStatus;
  isActive: boolean;
  publishedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
  lowStockAlertSentAt?: Date | null;
};

export function getStockFromVariantSizes(
  sizes: ProductSizeStockInput[] | null | undefined,
  fallbackStock = 0,
) {
  if (!sizes || sizes.length === 0) {
    return fallbackStock;
  }

  return sizes.reduce((total, entry) => total + entry.stock, 0);
}

export function getStockFromVariants(variants: ProductVariantInput[], fallbackStock = 0) {
  if (variants.length === 0) {
    return fallbackStock;
  }

  return variants.reduce(
    (total, variant) =>
      total + getStockFromVariantSizes(variant.sizes, variant.stock),
    0,
  );
}

export function getPrimaryImageFromVariants(
  variants: ProductVariantInput[],
  fallbackImage = "",
) {
  return variants.flatMap((variant) => variant.images).find(Boolean) ?? fallbackImage;
}

export function buildProductReference(slug: string) {
  return `TLS-${slug.trim().toUpperCase()}`;
}

const productSizeStockSchema = new Schema<ProductSizeStockInput>(
  {
    size: {
      type: String,
      required: true,
      enum: CLOTHING_SIZES,
      default: DEFAULT_CLOTHING_SIZE,
      trim: true,
    },
    stock: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      max: MAX_VARIANT_STOCK,
    },
  },
  { _id: false },
);

const productVariantSchema = new Schema<ProductVariantInput>(
  {
    id: { type: String, required: true, trim: true },
    colorName: { type: String, required: true, trim: true },
    colorHex: { type: String, required: true, trim: true },
    images: { type: [String], default: [] },
    sizes: { type: [productSizeStockSchema], default: [] },
    stock: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      max: MAX_VARIANT_STOCK,
    },
  },
  { _id: false },
);

const productSchema = new Schema<ProductRecord>(
  {
    slug: { type: String, required: true, unique: true, trim: true },
    reference: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      trim: true,
      uppercase: true,
    },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      required: true,
      index: true,
    },
    category: { type: String, required: true, trim: true },
    types: { type: [String], default: [] },
    name: { type: String, required: true, trim: true },
    shortDescription: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    benefits: { type: [String], default: [] },
    priceLabel: { type: String, required: true, trim: true },
    priceAmount: { type: Number, default: null, min: 1 },
    promotionPrice: { type: Number, default: null, min: 1 },
    promotionStartAt: { type: Date, default: null },
    promotionEndAt: { type: Date, default: null },
    image: { type: String, default: "", trim: true },
    badge: { type: String, default: "", trim: true },
    whatsappMessage: { type: String, required: true, trim: true },
    featured: { type: Boolean, default: false },
    order: { type: Number, required: true, default: 0 },
    variants: { type: [productVariantSchema], default: [] },
    stock: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      max: MAX_PRODUCT_STOCK,
    },
    availability: {
      type: String,
      required: true,
      enum: ["available", "unavailable"],
      default: "unavailable",
      trim: true,
    },
    status: {
      type: String,
      required: true,
      enum: PRODUCT_STATUSES,
      default: "draft",
      index: true,
    },
    isActive: { type: Boolean, required: true, default: true },
    publishedAt: { type: Date, default: null, index: true },
    lowStockAlertSentAt: { type: Date, default: null, select: false },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_document, returnedObject) => {
        delete returnedObject.lowStockAlertSentAt;
        return returnedObject;
      },
    },
  },
);

productSchema.pre("validate", function syncProductReference(next) {
  if (!this.reference) {
    this.reference = buildProductReference(this.slug);
  }

  next();
});

productSchema.pre("save", function syncAvailabilityFromStock(next) {
  for (const variant of this.variants) {
    variant.stock = getStockFromVariantSizes(variant.sizes, variant.stock);
  }

  this.stock = getStockFromVariants(this.variants, 0);
  this.image = getPrimaryImageFromVariants(this.variants, this.image);
  this.availability = getAvailabilityFromStock(this.stock);
  this.isActive = this.status === "published";

  if (this.status === "published" && !this.publishedAt) {
    this.publishedAt = new Date();
  }

  next();
});

productSchema.index(
  { status: 1, order: 1, name: 1 },
  { name: "product_public_catalog" },
);
productSchema.index(
  { status: 1, categoryId: 1, order: 1 },
  { name: "product_public_category" },
);
productSchema.index(
  { order: 1, name: 1 },
  { name: "product_admin_catalog" },
);
productSchema.index(
  { isActive: 1, lowStockAlertSentAt: 1, stock: 1 },
  { name: "product_pending_low_stock_alerts" },
);
productSchema.index(
  { status: 1, stock: 1, name: 1 },
  { name: "product_low_stock_state" },
);

export const ProductModel = model<ProductRecord>("Product", productSchema);
