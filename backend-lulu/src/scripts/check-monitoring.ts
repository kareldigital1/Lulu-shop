import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import mongoose from "mongoose";
import { app } from "../app";
import { connectToDatabase } from "../config/db";
import { logger } from "../utils/logger";

const EXPECTED_REQUEST_ID = "monitoring-check-request";

async function closeServer(server: ReturnType<typeof app.listen>) {
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

async function checkMonitoring() {
  const events = new Set<string>();
  const originalInfo = logger.info;
  const originalWarn = logger.warn;
  const originalError = logger.error;

  function collectEvent(details: unknown) {
    if (
      details &&
      typeof details === "object" &&
      "event" in details &&
      typeof details.event === "string"
    ) {
      events.add(details.event);
    }
  }

  logger.info = (message, details) => {
    collectEvent(details);
    originalInfo(message, details);
  };
  logger.warn = (message, details) => {
    collectEvent(details);
    originalWarn(message, details);
  };
  logger.error = (message, details) => {
    collectEvent(details);
    originalError(message, details);
  };

  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const healthResponse = await fetch(`${baseUrl}/api/health`, {
      headers: {
        "X-Request-Id": EXPECTED_REQUEST_ID,
      },
    });
    const health = (await healthResponse.json()) as {
      ok: boolean;
      status: string;
    };

    assert.equal(healthResponse.status, 200);
    assert.equal(health.ok, true);
    assert.equal(health.status, "alive");
    assert.equal(
      healthResponse.headers.get("x-request-id"),
      EXPECTED_REQUEST_ID,
    );

    const unavailableResponse = await fetch(`${baseUrl}/api/ready`);
    const unavailable = (await unavailableResponse.json()) as {
      ok: boolean;
      status: string;
      checks: { mongodb: { status: string } };
    };

    assert.equal(unavailableResponse.status, 503);
    assert.equal(unavailable.ok, false);
    assert.equal(unavailable.status, "not_ready");
    assert.equal(unavailable.checks.mongodb.status, "disconnected");

    const failedLoginResponse = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: "intrus@example.com",
        password: "mot-de-passe-invalide",
      }),
    });
    assert.equal(failedLoginResponse.status, 401);

    await connectToDatabase();

    const readyResponse = await fetch(`${baseUrl}/api/ready`);
    const ready = (await readyResponse.json()) as {
      ok: boolean;
      status: string;
      checks: {
        mongodb: {
          ok: boolean;
          status: string;
          responseTimeMs: number | null;
        };
      };
    };

    assert.equal(readyResponse.status, 200);
    assert.equal(ready.ok, true);
    assert.equal(ready.status, "ready");
    assert.equal(ready.checks.mongodb.ok, true);
    assert.equal(ready.checks.mongodb.status, "up");
    assert.equal(typeof ready.checks.mongodb.responseTimeMs, "number");

    const productsResponse = await fetch(`${baseUrl}/api/products`);
    assert.equal(productsResponse.status, 200);

    await mongoose.disconnect();

    const disconnectedResponse = await fetch(`${baseUrl}/api/ready`);
    assert.equal(disconnectedResponse.status, 503);

    assert.equal(events.has("auth.login_failed"), true);
    assert.equal(events.has("database.connecting"), true);
    assert.equal(events.has("database.connected"), true);
    assert.equal(events.has("database.disconnected"), true);
    assert.equal(events.has("http.request.completed"), true);

    console.info("Contrôles de monitoring réussis.");
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }

    await closeServer(server);
    logger.info = originalInfo;
    logger.warn = originalWarn;
    logger.error = originalError;
  }
}

void checkMonitoring().catch((error) => {
  console.error("Contrôles de monitoring échoués.");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
