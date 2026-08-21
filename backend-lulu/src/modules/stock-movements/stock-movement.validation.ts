import { z } from "zod";
import { STOCK_MOVEMENT_REASONS } from "./stock-movement.model";

const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide.")
  .refine((value) => {
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));

    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    );
  }, "Date invalide.");

export const listStockMovementsSchema = z.object({
  body: z.object({}).optional(),
  params: z.object({}).optional(),
  query: z.object({
    search: z.string().trim().max(120).optional(),
    reason: z.enum(STOCK_MOVEMENT_REASONS).or(z.literal("")).optional(),
    dateFrom: isoDateSchema.or(z.literal("")).optional(),
    dateTo: isoDateSchema.or(z.literal("")).optional(),
    page: z.coerce.number().int().min(1).optional(),
    pageSize: z.coerce.number().int().min(1).max(100).optional(),
  }),
});
