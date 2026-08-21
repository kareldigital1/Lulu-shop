import { z } from "zod";
import { ADMIN_NOTIFICATION_TYPES } from "./admin-notification.model";
import { ADMIN_NOTIFICATION_FILTERS } from "./admin-notification.service";

const objectIdSchema = z
  .string()
  .regex(/^[a-f\d]{24}$/i, "Identifiant de notification invalide.");

export const listAdminNotificationsSchema = z.object({
  query: z.object({
    filter: z.enum(ADMIN_NOTIFICATION_FILTERS).optional(),
    type: z.enum(ADMIN_NOTIFICATION_TYPES).optional(),
    limit: z.coerce.number().int().min(1).max(200).optional(),
  }),
});

export const readAdminNotificationSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
});
