import type { NextFunction, Request, Response } from "express";
import { listAuditEvents } from "./audit-event.service";

export async function getAuditEvents(
  request: Request,
  response: Response,
  next: NextFunction,
) {
  try {
    response.json(await listAuditEvents(request.query));
  } catch (error) {
    next(error);
  }
}
