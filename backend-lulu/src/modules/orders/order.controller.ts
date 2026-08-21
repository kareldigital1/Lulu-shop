import type { NextFunction, Request, Response } from "express";
import {
  cancelAdminOrder,
  completeAdminOrder,
  confirmAdminOrder,
  createOrder,
  listAdminOrders,
  updateAdminOrder,
} from "./order.service";

export async function postOrder(
  request: Request,
  response: Response,
  next: NextFunction,
) {
  try {
    const order = await createOrder(request.body);
    response.status(201).json(order);
  } catch (error) {
    next(error);
  }
}

export async function getAdminOrders(
  request: Request,
  response: Response,
  next: NextFunction,
) {
  try {
    response.json(await listAdminOrders(request.query));
  } catch (error) {
    next(error);
  }
}

export async function patchAdminOrder(
  request: Request,
  response: Response,
  next: NextFunction,
) {
  try {
    response.json(await updateAdminOrder(String(request.params.id), request.body));
  } catch (error) {
    next(error);
  }
}

export async function postConfirmAdminOrder(
  request: Request,
  response: Response,
  next: NextFunction,
) {
  try {
    response.json(await confirmAdminOrder(String(request.params.id)));
  } catch (error) {
    next(error);
  }
}

export async function postCancelAdminOrder(
  request: Request,
  response: Response,
  next: NextFunction,
) {
  try {
    response.json(await cancelAdminOrder(String(request.params.id)));
  } catch (error) {
    next(error);
  }
}

export async function postCompleteAdminOrder(
  request: Request,
  response: Response,
  next: NextFunction,
) {
  try {
    response.json(await completeAdminOrder(String(request.params.id)));
  } catch (error) {
    next(error);
  }
}
