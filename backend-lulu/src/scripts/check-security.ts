import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import express, { type Express } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { app } from "../app";
import { env } from "../config/env";
import { authenticateAdmin } from "../middlewares/authenticateAdmin";
import { errorHandler } from "../middlewares/errorHandler";
import { validate } from "../middlewares/validate";
import { loginAdmin } from "../modules/auth/auth.service";

async function startServer(application: Express) {
  return new Promise<{ server: Server; baseUrl: string }>((resolve, reject) => {
    const server = application.listen(0, "127.0.0.1", () => {
      const address = server.address() as AddressInfo;
      resolve({
        server,
        baseUrl: `http://127.0.0.1:${address.port}`,
      });
    });
    server.once("error", reject);
  });
}

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

async function checkMainApplication(baseUrl: string) {
  const allowedOrigin = new URL(env.CORS_ORIGIN).origin;
  const healthResponse = await fetch(`${baseUrl}/api/health`, {
    headers: { Origin: allowedOrigin },
  });

  assert.equal(healthResponse.status, 200);
  assert.equal(
    healthResponse.headers.get("access-control-allow-origin"),
    allowedOrigin,
  );
  assert.equal(healthResponse.headers.get("x-powered-by"), null);
  assert.equal(healthResponse.headers.get("x-content-type-options"), "nosniff");
  assert.equal(
    healthResponse.headers.get("cross-origin-resource-policy"),
    "cross-origin",
  );

  const rejectedOriginResponse = await fetch(`${baseUrl}/api/health`, {
    headers: { Origin: "https://attacker.example" },
  });
  assert.equal(rejectedOriginResponse.status, 403);

  const protectedResponse = await fetch(`${baseUrl}/api/admin/products`);
  assert.equal(protectedResponse.status, 401);
  const protectedDocumentResponse = await fetch(
    `${baseUrl}/api/admin/orders/000000000000000000000000/purchase-order`,
  );
  assert.equal(protectedDocumentResponse.status, 401);
  const protectedNotificationRoutes = [
    { method: "GET", path: "/api/admin/notifications" },
    { method: "POST", path: "/api/admin/notifications/read-all" },
    { method: "POST", path: "/api/admin/notifications/unread-all" },
    { method: "DELETE", path: "/api/admin/notifications/read" },
    {
      method: "PATCH",
      path: "/api/admin/notifications/000000000000000000000000/read",
    },
    {
      method: "PATCH",
      path: "/api/admin/notifications/000000000000000000000000/unread",
    },
  ];

  for (const route of protectedNotificationRoutes) {
    const response = await fetch(`${baseUrl}${route.path}`, {
      method: route.method,
    });
    assert.equal(response.status, 401);
  }

  const malformedLoginResponse = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: { $ne: null },
      password: "incorrect",
    }),
  });
  assert.equal(malformedLoginResponse.status, 400);

  // La requête malformée précédente compte déjà comme première tentative.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "intrus@example.com",
        password: "incorrect",
      }),
    });
    assert.equal(response.status, 401);
  }

  const blockedLoginResponse = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "intrus@example.com",
      password: "incorrect",
    }),
  });
  assert.equal(blockedLoginResponse.status, 429);
  assert.ok(blockedLoginResponse.headers.get("ratelimit"));

  const invalidJsonResponse = await fetch(`${baseUrl}/api/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: '{"clientRequestId":',
  });
  assert.equal(invalidJsonResponse.status, 400);

  const oversizedBodyResponse = await fetch(`${baseUrl}/api/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ note: "x".repeat(110_000) }),
  });
  assert.equal(oversizedBodyResponse.status, 413);

  const { token } = loginAdmin(env.ADMIN_EMAIL, env.ADMIN_PASSWORD);
  const fakeImageForm = new FormData();
  fakeImageForm.append(
    "image",
    new Blob(["<html>not an image</html>"], { type: "image/png" }),
    "fake.png",
  );
  const fakeImageResponse = await fetch(`${baseUrl}/api/admin/uploads`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: fakeImageForm,
  });
  assert.equal(fakeImageResponse.status, 415);
}

async function checkValidationAndJwt(baseUrl: string) {
  const validationResponse = await fetch(
    `${baseUrl}/validate?page=2&ignored=query`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "  Tata Lulu  ",
        ignored: "body",
      }),
    },
  );
  assert.equal(validationResponse.status, 200);
  assert.deepEqual(await validationResponse.json(), {
    body: { name: "Tata Lulu" },
    query: { page: 2 },
  });

  const validToken = loginAdmin(env.ADMIN_EMAIL, env.ADMIN_PASSWORD).token;
  const validTokenResponse = await fetch(`${baseUrl}/protected`, {
    headers: { Authorization: `Bearer ${validToken}` },
  });
  assert.equal(validTokenResponse.status, 200);

  const wrongAlgorithmToken = jwt.sign(
    { email: env.ADMIN_EMAIL, role: "admin" },
    env.JWT_SECRET,
    { algorithm: "HS512", expiresIn: "12h" },
  );
  const wrongAlgorithmResponse = await fetch(`${baseUrl}/protected`, {
    headers: { Authorization: `Bearer ${wrongAlgorithmToken}` },
  });
  assert.equal(wrongAlgorithmResponse.status, 401);
}

async function main() {
  const validationApp = express();
  validationApp.use(express.json());
  validationApp.post(
    "/validate",
    validate(
      z.object({
        body: z.object({
          name: z.string().trim(),
        }),
        params: z.object({}).optional(),
        query: z.object({
          page: z.coerce.number().int(),
        }),
      }),
    ),
    (request, response) => {
      response.json({
        body: request.body,
        query: request.query,
      });
    },
  );
  validationApp.get(
    "/protected",
    authenticateAdmin,
    (_request, response) => {
      response.json({ ok: true });
    },
  );
  validationApp.use(errorHandler);

  const mainApplication = await startServer(app);
  const validationApplication = await startServer(validationApp);

  try {
    await checkMainApplication(mainApplication.baseUrl);
    await checkValidationAndJwt(validationApplication.baseUrl);
    console.log("Contrôles de sécurité réussis.");
  } finally {
    await Promise.all([
      closeServer(mainApplication.server),
      closeServer(validationApplication.server),
    ]);
  }
}

void main().catch((error) => {
  console.error("Échec des contrôles de sécurité.", error);
  process.exitCode = 1;
});
