import type { NextFunction, Request, Response } from "express";
import { logger } from "../../utils/logger";

type AuthenticationAction = "login" | "logout";

export function monitorAuthentication(action: AuthenticationAction) {
  return (request: Request, response: Response, next: NextFunction) => {
    response.once("finish", () => {
      const succeeded = response.statusCode < 400;
      const details = {
        event: `auth.${action}_${succeeded ? "succeeded" : "failed"}`,
        requestId: response.locals.requestId ?? "inconnu",
        statusCode: response.statusCode,
        ip: request.ip,
        userAgent: request.get("user-agent") ?? "inconnu",
      };

      if (succeeded) {
        logger.info(
          action === "login"
            ? "Connexion administrateur réussie."
            : "Déconnexion administrateur réussie.",
          details,
        );
        return;
      }

      logger.warn(
        action === "login"
          ? "Tentative de connexion administrateur refusée."
          : "Tentative de déconnexion administrateur refusée.",
        details,
      );
    });

    next();
  };
}
