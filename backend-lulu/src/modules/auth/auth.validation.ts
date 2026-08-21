import { z } from "zod";

export const adminLoginSchema = z.object({
  body: z.object({
    email: z
      .string()
      .trim()
      .email("Email administrateur invalide.")
      .max(254, "Email administrateur trop long."),
    password: z
      .string()
      .min(1, "Mot de passe obligatoire.")
      .max(256, "Mot de passe trop long."),
  }),
  params: z.object({}).optional(),
  query: z.object({}).optional(),
});
