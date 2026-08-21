import type { NextFunction, Request, Response } from "express";
import { env } from "../../config/env";
import { recordAuditEventSafely } from "../audit/audit-event.service";
import { loginAdmin } from "./auth.service";

function getRequestDetails(request: Request) {
  return {
    ip: request.ip,
    userAgent: request.get("user-agent") ?? "inconnu",
  };
}

export async function postAdminLogin(
  request: Request,
  response: Response,
  next: NextFunction,
) {
  try {
    const result = loginAdmin(request.body.email, request.body.password);
    await recordAuditEventSafely({
      action: "auth.login",
      actor: "admin",
      resource: "auth",
      resourceId: result.admin.email,
      resourceLabel: "Compte administrateur",
      summary: "Connexion au backoffice réussie.",
      details: getRequestDetails(request),
    });
    response.json(result);
  } catch (error) {
    next(error);
  }
}

export async function postAdminLogout(
  request: Request,
  response: Response,
  next: NextFunction,
) {
  try {
    await recordAuditEventSafely({
      action: "auth.logout",
      actor: "admin",
      resource: "auth",
      resourceId: env.ADMIN_EMAIL,
      resourceLabel: "Compte administrateur",
      summary: "Déconnexion du backoffice.",
      details: getRequestDetails(request),
    });
    response.status(204).send();
  } catch (error) {
    next(error);
  }
}
