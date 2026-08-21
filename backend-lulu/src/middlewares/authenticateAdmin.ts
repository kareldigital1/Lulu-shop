import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { AppError } from "../utils/AppError";

type AdminJwtPayload = {
  email: string;
  role: "admin";
};

export function authenticateAdmin(request: Request, response: Response, next: NextFunction): void {
  const authorizationHeader = request.headers.authorization;

  if (!authorizationHeader?.startsWith("Bearer ")) {
    next(new AppError("Veuillez vous connecter pour continuer.", 401));
    return;
  }

  const token = authorizationHeader.replace("Bearer ", "");

  try {
    const payload = jwt.verify(token, env.JWT_SECRET, {
      algorithms: ["HS256"],
    }) as AdminJwtPayload;

    if (payload.role !== "admin" || payload.email !== env.ADMIN_EMAIL) {
      next(new AppError("Votre session n’autorise pas cette action.", 403));
      return;
    }

    response.locals.errorActor = {
      role: "admin",
      identifier: payload.email,
    };
    next();
  } catch {
    next(new AppError("Votre session a expiré. Veuillez vous reconnecter.", 401));
  }
}
