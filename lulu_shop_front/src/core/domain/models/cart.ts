import type { ClothingSize } from "./product";

export type CartItem = {
  lineId: string;
  slug: string;
  variantId: string;
  colorName: string;
  colorHex: string;
  size: ClothingSize;
  category: string;
  name: string;
  shortDescription: string;
  image: string;
  priceLabel: string;
  whatsappMessage: string;
  stock: number;
  quantity: number;
};
