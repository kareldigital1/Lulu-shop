import type { ClothingSize, Product } from "./product";

export type AdminLoginInput = {
  email: string;
  password: string;
};

export type AdminLoginResponse = {
  token: string;
  admin: {
    email: string;
    role: "admin";
  };
};

export type ProductMutationInput = Omit<
  Product,
  | "_id"
  | "reference"
  | "displayPriceLabel"
  | "currentPrice"
  | "isPromotionActive"
  | "discountPercentage"
  | "publishedAt"
  | "updatedAt"
  | "displayBadge"
  | "isNew"
  | "newBadgeExpiresAt"
  | "newBadgeDurationDays"
  | "confirmedOrderCount"
  | "confirmedQuantity"
  | "popularityRank"
  | "isPopular"
>;

export type ProductRestockInput = {
  items: Array<{
    variantId: string;
    size: ClothingSize;
    quantity: number;
  }>;
  note?: string;
};
