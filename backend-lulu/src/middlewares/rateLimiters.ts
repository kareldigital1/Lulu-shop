import type { Request, Response } from "express";
import { rateLimit } from "express-rate-limit";

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

function jsonRateLimitHandler(message: string) {
  return (_request: Request, response: Response) => {
    response.status(429).json({ message });
  };
}

export const loginRateLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  limit: 3,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: jsonRateLimitHandler(
    "Trop de tentatives de connexion. Réessaie dans 15 minutes.",
  ),
});

export const publicWriteRateLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: jsonRateLimitHandler(
    "Trop de demandes envoyées. Réessaie dans quelques minutes.",
  ),
});

export const adminUploadRateLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: jsonRateLimitHandler(
    "Trop d'images envoyées. Réessaie dans quelques minutes.",
  ),
});

export const adminBackupRateLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: jsonRateLimitHandler(
    "Trop de sauvegardes demandées. Réessaie dans quelques minutes.",
  ),
});

export const adminDocumentRateLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: jsonRateLimitHandler(
    "Trop de documents demandés. Réessaie dans quelques minutes.",
  ),
});
