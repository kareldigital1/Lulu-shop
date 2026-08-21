import { Schema, model } from "mongoose";

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

export type AuditEventRecord = {
  action: AuditAction;
  actor: AuditActor;
  resource: AuditResource;
  resourceId: string;
  resourceLabel: string;
  summary: string;
  details: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};

const auditEventSchema = new Schema<AuditEventRecord>(
  {
    action: {
      type: String,
      required: true,
      enum: AUDIT_ACTIONS,
      index: true,
    },
    actor: {
      type: String,
      required: true,
      enum: ["admin", "customer", "system"],
      index: true,
    },
    resource: {
      type: String,
      required: true,
      enum: ["auth", "backup", "product", "order"],
      index: true,
    },
    resourceId: { type: String, required: true, trim: true, index: true },
    resourceLabel: { type: String, required: true, trim: true },
    summary: { type: String, required: true, trim: true },
    details: { type: Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

auditEventSchema.index({ createdAt: -1 });
auditEventSchema.index({ action: 1, createdAt: -1 });
auditEventSchema.index({ resource: 1, resourceId: 1, createdAt: -1 });

export const AuditEventModel = model<AuditEventRecord>(
  "AuditEvent",
  auditEventSchema,
);
