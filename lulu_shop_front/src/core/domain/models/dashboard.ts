import type { OrderStatus } from "./order";

export type DashboardSalesPoint = {
  key: string;
  label: string;
  revenue: number;
  orders: number;
  quantity: number;
  unpricedQuantity: number;
};

export type DashboardStockPoint = {
  key: string;
  label: string;
  value: number;
};

export type DashboardRankedSale = {
  productId: string;
  name: string;
  reference: string;
  rank: number;
  revenue: number;
  orders: number;
  quantity: number;
};

export type DashboardCategorySale = {
  category: string;
  revenue: number;
  orders: number;
  quantity: number;
};

export type DashboardTopCustomer = {
  customerId: string;
  customerCode: string;
  name: string;
  phone: string;
  rank: number;
  totalSpent: number;
  totalOrders: number;
  completedOrders: number;
};

export type AdminDashboardStats = {
  generatedAt: string;
  timezone: string;
  revenue: {
    total: number;
    month: number;
    week: number;
    today: number;
    monthOrders: number;
    weekOrders: number;
    todayOrders: number;
    todayItems: number;
    completedOrders: number;
    soldItems: number;
    unpricedItems: number;
  };
  monthlySales: DashboardSalesPoint[];
  weeklySales: DashboardSalesPoint[];
  ordersByStatus: Record<OrderStatus, number>;
  stockEvolution: DashboardStockPoint[];
  topProducts: DashboardRankedSale[];
  categorySales: DashboardCategorySale[];
  stockValue: {
    amount: number;
    pricedUnits: number;
    unpricedUnits: number;
  };
  catalog: {
    totalProducts: number;
    publishedProducts: number;
    availableProducts: number;
    totalUnits: number;
  };
  customers: {
    total: number;
    newThisMonth: number;
    averageSpent: number;
    top: DashboardTopCustomer[];
  };
};
