import { Schema, model } from "mongoose";

export const ADMIN_NOTIFICATION_TYPES = [
  "order_pending",
  "order_confirmed",
  "order_cancelled",
  "order_completed",
  "order_expired",
  "low_stock",
  "out_of_stock",
  "new_customer",
  "system",
] as const;

export const ADMIN_NOTIFICATION_SEVERITIES = [
  "info",
  "success",
  "warning",
  "critical",
] as const;

export const ADMIN_NOTIFICATION_RESOURCE_TYPES = [
  "order",
  "product",
  "customer",
  "system",
] as const;

export type AdminNotificationType =
  (typeof ADMIN_NOTIFICATION_TYPES)[number];
export type AdminNotificationSeverity =
  (typeof ADMIN_NOTIFICATION_SEVERITIES)[number];
export type AdminNotificationResourceType =
  (typeof ADMIN_NOTIFICATION_RESOURCE_TYPES)[number];

export type AdminNotificationRecord = {
  type: AdminNotificationType;
  severity: AdminNotificationSeverity;
  resourceType?: AdminNotificationResourceType | null;
  resourceId?: string | null;
  dedupeKey: string;
  title: string;
  message: string;
  details: Record<string, unknown>;
  isRead: boolean;
  readAt?: Date | null;
  resolvedAt?: Date | null;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const adminNotificationSchema = new Schema<AdminNotificationRecord>(
  {
    type: {
      type: String,
      required: true,
      enum: ADMIN_NOTIFICATION_TYPES,
      index: true,
    },
    severity: {
      type: String,
      required: true,
      enum: ADMIN_NOTIFICATION_SEVERITIES,
      index: true,
    },
    resourceType: {
      type: String,
      enum: ADMIN_NOTIFICATION_RESOURCE_TYPES,
      default: null,
      index: true,
    },
    resourceId: { type: String, default: null, trim: true, index: true },
    dedupeKey: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 180 },
    message: { type: String, required: true, trim: true, maxlength: 500 },
    details: { type: Schema.Types.Mixed, default: {} },
    isRead: { type: Boolean, required: true, default: false, index: true },
    readAt: { type: Date, default: null, index: true },
    resolvedAt: { type: Date, default: null, index: true },
    deletedAt: { type: Date, default: null, index: true },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

adminNotificationSchema.index({
  deletedAt: 1,
  isRead: 1,
  createdAt: -1,
});
adminNotificationSchema.index({
  type: 1,
  deletedAt: 1,
  resolvedAt: 1,
  createdAt: -1,
});
adminNotificationSchema.index({
  resourceType: 1,
  resourceId: 1,
  createdAt: -1,
});

export const AdminNotificationModel = model<AdminNotificationRecord>(
  "AdminNotification",
  adminNotificationSchema,
);
