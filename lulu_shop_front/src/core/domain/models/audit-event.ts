export const AUDIT_ACTIONS = [
  "auth.login",
  "auth.logout",
  "backup.json_exported",
  "backup.mongodb_exported",
  "product.created",
  "product.updated",
  "product.deleted",
  "product.hidden",
  "product.shown",
  "product.price_changed",
  "product.promotion_changed",
  "product.stock_changed",
  "order.created",
  "order.updated",
  "order.confirmed",
  "order.document_generated",
  "order.document_downloaded",
  "order.cancelled",
  "order.completed",
  "order.expired",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];
export type AuditActor = "admin" | "customer" | "system";
export type AuditResource = "auth" | "backup" | "product" | "order";

export type AuditEvent = {
  _id: string;
  action: AuditAction;
  actor: AuditActor;
  resource: AuditResource;
  resourceLabel: string;
  summary: string;
  createdAt: string;
};

export type AuditEventFilters = {
  search?: string;
  action?: AuditAction | "";
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
};

export type AuditEventPage = {
  items: AuditEvent[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};
