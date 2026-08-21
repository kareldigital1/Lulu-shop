import type { NextFunction, Request, Response } from "express";
import multer from "multer";
import { AppError } from "../utils/AppError";
import { createErrorReference } from "../utils/errorReference";
import { logger } from "../utils/logger";

type HttpParserError = Error & {
  status?: number;
  type?: string;
};

type ErrorActor = {
  role: "admin" | "customer" | "anonymous" | "system";
  identifier?: string;
};

const TECHNICAL_ERROR_MESSAGE =
  "Impossible de traiter cette demande pour le moment. Veuillez réessayer.";

function getRequestPath(request: Request) {
  return request.originalUrl.split("?")[0] || request.path;
}

function getRequestAction(request: Request) {
  const method = request.method.toUpperCase();
  const path = getRequestPath(request);

  if (path === "/api/auth/login") return "admin.login";
  if (path === "/api/auth/logout") return "admin.logout";
  if (path.startsWith("/api/contact-requests")) return "contact.create";
  if (path.startsWith("/api/orders")) return "order.create";
  if (path.startsWith("/api/admin/products")) {
    if (path.endsWith("/restock")) return "product.restock";
    if (method === "POST") return "product.create";
    if (method === "PATCH" || method === "PUT") return "product.update";
    if (method === "DELETE") return "product.delete";
    return "product.read";
  }
  if (path.startsWith("/api/admin/orders")) return `order.${method.toLowerCase()}`;
  if (path.startsWith("/api/admin/store")) return `store.${method.toLowerCase()}`;
  if (path.startsWith("/api/admin/uploads")) return `image.${method.toLowerCase()}`;
  if (path.startsWith("/api/admin/backups")) return "backup.generate";
  if (path.startsWith("/api/admin")) return `admin.${method.toLowerCase()}`;

  return `${method} ${path}`;
}

function getRequestActor(request: Request, response: Response): ErrorActor {
  const authenticatedActor = response.locals.errorActor as
    | ErrorActor
    | undefined;

  if (authenticatedActor?.role) {
    return authenticatedActor;
  }

  const body =
    request.body && typeof request.body === "object" && !Array.isArray(request.body)
      ? (request.body as Record<string, unknown>)
      : {};
  const identifier = [
    body.email,
    body.customerEmail,
    body.phone,
    body.customerPhone,
    body.name,
    body.customerName,
  ].find((value) => typeof value === "string" && value.trim()) as
    | string
    | undefined;

  return {
    role:
      getRequestPath(request).startsWith("/api/admin") ||
      getRequestPath(request).startsWith("/api/auth")
        ? "admin"
        : identifier
          ? "customer"
          : "anonymous",
    identifier: identifier?.trim(),
  };
}

function getTechnicalErrorDetails(
  error: Error,
  request: Request,
  response: Response,
  statusCode: number,
  errorReference: string,
) {
  return {
    event: "http.error",
    errorReference,
    requestId: response.locals.requestId ?? "inconnu",
    method: request.method,
    path: getRequestPath(request),
    action: getRequestAction(request),
    actor: getRequestActor(request, response),
    statusCode,
    occurredAt: new Date().toISOString(),
    client: {
      ip: request.ip,
      userAgent: request.get("user-agent") ?? "inconnu",
    },
    requestData: {
      params: request.params,
      query: request.query,
      body: request.body,
    },
    error,
  };
}

function sendTechnicalError(
  error: Error,
  request: Request,
  response: Response,
  statusCode: number,
  logMessage: string,
) {
  const errorReference = createErrorReference();
  response.locals.errorReference = errorReference;

  logger.error(
    logMessage,
    getTechnicalErrorDetails(
      error,
      request,
      response,
      statusCode,
      errorReference,
    ),
  );
  response.status(statusCode).json({
    message: TECHNICAL_ERROR_MESSAGE,
    reference: errorReference,
  });
}

function getParserErrorResponse(error: Error) {
  const parserError = error as HttpParserError;

  if (parserError.type === "entity.too.large" || parserError.status === 413) {
    return {
      statusCode: 413,
      message: "Le corps de la requête dépasse la taille maximale autorisée.",
    };
  }

  if (
    parserError.status === 400 &&
    (parserError instanceof SyntaxError || parserError.type === "entity.parse.failed")
  ) {
    return {
      statusCode: 400,
      message: "Le corps JSON de la requête est invalide.",
    };
  }

  return null;
}

export function errorHandler(
  error: Error,
  request: Request,
  response: Response,
  _next: NextFunction,
): void {
  const requestDetails = {
    event: "http.error",
    requestId: response.locals.requestId ?? "inconnu",
    method: request.method,
    path: getRequestPath(request),
    action: getRequestAction(request),
    actor: getRequestActor(request, response),
  };

  if (response.headersSent) {
    const errorReference = createErrorReference();
    response.locals.errorReference = errorReference;
    logger.error("Exception après le début de la réponse HTTP.", {
      ...getTechnicalErrorDetails(
        error,
        request,
        response,
        response.statusCode,
        errorReference,
      ),
    });
    response.destroy(error);
    return;
  }

  const parserErrorResponse = getParserErrorResponse(error);

  if (parserErrorResponse) {
    logger.warn("Corps de requête HTTP refusé.", {
      ...requestDetails,
      statusCode: parserErrorResponse.statusCode,
      error: {
        name: error.name,
        message: error.message,
      },
    });
    response.status(parserErrorResponse.statusCode).json({
      message: parserErrorResponse.message,
    });
    return;
  }

  if (error instanceof AppError) {
    if (error.statusCode >= 500) {
      sendTechnicalError(
        error,
        request,
        response,
        error.statusCode,
        "Erreur applicative pendant une requête HTTP.",
      );
      return;
    }

    const details = {
      ...requestDetails,
      statusCode: error.statusCode,
      error: {
        name: error.name,
        message: error.message,
      },
    };

    logger.warn("Requête rejetée par l'application.", details);

    response.status(error.statusCode).json({
      message: error.message,
    });
    return;
  }

  if (error instanceof multer.MulterError) {
    logger.warn("Fichier envoyé refusé.", {
      ...requestDetails,
      statusCode: 400,
      error: {
        name: error.name,
        message: error.message,
        code: error.code,
      },
    });
    response.status(400).json({
      message:
        error.code === "LIMIT_FILE_SIZE"
          ? "L'image dépasse la taille maximale de 5 Mo."
          : "Le fichier envoyé n'est pas valide.",
    });
    return;
  }

  sendTechnicalError(
    error,
    request,
    response,
    500,
    "Exception HTTP non gérée.",
  );
}
