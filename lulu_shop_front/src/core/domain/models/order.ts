import type { ClothingSize } from "./product";

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "cancelled"
  | "completed"
  | "expired";
export type OrderItemSource = "catalog" | "manual";

export type OrderItem = {
  lineId: string;
  source: OrderItemSource;
  productId?: string | null;
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

export type PurchaseOrderDocument = {
  number: string;
  fileId: string;
  fileName: string;
  generatedAt: string;
};

export type OrderDocumentDownload = {
  blob: Blob;
  fileName: string;
};

export type Order = {
  _id: string;
  reference: string;
  clientRequestId: string;
  customerId?: string | null;
  customerName: string;
  customerPhone: string;
  note: string;
  items: OrderItem[];
  status: OrderStatus;
  expiredAt?: string | null;
  inventoryAppliedAt?: string | null;
  inventoryRestoredAt?: string | null;
  confirmedAt?: string | null;
  cancelledAt?: string | null;
  completedAt?: string | null;
  purchaseOrder?: PurchaseOrderDocument | null;
  createdAt: string;
  updatedAt: string;
};

export type OrderFilters = {
  search?: string;
  status?: OrderStatus;
  page?: number;
  pageSize?: number;
};

export type OrderPage = {
  items: Order[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type CreateOrderInput = {
  clientRequestId: string;
  customerName: string;
  customerPhone: string;
  note?: string;
  items: Array<{
    slug: string;
    variantId: string;
    size: ClothingSize;
    quantity: number;
  }>;
};

export type AdminCatalogOrderItemInput = {
  lineId: string;
  source: "catalog";
  productId: string;
  variantId: string;
  size: ClothingSize;
  quantity: number;
  unitPrice?: number | null;
};

export type AdminManualOrderItemInput = {
  lineId: string;
  source: "manual";
  name: string;
  category?: string;
  colorName?: string;
  colorHex?: string;
  size?: ClothingSize;
  image?: string;
  priceLabel?: string;
  unitPrice?: number | null;
  quantity: number;
};

export type AdminOrderUpdateInput = {
  customerName?: string;
  customerPhone?: string;
  note?: string;
  items?: Array<AdminCatalogOrderItemInput | AdminManualOrderItemInput>;
};
