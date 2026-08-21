import { z } from "zod";
import { AUDIT_ACTIONS } from "./audit-event.model";

const optionalQueryString = z
  .union([z.string().max(120, "La recherche est trop longue."), z.undefined()])
  .transform((value) => value?.trim() ?? "");

export const listAuditEventsSchema = z.object({
  body: z.object({}).optional(),
  params: z.object({}).optional(),
  query: z.object({
    search: optionalQueryString.optional(),
    action: z.enum(AUDIT_ACTIONS).or(z.literal("")).optional(),
    dateFrom: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Date de début invalide.")
      .or(z.literal(""))
      .optional(),
    dateTo: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Date de fin invalide.")
      .or(z.literal(""))
      .optional(),
    page: z.coerce.number().int().min(1).optional(),
    pageSize: z.coerce.number().int().min(1).max(100).optional(),
  }),
});
