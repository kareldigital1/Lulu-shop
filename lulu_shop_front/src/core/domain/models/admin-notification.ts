export type AdminNotificationType =
  | "order_pending"
  | "order_confirmed"
  | "order_cancelled"
  | "order_completed"
  | "order_expired"
  | "low_stock"
  | "out_of_stock"
  | "new_customer"
  | "system";

export type AdminNotificationSeverity =
  | "info"
  | "success"
  | "warning"
  | "critical";
export type AdminNotificationResourceType =
  | "order"
  | "product"
  | "customer"
  | "system";
export type AdminNotificationFilter =
  | "all"
  | "unread"
  | "read"
  | "orders"
  | "stock"
  | "customers"
  | "system";

export type AdminNotification = {
  _id: string;
  type: AdminNotificationType;
  severity: AdminNotificationSeverity;
  resourceType: AdminNotificationResourceType | null;
  resourceId: string | null;
  title: string;
  message: string;
  details: Record<string, unknown>;
  isRead: boolean;
  readAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminNotificationTypeSummary = {
  total: number;
  active: number;
  unread: number;
};

export type AdminNotificationDashboardSummary = {
  pendingOrders: number;
  lowStockProducts: number;
  expiredOrders: number;
  newCustomers: number;
};

export type AdminNotificationSummary = {
  totalCount: number;
  activeCount: number;
  unreadCount: number;
  readCount: number;
  byType: Record<AdminNotificationType, AdminNotificationTypeSummary>;
  dashboard: AdminNotificationDashboardSummary;
};

export type AdminNotificationCenter = {
  items: AdminNotification[];
  summary: AdminNotificationSummary;
};

const EMPTY_TYPE_SUMMARY: AdminNotificationTypeSummary = {
  total: 0,
  active: 0,
  unread: 0,
};

export const EMPTY_ADMIN_NOTIFICATION_CENTER: AdminNotificationCenter = {
  items: [],
  summary: {
    totalCount: 0,
    activeCount: 0,
    unreadCount: 0,
    readCount: 0,
    byType: {
      order_pending: { ...EMPTY_TYPE_SUMMARY },
      order_confirmed: { ...EMPTY_TYPE_SUMMARY },
      order_cancelled: { ...EMPTY_TYPE_SUMMARY },
      order_completed: { ...EMPTY_TYPE_SUMMARY },
      order_expired: { ...EMPTY_TYPE_SUMMARY },
      low_stock: { ...EMPTY_TYPE_SUMMARY },
      out_of_stock: { ...EMPTY_TYPE_SUMMARY },
      new_customer: { ...EMPTY_TYPE_SUMMARY },
      system: { ...EMPTY_TYPE_SUMMARY },
    },
    dashboard: {
      pendingOrders: 0,
      lowStockProducts: 0,
      expiredOrders: 0,
      newCustomers: 0,
    },
  },
};
