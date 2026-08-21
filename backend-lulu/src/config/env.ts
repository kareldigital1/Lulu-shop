import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

function hasMongoPlaceholders(uri: string) {
  return ["<username>", "<password>", "<cluster-url>"].some((token) => uri.includes(token));
}

const httpOrigin = z
  .string()
  .url()
  .refine((value) => ["http:", "https:"].includes(new URL(value).protocol), {
    message: "L'URL doit utiliser HTTP ou HTTPS.",
  })
  .transform((value) => new URL(value).origin);

const optionalTrimmedString = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().optional(),
);

const optionalEmail = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().email().optional(),
);

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
  PORT: z.coerce.number().int().positive().default(8000),
  MONGO_URI: z
    .string()
    .min(1, "MONGO_URI est obligatoire")
    .refine((value) => /^mongodb(?:\+srv)?:\/\//i.test(value), {
      message: "MONGO_URI doit utiliser le protocole mongodb:// ou mongodb+srv://.",
    })
    .refine((value) => !hasMongoPlaceholders(value), {
      message: "MONGO_URI contient encore des placeholders. Remplace <username>, <password> et <cluster-url> par les vraies valeurs Atlas.",
    }),
  CORS_ORIGIN: httpOrigin.default("http://localhost:3000"),
  FRONTEND_URL: httpOrigin.default("http://localhost:3000"),
  ADMIN_EMAIL: z.string().trim().email().default("admin@tatalulushop.com"),
  ADMIN_PASSWORD: z
    .string()
    .min(12, "ADMIN_PASSWORD doit contenir au moins 12 caractères")
    .max(256, "ADMIN_PASSWORD est trop long")
    .refine((value) => value !== "change-admin-password", {
      message: "ADMIN_PASSWORD utilise encore la valeur d'exemple.",
    }),
  JWT_SECRET: z
    .string()
    .min(32, "JWT_SECRET doit contenir au moins 32 caractères")
    .refine((value) => !value.startsWith("change-me"), {
      message: "JWT_SECRET utilise encore une valeur d'exemple.",
    }),
  GMAIL_USER: optionalEmail,
  GMAIL_APP_PASSWORD: optionalTrimmedString,
  LOW_STOCK_EMAIL: z.string().trim().email().default("tatalulushop@gmail.com"),
  NEW_PRODUCT_BADGE_DAYS: z.coerce
    .number()
    .int()
    .min(0)
    .max(365)
    .default(30),
  PENDING_ORDER_EXPIRATION_HOURS: z.coerce
    .number()
    .int()
    .min(1)
    .max(720)
    .default(72),
  NOTIFICATION_RETENTION_DAYS: z.coerce
    .number()
    .int()
    .min(7)
    .max(730)
    .default(90),
  ORDER_NOTIFICATION_EMAIL: optionalEmail,
  MAIL_FROM_NAME: z.string().trim().min(1).max(120).default("Tata Lulu Shop"),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error("Configuration d'environnement invalide :", parsedEnv.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsedEnv.data;
