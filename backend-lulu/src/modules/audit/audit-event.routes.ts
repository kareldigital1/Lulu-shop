import { Router } from "express";
import { authenticateAdmin } from "../../middlewares/authenticateAdmin";
import { validate } from "../../middlewares/validate";
import { getAuditEvents } from "./audit-event.controller";
import { listAuditEventsSchema } from "./audit-event.validation";

const adminAuditEventRouter = Router();

adminAuditEventRouter.use(authenticateAdmin);
adminAuditEventRouter.get(
  "/",
  validate(listAuditEventsSchema),
  getAuditEvents,
);

export { adminAuditEventRouter };
