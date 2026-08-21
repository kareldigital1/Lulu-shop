import type { NextFunction, Request, Response } from "express";
import { createErrorReference } from "../../utils/errorReference";
import { logger } from "../../utils/logger";
import { recordAuditEventSafely } from "../audit/audit-event.service";
import { streamJsonBackup, streamMongoDbBackup } from "./backup.service";

async function recordBackupAudit(
  action: "backup.json_exported" | "backup.mongodb_exported",
  result: Awaited<ReturnType<typeof streamJsonBackup>>,
) {
  await recordAuditEventSafely({
    action,
    actor: "admin",
    resource: "backup",
    resourceId: result.fileName,
    resourceLabel: result.fileName,
    summary:
      action === "backup.json_exported"
        ? "Export des données téléchargé."
        : "Archive complète téléchargée.",
    details: result,
  });
}

function forwardBackupError(
  error: unknown,
  request: Request,
  response: Response,
  next: NextFunction,
) {
  if (response.headersSent) {
    const errorReference = createErrorReference();
    response.locals.errorReference = errorReference;
    logger.error("Export de sauvegarde interrompu après le début du transfert.", {
      event: "backup.stream_failed",
      errorReference,
      requestId: response.locals.requestId ?? "inconnu",
      method: request.method,
      path: request.originalUrl.split("?")[0] || request.path,
      action: "backup.generate",
      actor: response.locals.errorActor ?? { role: "admin" },
      occurredAt: new Date().toISOString(),
      error,
    });
    response.destroy(error instanceof Error ? error : undefined);
    return;
  }

  next(error);
}

export async function downloadJsonBackup(
  _request: Request,
  response: Response,
  next: NextFunction,
) {
  try {
    const result = await streamJsonBackup(response);
    await recordBackupAudit("backup.json_exported", result);
  } catch (error) {
    forwardBackupError(error, _request, response, next);
  }
}

export async function downloadMongoDbBackup(
  _request: Request,
  response: Response,
  next: NextFunction,
) {
  try {
    const result = await streamMongoDbBackup(response);
    await recordBackupAudit("backup.mongodb_exported", result);
  } catch (error) {
    forwardBackupError(error, _request, response, next);
  }
}
