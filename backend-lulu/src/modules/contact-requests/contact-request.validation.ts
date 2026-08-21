import { z } from "zod";

export const createContactRequestSchema = z.object({
  body: z.object({
    name: z
      .string()
      .trim()
      .min(2, "Le nom est obligatoire.")
      .max(80, "Le nom est trop long."),
    email: z
      .string()
      .trim()
      .email("L'email est invalide.")
      .max(254, "L'email est trop long."),
    phone: z.string().trim().max(30, "Le numéro est trop long.").optional().default(""),
    message: z
      .string()
      .trim()
      .min(10, "Le message doit contenir au moins 10 caractères.")
      .max(2_000, "Le message est trop long."),
  }),
  params: z.object({}).optional(),
  query: z.object({}).optional(),
});
