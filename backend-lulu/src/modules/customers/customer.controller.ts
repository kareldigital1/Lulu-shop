import type { NextFunction, Request, Response } from "express";
import { getCustomerDetails, listCustomers } from "./customer.service";

export async function getCustomers(
  request: Request,
  response: Response,
  next: NextFunction,
) {
  try {
    response.json(await listCustomers(request.query));
  } catch (error) {
    next(error);
  }
}

export async function getCustomer(
  request: Request,
  response: Response,
  next: NextFunction,
) {
  try {
    response.json(await getCustomerDetails(String(request.params.id)));
  } catch (error) {
    next(error);
  }
}
