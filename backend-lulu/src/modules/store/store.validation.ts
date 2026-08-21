import { z } from "zod";

const optionalUrlSchema = z
  .string()
  .trim()
  .max(500, "URL trop longue.")
  .refine(
    (value) =>
      value === "" ||
      value.startsWith("/") ||
      z.string().url().safeParse(value).success,
    "URL invalide.",
  );

const requiredText = (label: string, maximum: number) =>
  z.string().trim().min(2, `${label} obligatoire.`).max(maximum, `${label} trop long.`);

const heroCtaSchema = z.object({
  enabled: z.boolean(),
  label: z.string().trim().max(80, "Libellé CTA trop long."),
  url: optionalUrlSchema,
});

const storeSettingsBodySchema = z.object({
  name: requiredText("Nom de la boutique", 120),
  footerTagline: requiredText("Slogan", 180),
  footerDescription: requiredText("Description courte", 500),
  fullDescription: z.string().trim().max(5_000, "Description complète trop longue."),
  logoUrl: optionalUrlSchema,
  faviconUrl: optionalUrlSchema,
  email: z.string().trim().email("Adresse e-mail invalide."),
  primaryPhone: requiredText("Téléphone", 40),
  whatsappNumber: requiredText("Numéro WhatsApp", 40),
  whatsappUrl: optionalUrlSchema,
  facebookUrl: optionalUrlSchema,
  instagramUrl: optionalUrlSchema,
  tiktokUrl: optionalUrlSchema,
  heroTitle: requiredText("Titre Hero", 180),
  heroHighlight: requiredText("Sous-titre Hero", 240),
  heroDescription: requiredText("Texte principal", 1_000),
  heroImageUrl: optionalUrlSchema,
  heroCtas: z.array(heroCtaSchema).max(2, "Deux boutons CTA maximum."),
  about: z.object({
    title: requiredText("Titre À propos", 240),
    subtitle: requiredText("Sous-titre À propos", 500),
    history: requiredText("Histoire", 5_000),
    mission: requiredText("Mission", 2_000),
    presentation: requiredText("Présentation", 5_000),
    values: z
      .array(requiredText("Valeur", 120))
      .min(1, "Ajoute au moins une valeur.")
      .max(20, "Trop de valeurs."),
  }),
  locationSection: z.object({
    mapUrl: optionalUrlSchema,
    mapEmbedUrl: optionalUrlSchema,
    addressLines: z
      .array(requiredText("Ligne d’adresse", 240))
      .min(1, "Ajoute au moins une ligne d’adresse.")
      .max(6, "Trop de lignes d’adresse."),
    city: requiredText("Ville", 120),
    country: requiredText("Pays", 120),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }),
  seoTitle: requiredText("Meta title", 180),
  seoDescription: requiredText("Meta description", 500),
  openGraphImageUrl: optionalUrlSchema,
  pdfSettings: z.object({
    logoUrl: optionalUrlSchema,
    address: requiredText("Adresse PDF", 500),
    phone: requiredText("Téléphone PDF", 80),
    email: z.string().trim().email("Adresse e-mail PDF invalide."),
    footerText: z.string().trim().max(500, "Pied de page PDF trop long."),
  }),
});

export type StoreSettingsInput = z.infer<typeof storeSettingsBodySchema>;

export const updateStoreSettingsSchema = z.object({
  body: storeSettingsBodySchema,
  params: z.object({}).optional(),
  query: z.object({}).optional(),
});
