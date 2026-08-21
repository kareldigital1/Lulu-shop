import mongoose from "mongoose";

const READINESS_TIMEOUT_MS = 2_000;
const MONGOOSE_STATES: Record<number, string> = {
  0: "disconnected",
  1: "connected",
  2: "connecting",
  3: "disconnecting",
};

function getMongoState() {
  return MONGOOSE_STATES[mongoose.connection.readyState] ?? "unknown";
}

async function pingDatabase() {
  const database = mongoose.connection.db;

  if (!database || mongoose.connection.readyState !== 1) {
    return {
      ok: false,
      status: getMongoState(),
      responseTimeMs: null,
    };
  }

  const startedAt = process.hrtime.bigint();
  let timeout: NodeJS.Timeout | undefined;

  try {
    await Promise.race([
      database.command({ ping: 1 }),
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(
          () => reject(new Error("MongoDB readiness timeout")),
          READINESS_TIMEOUT_MS,
        );
      }),
    ]);

    return {
      ok: true,
      status: "up",
      responseTimeMs: Number(
        (
          Number(process.hrtime.bigint() - startedAt) / 1_000_000
        ).toFixed(2),
      ),
    };
  } catch {
    return {
      ok: false,
      status: "unavailable",
      responseTimeMs: Number(
        (
          Number(process.hrtime.bigint() - startedAt) / 1_000_000
        ).toFixed(2),
      ),
    };
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

export function getHealthStatus() {
  return {
    ok: true,
    status: "alive",
    service: "backend-lulu",
    uptimeSeconds: Number(process.uptime().toFixed(1)),
    date: new Date().toISOString(),
  };
}

export async function getReadinessStatus() {
  const mongodb = await pingDatabase();

  return {
    ok: mongodb.ok,
    status: mongodb.ok ? "ready" : "not_ready",
    service: "backend-lulu",
    checks: {
      mongodb,
    },
    date: new Date().toISOString(),
  };
}
