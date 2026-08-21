import type { NextFunction, Request, Response } from "express";
import {
  listAdminCategories,
  listPublicCategories,
} from "./category.service";

export async function getCategories(
  _request: Request,
  response: Response,
  next: NextFunction,
) {
  try {
    response.json(await listPublicCategories());
  } catch (error) {
    next(error);
  }
}

export async function getAdminCategories(
  _request: Request,
  response: Response,
  next: NextFunction,
) {
  try {
    response.json(await listAdminCategories());
  } catch (error) {
    next(error);
  }
}
