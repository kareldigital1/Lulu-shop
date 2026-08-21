import { Router } from "express";
import { authenticateAdmin } from "../../middlewares/authenticateAdmin";
import {
  adminDocumentRateLimiter,
  publicWriteRateLimiter,
} from "../../middlewares/rateLimiters";
import { validate } from "../../middlewares/validate";
import {
  getOrderPurchaseOrder,
  postOrderPurchaseOrder,
} from "../order-documents/order-document.controller";
import {
  getAdminOrders,
  patchAdminOrder,
  postCancelAdminOrder,
  postCompleteAdminOrder,
  postConfirmAdminOrder,
  postOrder,
} from "./order.controller";
import {
  adminOrderActionSchema,
  createOrderSchema,
  listAdminOrdersSchema,
  updateAdminOrderSchema,
} from "./order.validation";

const orderRouter = Router();
const adminOrderRouter = Router();

orderRouter.post(
  "/",
  publicWriteRateLimiter,
  validate(createOrderSchema),
  postOrder,
);

adminOrderRouter.use(authenticateAdmin);
adminOrderRouter.get("/", validate(listAdminOrdersSchema), getAdminOrders);
adminOrderRouter.patch("/:id", validate(updateAdminOrderSchema), patchAdminOrder);
adminOrderRouter.post(
  "/:id/confirm",
  validate(adminOrderActionSchema),
  postConfirmAdminOrder,
);
adminOrderRouter.post(
  "/:id/cancel",
  validate(adminOrderActionSchema),
  postCancelAdminOrder,
);
adminOrderRouter.post(
  "/:id/complete",
  validate(adminOrderActionSchema),
  postCompleteAdminOrder,
);
adminOrderRouter.post(
  "/:id/purchase-order",
  adminDocumentRateLimiter,
  validate(adminOrderActionSchema),
  postOrderPurchaseOrder,
);
adminOrderRouter.get(
  "/:id/purchase-order",
  adminDocumentRateLimiter,
  validate(adminOrderActionSchema),
  getOrderPurchaseOrder,
);

export { adminOrderRouter, orderRouter };
