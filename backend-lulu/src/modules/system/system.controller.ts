import type { NextFunction, Request, Response } from "express";
import { getAdminSystemStatus } from "./system.service";

export async function getSystemStatus(
  _request: Request,
  response: Response,
  next: NextFunction,
) {
  try {
    response.setHeader("Cache-Control", "private, no-store");
    response.json(await getAdminSystemStatus());
  } catch (error) {
    next(error);
  }
}
