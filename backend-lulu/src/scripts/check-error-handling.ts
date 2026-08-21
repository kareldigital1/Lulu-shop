import assert from "node:assert/strict";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import { errorHandler } from "../middlewares/errorHandler";
import { requestLogger } from "../middlewares/requestLogger";
import { AppError } from "../utils/AppError";
import { logger, sanitizeLogValue } from "../utils/logger";

type ErrorResponse = {
  message: string;
  reference?: string;
};

async function closeServer(server: Server) {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

const application = express();
application.use(requestLogger);
application.use(express.json());

application.post("/api/orders", (_request, _response, next) => {
  next(new AppError("Stock insuffisant pour la couleur Rouge.", 409));
});

application.post("/api/admin/products", (_request, response, next) => {
  response.locals.errorActor = {
    role: "admin",
    identifier: "tatalulushop@gmail.com",
  };
  next(
    new Error(
      "MongoServerError sur la collection products, password=secret-value",
    ),
  );
});

application.post("/api/admin/store", (_request, _response, next) => {
  next(new AppError("La base MongoDB n’est pas disponible.", 503));
});

application.use(errorHandler);

async function checkErrorHandling() {
  const capturedErrors: unknown[] = [];
  const originalError = logger.error;
  logger.error = (_message, details) => {
    capturedErrors.push(details);
  };

  const server = application.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const businessResponse = await fetch(`${baseUrl}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customerPhone: "+2290100000000" }),
    });
    const businessBody = (await businessResponse.json()) as ErrorResponse;

    assert.equal(businessResponse.status, 409);
    assert.equal(
      businessBody.message,
      "Stock insuffisant pour la couleur Rouge.",
    );
    assert.equal(businessBody.reference, undefined);

    const technicalResponse = await fetch(`${baseUrl}/api/admin/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Produit test",
        password: "request-secret",
        accessToken: "request-token",
      }),
    });
    const technicalBody = (await technicalResponse.json()) as ErrorResponse;

    assert.equal(technicalResponse.status, 500);
    assert.equal(
      technicalBody.message,
      "Impossible de traiter cette demande pour le moment. Veuillez réessayer.",
    );
    assert.match(technicalBody.reference ?? "", /^ERR-[A-Z0-9]{6}$/);
    assert.doesNotMatch(
      JSON.stringify(technicalBody),
      /MongoDB|MongoServerError|collection|secret-value|request-secret/i,
    );

    const appErrorResponse = await fetch(`${baseUrl}/api/admin/store`, {
      method: "POST",
    });
    const appErrorBody = (await appErrorResponse.json()) as ErrorResponse;

    assert.equal(appErrorResponse.status, 503);
    assert.match(appErrorBody.reference ?? "", /^ERR-[A-Z0-9]{6}$/);
    assert.doesNotMatch(JSON.stringify(appErrorBody), /MongoDB|base/i);

    const technicalLog = capturedErrors.find(
      (entry) =>
        entry &&
        typeof entry === "object" &&
        "errorReference" in entry &&
        entry.errorReference === technicalBody.reference,
    ) as Record<string, unknown> | undefined;

    assert.ok(technicalLog);
    assert.equal(technicalLog.method, "POST");
    assert.equal(technicalLog.path, "/api/admin/products");
    assert.equal(technicalLog.action, "product.create");
    assert.deepEqual(technicalLog.actor, {
      role: "admin",
      identifier: "tatalulushop@gmail.com",
    });
    assert.ok(technicalLog.occurredAt);
    assert.ok(technicalLog.error instanceof Error);

    const sanitizedLog = JSON.stringify(sanitizeLogValue(technicalLog));
    assert.match(sanitizedLog, /MongoServerError/);
    assert.match(sanitizedLog, /\[Redacted\]/);
    assert.doesNotMatch(
      sanitizedLog,
      /secret-value|request-secret|request-token/,
    );

    const sanitizedTextSecret = JSON.stringify(
      sanitizeLogValue({ message: '{"password":"json-secret"}' }),
    );
    assert.match(sanitizedTextSecret, /\[Redacted\]/);
    assert.doesNotMatch(sanitizedTextSecret, /json-secret/);

    console.info("Contrôles de confidentialité des erreurs réussis.");
  } finally {
    await closeServer(server);
    logger.error = originalError;
  }
}

void checkErrorHandling().catch((error) => {
  console.error("Contrôles de confidentialité des erreurs échoués.");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
