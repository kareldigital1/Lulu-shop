import { logger } from "../../utils/logger";
import {
  AUDIT_ACTIONS,
  AuditEventModel,
  type AuditAction,
  type AuditActor,
  type AuditResource,
} from "./audit-event.model";

type AuditEventInput = {
  action: AuditAction;
  actor: AuditActor;
  resource: AuditResource;
  resourceId: string;
  resourceLabel: string;
  summary: string;
  details?: Record<string, unknown>;
};

type AuditListInput = {
  search?: unknown;
  action?: unknown;
  dateFrom?: unknown;
  dateTo?: unknown;
  page?: unknown;
  pageSize?: unknown;
};

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readPositiveInteger(value: unknown, fallback: number, maximum: number) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.min(parsed, maximum);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function recordAuditEvent(input: AuditEventInput) {
  return AuditEventModel.create({
    ...input,
    details: input.details ?? {},
  });
}

export async function recordAuditEventSafely(input: AuditEventInput) {
  try {
    await recordAuditEvent(input);
  } catch (error) {
    logger.error(
      `Impossible d'enregistrer l'événement d'audit "${input.action}" pour ${input.resourceId}.`,
      error,
    );
  }
}

export async function listAuditEvents(input: AuditListInput) {
  const search = readString(input.search);
  const requestedAction = readString(input.action);
  const dateFrom = readString(input.dateFrom);
  const dateTo = readString(input.dateTo);
  const page = readPositiveInteger(input.page, 1, 100_000);
  const pageSize = readPositiveInteger(input.pageSize, 20, 100);
  const filter: Record<string, unknown> = {};

  if (
    requestedAction &&
    AUDIT_ACTIONS.includes(requestedAction as AuditAction)
  ) {
    filter.action = requestedAction;
  }

  if (search) {
    const expression = new RegExp(escapeRegExp(search), "i");
    filter.$or = [
      { resourceLabel: expression },
      { resourceId: expression },
      { summary: expression },
    ];
  }

  if (dateFrom || dateTo) {
    const createdAt: Record<string, Date> = {};

    if (dateFrom) {
      createdAt.$gte = new Date(`${dateFrom}T00:00:00.000Z`);
    }

    if (dateTo) {
      createdAt.$lte = new Date(`${dateTo}T23:59:59.999Z`);
    }

    filter.createdAt = createdAt;
  }

  const [items, total] = await Promise.all([
    AuditEventModel.find(filter)
      .select("-details -resourceId")
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    AuditEventModel.countDocuments(filter),
  ]);

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}
