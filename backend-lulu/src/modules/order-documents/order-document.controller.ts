import type { NextFunction, Request, Response } from "express";
import { logger } from "../../utils/logger";
import { recordAuditEventSafely } from "../audit/audit-event.service";
import {
  ensureOrderPurchaseOrder,
  streamOrderPurchaseOrder,
} from "./order-document.service";

export async function postOrderPurchaseOrder(
  request: Request,
  response: Response,
  next: NextFunction,
) {
  try {
    response.json(
      await ensureOrderPurchaseOrder(String(request.params.id)),
    );
  } catch (error) {
    next(error);
  }
}

export async function getOrderPurchaseOrder(
  request: Request,
  response: Response,
  next: NextFunction,
) {
  try {
    const result = await streamOrderPurchaseOrder(
      String(request.params.id),
      response,
    );
    await recordAuditEventSafely({
      action: "order.document_downloaded",
      actor: "admin",
      resource: "order",
      resourceId: result.orderId,
      resourceLabel: result.orderReference,
      summary: `Bon de commande ${result.purchaseOrderNumber} téléchargé.`,
      details: result,
    });
  } catch (error) {
    if (response.headersSent) {
      logger.error("Téléchargement du bon de commande interrompu.", {
        event: "order_document.download_failed",
        orderId: String(request.params.id),
        error,
      });
      response.destroy(error instanceof Error ? error : undefined);
      return;
    }

    next(error);
  }
}
