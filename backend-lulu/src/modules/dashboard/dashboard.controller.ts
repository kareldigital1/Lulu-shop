import type { NextFunction, Request, Response } from "express";
import { getAdminDashboardStats } from "./dashboard.service";

export async function getAdminDashboard(
  _request: Request,
  response: Response,
  next: NextFunction,
) {
  try {
    response.json(await getAdminDashboardStats());
  } catch (error) {
    next(error);
  }
}
