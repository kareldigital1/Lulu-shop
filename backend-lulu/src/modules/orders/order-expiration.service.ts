import { env } from "../../config/env";
import { recordAuditEventSafely } from "../audit/audit-event.service";
import { synchronizeAdminNotificationsSafely } from "../admin-notifications/admin-notification.service";
import { synchronizeCustomersSafely } from "../customers/customer.service";
import { OrderModel } from "./order.model";

const HOUR_IN_MS = 60 * 60 * 1000;

export type OrderExpirationResult = {
  cutoff: Date;
  expiredCount: number;
};

export async function expirePendingOrders(
  now = new Date(),
): Promise<OrderExpirationResult> {
  const cutoff = new Date(
    now.getTime() - env.PENDING_ORDER_EXPIRATION_HOURS * HOUR_IN_MS,
  );
  const candidates = await OrderModel.find({
    status: "pending",
    createdAt: { $lte: cutoff },
  })
    .select("_id reference createdAt")
    .sort({ createdAt: 1 })
    .lean();
  let expiredCount = 0;

  for (const candidate of candidates) {
    const expiredOrder = await OrderModel.findOneAndUpdate(
      {
        _id: candidate._id,
        status: "pending",
        createdAt: { $lte: cutoff },
      },
      {
        $set: {
          status: "expired",
          expiredAt: now,
        },
      },
      { new: true },
    ).lean();

    if (!expiredOrder) {
      continue;
    }

    expiredCount += 1;
    await recordAuditEventSafely({
      action: "order.expired",
      actor: "system",
      resource: "order",
      resourceId: String(expiredOrder._id),
      resourceLabel: expiredOrder.reference,
      summary: `Commande ${expiredOrder.reference} expirée automatiquement.`,
      details: {
        previousStatus: "pending",
        status: "expired",
        createdAt: candidate.createdAt,
        expiredAt: now,
        expirationHours: env.PENDING_ORDER_EXPIRATION_HOURS,
        stockChanged: false,
      },
    });
  }

  if (expiredCount > 0) {
    await synchronizeCustomersSafely();
    await synchronizeAdminNotificationsSafely();
  }

  return { cutoff, expiredCount };
}
