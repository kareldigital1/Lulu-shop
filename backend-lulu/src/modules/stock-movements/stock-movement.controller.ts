import type { NextFunction, Request, Response } from "express";
import { listStockMovements } from "./stock-movement.service";

export async function getStockMovements(
  request: Request,
  response: Response,
  next: NextFunction,
) {
  try {
    response.json(await listStockMovements(request.query));
  } catch (error) {
    next(error);
  }
}
