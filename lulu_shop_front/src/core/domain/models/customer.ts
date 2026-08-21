import type { Order } from "./order";

export type CustomerSort =
  | "recent"
  | "spent-desc"
  | "orders-desc"
  | "name-asc";

export type Customer = {
  _id: string;
  customerCode: string;
  name: string;
  phone: string;
  normalizedPhone: string;
  orderCount: number;
  completedOrderCount: number;
  totalSpent: number;
  lastOrderId: string;
  lastOrderReference: string;
  lastOrderAt: string;
  createdAt: string;
  updatedAt: string;
};

export type CustomerFilters = {
  search?: string;
  sort?: CustomerSort;
  page?: number;
  pageSize?: number;
};

export type CustomerPage = {
  items: Customer[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type CustomerDetails = {
  customer: Customer;
  orders: Order[];
};
