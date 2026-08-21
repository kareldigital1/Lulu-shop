import { z } from "zod";
import {
  CLOTHING_SIZES,
  DEFAULT_CLOTHING_SIZE,
} from "../products/product-size";

const colorHexSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Code couleur hexadécimal invalide.");

const objectIdSchema = z
  .string()
  .regex(/^[a-f\d]{24}$/i, "L'identifiant de commande est invalide.");

const publicOrderItemSchema = z.object({
  slug: z.string().trim().min(2).max(120),
  variantId: z.string().trim().min(1).max(120),
  size: z.enum(CLOTHING_SIZES).default(DEFAULT_CLOTHING_SIZE),
  quantity: z.number().int().min(1).max(50),
});

const adminCatalogOrderItemSchema = z.object({
  lineId: z.string().trim().min(1).max(120),
  source: z.literal("catalog"),
  productId: z
    .string()
    .regex(/^[a-f\d]{24}$/i, "La référence produit est invalide."),
  variantId: z.string().trim().min(1).max(120),
  size: z.enum(CLOTHING_SIZES).default(DEFAULT_CLOTHING_SIZE),
  quantity: z.number().int().min(1).max(100),
  unitPrice: z.number().int().min(0).nullable().optional(),
});

const adminManualOrderItemSchema = z.object({
  lineId: z.string().trim().min(1).max(120),
  source: z.literal("manual"),
  name: z.string().trim().min(2).max(120),
  category: z.string().trim().max(80).optional().default("Hors catalogue"),
  colorName: z.string().trim().max(80).optional().default(""),
  colorHex: colorHexSchema.optional().default("#D8C4A3"),
  size: z.enum(CLOTHING_SIZES).default(DEFAULT_CLOTHING_SIZE),
  image: z.string().trim().max(500).optional().default(""),
  priceLabel: z.string().trim().max(120).optional().default("Prix à confirmer"),
  unitPrice: z.number().int().min(0).nullable().optional(),
  quantity: z.number().int().min(1).max(100),
});

export const createOrderSchema = z.object({
  body: z.object({
    clientRequestId: z.string().uuid("Identifiant de demande invalide."),
    customerName: z.string().trim().min(2, "Le nom du client est obligatoire.").max(80),
    customerPhone: z
      .string()
      .trim()
      .min(8, "Le numéro WhatsApp est obligatoire.")
      .max(30),
    note: z.string().trim().max(500).optional().default(""),
    items: z.array(publicOrderItemSchema).min(1).max(30),
  }),
  params: z.object({}).optional(),
  query: z.object({}).optional(),
});

export const updateAdminOrderSchema = z.object({
  body: z
    .object({
      customerName: z.string().trim().min(2).max(80).optional(),
      customerPhone: z.string().trim().min(8).max(30).optional(),
      note: z.string().trim().max(500).optional(),
      items: z
        .array(
          z.discriminatedUnion("source", [
            adminCatalogOrderItemSchema,
            adminManualOrderItemSchema,
          ]),
        )
        .min(1)
        .max(50)
        .optional(),
    })
    .refine((payload) => Object.keys(payload).length > 0, {
      message: "Au moins un champ doit être modifié.",
    }),
  params: z.object({
    id: objectIdSchema,
  }),
  query: z.object({}).optional(),
});

export const adminOrderActionSchema = z.object({
  body: z.object({}).optional(),
  params: z.object({
    id: objectIdSchema,
  }),
  query: z.object({}).optional(),
});

export const listAdminOrdersSchema = z.object({
  body: z.object({}).optional(),
  params: z.object({}).optional(),
  query: z.object({
    search: z.string().trim().max(120).optional().default(""),
    status: z
      .enum(["pending", "confirmed", "cancelled", "completed", "expired"])
      .optional(),
    page: z.coerce.number().int().min(1).optional().default(1),
    pageSize: z.coerce.number().int().min(1).max(100).optional().default(8),
  }),
});
