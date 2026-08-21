import pino from "pino";
import { env } from "../config/env";

const MAX_LOG_DEPTH = 6;
const MAX_ARRAY_LENGTH = 25;
const MAX_STRING_LENGTH = 4_000;
const REDACTED_VALUE = "[Redacted]";
const SENSITIVE_KEY_PATTERN =
  /password|passwd|passcode|secret|credential|token|authorization|cookie|api[-_]?key|private[-_]?key|mongo_uri|gmail_app_password/i;

type LogLevel = "debug" | "info" | "warn" | "error" | "fatal";
type LogDetails = Record<string, unknown> | Error | unknown;

function redactText(value: string) {
  const redacted = value
    .replace(
      /(mongodb(?:\+srv)?:\/\/)([^@\s]+)@/gi,
      `$1${REDACTED_VALUE}@`,
    )
    .replace(/(Bearer\s+)[A-Za-z0-9._~+/-]+=*/gi, `$1${REDACTED_VALUE}`)
    .replace(
      /(["']?(?:password|passwd|passcode|secret|token|api[-_]?key)["']?\s*[:=]\s*["']?)[^\s,;}"']+/gi,
      `$1${REDACTED_VALUE}`,
    );

  return redacted.length > MAX_STRING_LENGTH
    ? `${redacted.slice(0, MAX_STRING_LENGTH)}…`
    : redacted;
}

export function sanitizeLogValue(
  value: unknown,
  depth = 0,
  seen = new WeakSet<object>(),
): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === "string") {
    return redactText(value);
  }

  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint"
  ) {
    return value;
  }

  if (depth >= MAX_LOG_DEPTH) {
    return "[MaxDepth]";
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value instanceof Error) {
    const errorWithCode = value as Error & { code?: unknown; cause?: unknown };

    return {
      name: value.name,
      message: redactText(value.message),
      stack: value.stack ? redactText(value.stack) : undefined,
      code: errorWithCode.code,
      cause: errorWithCode.cause
        ? sanitizeLogValue(errorWithCode.cause, depth + 1, seen)
        : undefined,
    };
  }

  if (Buffer.isBuffer(value)) {
    return `[Buffer ${value.length} bytes]`;
  }

  if (typeof value !== "object") {
    return String(value);
  }

  if (seen.has(value)) {
    return "[Circular]";
  }

  seen.add(value);

  if (Array.isArray(value)) {
    return value
      .slice(0, MAX_ARRAY_LENGTH)
      .map((entry) => sanitizeLogValue(entry, depth + 1, seen));
  }

  const sanitized: Record<string, unknown> = {};

  for (const [key, entry] of Object.entries(value)) {
    sanitized[key] = SENSITIVE_KEY_PATTERN.test(key)
      ? REDACTED_VALUE
      : sanitizeLogValue(entry, depth + 1, seen);
  }

  return sanitized;
}

const destination = pino.destination({
  dest: 1,
  sync: true,
});

const baseLogger = pino(
  {
    level: env.LOG_LEVEL,
    base: {
      service: "backend-lulu",
      environment: env.NODE_ENV,
      pid: process.pid,
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  },
  destination,
);

function writeLog(level: LogLevel, message: string, details?: LogDetails) {
  if (details === undefined) {
    baseLogger[level](message);
    return;
  }

  const sanitized = sanitizeLogValue(details);
  const context =
    sanitized && typeof sanitized === "object" && !Array.isArray(sanitized)
      ? sanitized
      : { details: sanitized };

  baseLogger[level](context, message);
}

export const logger = {
  debug: (message: string, details?: LogDetails) =>
    writeLog("debug", message, details),
  info: (message: string, details?: LogDetails) =>
    writeLog("info", message, details),
  warn: (message: string, details?: LogDetails) =>
    writeLog("warn", message, details),
  error: (message: string, details?: LogDetails) =>
    writeLog("error", message, details),
  fatal: (message: string, details?: LogDetails) =>
    writeLog("fatal", message, details),
  flush: () => baseLogger.flush(),
};
