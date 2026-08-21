import type { NextFunction, Request, Response } from "express";
import {
  getHealthStatus,
  getReadinessStatus,
} from "./monitoring.service";

export function getHealth(
  _request: Request,
  response: Response,
  _next: NextFunction,
) {
  response.setHeader("Cache-Control", "no-store");
  response.json(getHealthStatus());
}

export async function getReadiness(
  _request: Request,
  response: Response,
  next: NextFunction,
) {
  try {
    const status = await getReadinessStatus();
    response.setHeader("Cache-Control", "no-store");
    response.status(status.ok ? 200 : 503).json(status);
  } catch (error) {
    next(error);
  }
}
