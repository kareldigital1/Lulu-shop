import { Router } from "express";
import { authenticateAdmin } from "../../middlewares/authenticateAdmin";
import { validate } from "../../middlewares/validate";
import {
  deleteReadNotifications,
  getAdminNotifications,
  readAdminNotification,
  readAllAdminNotifications,
  unreadAdminNotification,
  unreadAllAdminNotifications,
} from "./admin-notification.controller";
import {
  listAdminNotificationsSchema,
  readAdminNotificationSchema,
} from "./admin-notification.validation";

export const adminNotificationRouter = Router();

adminNotificationRouter.use(authenticateAdmin);
adminNotificationRouter.get(
  "/",
  validate(listAdminNotificationsSchema),
  getAdminNotifications,
);
adminNotificationRouter.post("/read-all", readAllAdminNotifications);
adminNotificationRouter.post("/unread-all", unreadAllAdminNotifications);
adminNotificationRouter.delete("/read", deleteReadNotifications);
adminNotificationRouter.patch(
  "/:id/read",
  validate(readAdminNotificationSchema),
  readAdminNotification,
);
adminNotificationRouter.patch(
  "/:id/unread",
  validate(readAdminNotificationSchema),
  unreadAdminNotification,
);
