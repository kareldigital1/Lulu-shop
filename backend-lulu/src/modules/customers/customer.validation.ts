import { z } from "zod";

const optionalSearch = z
  .union([z.string().max(120, "La recherche est trop longue."), z.undefined()])
  .transform((value) => value?.trim() ?? "");

export const listCustomersSchema = z.object({
  body: z.object({}).optional(),
  params: z.object({}).optional(),
  query: z.object({
    search: optionalSearch.optional(),
    sort: z
      .enum(["recent", "spent-desc", "orders-desc", "name-asc"])
      .optional(),
    page: z.coerce.number().int().min(1).optional(),
    pageSize: z.coerce.number().int().min(1).max(100).optional(),
  }),
});

export const getCustomerSchema = z.object({
  body: z.object({}).optional(),
  params: z.object({
    id: z.string().regex(/^[a-f\d]{24}$/i, "Identifiant cliente invalide."),
  }),
  query: z.object({}).optional(),
});
