import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { logger } from "../utils/logger";

const CRITICAL_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const REQUEST_ID_PATTERN = /^[a-zA-Z0-9._-]{8,100}$/;

function getRequestPath(request: Request) {
  return request.originalUrl.split("?")[0] || request.path;
}

function getRequestId(request: Request) {
  const incomingRequestId = request.get("x-request-id")?.trim();

  return incomingRequestId && REQUEST_ID_PATTERN.test(incomingRequestId)
    ? incomingRequestId
    : randomUUID();
}

function isCriticalRequest(method: string, path: string) {
  return (
    CRITICAL_METHODS.has(method) ||
    (method === "GET" && path.startsWith("/api/admin/backups/"))
  );
}

function isNoisyReadRequest(method: string, path: string) {
  return (
    method === "GET" &&
    (path === "/api/health" ||
      path === "/api/ready" ||
      path.startsWith("/api/uploads/"))
  );
}

function getDurationMs(startedAt: bigint) {
  return Number(process.hrtime.bigint() - startedAt) / 1_000_000;
}

export function requestLogger(
  request: Request,
  response: Response,
  next: NextFunction,
) {
  const startedAt = process.hrtime.bigint();
  const requestId = getRequestId(request);
  const method = request.method.toUpperCase();
  const path = getRequestPath(request);
  const isCritical = isCriticalRequest(method, path);
  const isNoisyRead = isNoisyReadRequest(method, path);
  let isFinished = false;

  response.locals.requestId = requestId;
  response.setHeader("X-Request-Id", requestId);

  response.once("finish", () => {
    isFinished = true;
    const details = {
      event: "http.request.completed",
      requestId,
      method,
      path,
      statusCode: response.statusCode,
      durationMs: Number(getDurationMs(startedAt).toFixed(2)),
      critical: isCritical,
      errorReference: response.locals.errorReference,
    };

    if (response.statusCode >= 500) {
      if (path === "/api/ready" && response.statusCode === 503) {
        logger.warn("Service momentanément indisponible.", details);
        return;
      }

      logger.error("Requête HTTP terminée en erreur.", details);
      return;
    }

    if (response.statusCode >= 400) {
      logger.warn("Requête HTTP refusée.", details);
      return;
    }

    if (isCritical) {
      logger.info("Appel API critique terminé.", details);
      return;
    }

    if (isNoisyRead) {
      logger.debug("Requête technique terminée.", details);
      return;
    }

    logger.info("Requête HTTP terminée.", details);
  });

  response.once("close", () => {
    if (isFinished) {
      return;
    }

    logger.warn("Requête HTTP interrompue par le client.", {
      event: "http.request.aborted",
      requestId,
      method,
      path,
      durationMs: Number(getDurationMs(startedAt).toFixed(2)),
      critical: isCritical,
      errorReference: response.locals.errorReference,
    });
  });

  next();
}
