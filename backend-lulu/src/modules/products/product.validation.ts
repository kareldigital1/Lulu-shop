import { z } from "zod";
import { isReservedAutomaticBadge } from "./product-badge";
import {
  MAX_PRODUCT_STOCK,
  MAX_VARIANT_STOCK,
  PRODUCT_STATUSES,
} from "./product.model";
import {
  CLOTHING_SIZES,
  DEFAULT_CLOTHING_SIZE,
} from "./product-size";

const objectIdSchema = z
  .string()
  .regex(/^[a-f\d]{24}$/i, "L'identifiant produit est invalide.");

const productSizeStockSchema = z.object({
  size: z.enum(CLOTHING_SIZES).default(DEFAULT_CLOTHING_SIZE),
  stock: z
    .number()
    .int()
    .min(0, "Le stock d'une taille ne peut pas être négatif.")
    .max(MAX_VARIANT_STOCK, "Le stock d'une taille est trop élevé."),
});

const productVariantSchema = z.object({
  id: z
    .string()
    .trim()
    .min(1, "Identifiant de couleur obligatoire.")
    .max(120, "Identifiant de couleur trop long."),
  colorName: z
    .string()
    .trim()
    .min(1, "Nom de couleur obligatoire.")
    .max(80, "Nom de couleur trop long."),
  colorHex: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Code couleur hexadécimal invalide."),
  images: z
    .array(z.string().trim().min(1).max(500, "Référence d'image trop longue."))
    .max(12, "Une couleur ne peut pas contenir plus de 12 images.")
    .default([]),
  sizes: z
    .array(productSizeStockSchema)
    .max(CLOTHING_SIZES.length, "Trop de tailles renseignées pour cette couleur.")
    .default([])
    .superRefine((sizes, context) => {
      const values = sizes.map((entry) => entry.size);

      if (new Set(values).size !== values.length) {
        context.addIssue({
          code: "custom",
          message: "Une taille ne peut apparaître qu'une seule fois pour une couleur.",
        });
      }
    }),
  stock: z
    .number()
    .int()
    .min(0, "Le stock d'une couleur ne peut pas être négatif.")
    .max(MAX_VARIANT_STOCK, "Le stock d'une couleur est trop élevé."),
});

const productBodySchema = z.object({
  slug: z
    .string()
    .trim()
    .min(2, "Slug obligatoire.")
    .max(120, "Slug trop long.")
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Le slug doit contenir uniquement des lettres minuscules sans accent, des chiffres et des tirets.",
    ),
  categoryId: z
    .string()
    .regex(/^[a-f\d]{24}$/i, "La catégorie sélectionnée est invalide."),
  category: z.string().trim().min(2).max(80).optional(),
  types: z
    .array(z.string().trim().min(1).max(80))
    .max(20, "Trop de types renseignés.")
    .default([]),
  name: z.string().trim().min(2, "Nom obligatoire.").max(120),
  shortDescription: z
    .string()
    .trim()
    .min(10, "Description courte trop courte.")
    .max(300, "Description courte trop longue."),
  description: z
    .string()
    .trim()
    .min(20, "Description complète trop courte.")
    .max(5_000, "Description complète trop longue."),
  benefits: z
    .array(z.string().trim().min(2).max(180))
    .min(1, "Au moins un avantage est requis.")
    .max(20, "Trop d'avantages renseignés."),
  priceLabel: z.string().trim().min(2, "Prix obligatoire.").max(120),
  priceAmount: z
    .number()
    .int()
    .positive("Le prix normal doit être supérieur à zéro.")
    .max(1_000_000_000, "Le prix normal est trop élevé.")
    .nullable()
    .optional(),
  promotionPrice: z
    .number()
    .int()
    .positive("Le prix promotionnel doit être supérieur à zéro.")
    .max(1_000_000_000, "Le prix promotionnel est trop élevé.")
    .nullable()
    .optional(),
  promotionStartAt: z.coerce.date().nullable().optional(),
  promotionEndAt: z.coerce.date().nullable().optional(),
  image: z.string().trim().max(500, "Référence d'image trop longue."),
  badge: z
    .string()
    .trim()
    .max(40, "Badge trop long.")
    .refine(
      (value) => !isReservedAutomaticBadge(value),
      'Le badge "Nouveau" est ajouté automatiquement après publication.',
    )
    .optional()
    .default(""),
  whatsappMessage: z
    .string()
    .trim()
    .min(5, "Message WhatsApp obligatoire.")
    .max(500, "Message WhatsApp trop long."),
  featured: z.boolean().default(false),
  order: z.number().int().min(0).max(1_000_000).default(0),
  variants: z
    .array(productVariantSchema)
    .max(30, "Un produit ne peut pas contenir plus de 30 couleurs.")
    .default([]),
  stock: z
    .number()
    .int()
    .min(0, "Le stock ne peut pas être négatif.")
    .max(MAX_PRODUCT_STOCK, "Le stock est trop élevé."),
  status: z.enum(PRODUCT_STATUSES).optional(),
  isActive: z.boolean().default(true),
});

export const createProductSchema = z.object({
  body: productBodySchema,
  params: z.object({}).optional(),
  query: z.object({}).optional(),
});

export const updateProductSchema = z.object({
  body: productBodySchema.partial().refine((payload) => Object.keys(payload).length > 0, {
    message: "Au moins un champ doit être modifié.",
  }),
  params: z.object({
    id: objectIdSchema,
  }),
  query: z.object({}).optional(),
});

export const restockProductSchema = z.object({
  body: z.object({
    items: z
      .array(
        z.object({
          variantId: z.string().trim().min(1, "La couleur est obligatoire."),
          size: z.enum(CLOTHING_SIZES).default(DEFAULT_CLOTHING_SIZE),
          quantity: z
            .number()
            .int()
            .min(1, "La quantité doit être supérieure à zéro.")
            .max(100_000, "La quantité est trop élevée."),
        }),
      )
      .min(1, "Ajoute au moins une quantité.")
      .superRefine((items, context) => {
        const variantIds = items.map(
          (item) => `${item.variantId}::${item.size}`,
        );

        if (new Set(variantIds).size !== variantIds.length) {
          context.addIssue({
            code: "custom",
            message:
              "Une combinaison couleur et taille ne peut apparaître qu'une seule fois.",
          });
        }
      }),
    note: z.string().trim().max(240, "La note est trop longue.").optional(),
  }),
  params: z.object({
    id: objectIdSchema,
  }),
  query: z.object({}).optional(),
});

export const deleteProductSchema = z.object({
  body: z.object({}).optional(),
  params: z.object({
    id: objectIdSchema,
  }),
  query: z.object({}).optional(),
});
