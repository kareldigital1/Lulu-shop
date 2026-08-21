import type { Request, Response, NextFunction } from "express";
import {
  createProduct,
  deleteProduct,
  listAdminProducts,
  listProducts,
  restockProduct,
  updateProduct,
} from "./product.service";

export async function getProducts(_request: Request, response: Response, next: NextFunction) {
  try {
    const products = await listProducts();
    response.json(products);
  } catch (error) {
    next(error);
  }
}

export async function getAdminProducts(_request: Request, response: Response, next: NextFunction) {
  try {
    const products = await listAdminProducts();
    response.json(products);
  } catch (error) {
    next(error);
  }
}

export async function postProduct(request: Request, response: Response, next: NextFunction) {
  try {
    const product = await createProduct(request.body);
    response.status(201).json(product);
  } catch (error) {
    next(error);
  }
}

export async function patchProduct(request: Request, response: Response, next: NextFunction) {
  try {
    const product = await updateProduct(String(request.params.id), request.body);
    response.json(product);
  } catch (error) {
    next(error);
  }
}

export async function postProductRestock(
  request: Request,
  response: Response,
  next: NextFunction,
) {
  try {
    const product = await restockProduct(
      String(request.params.id),
      request.body,
    );
    response.json(product);
  } catch (error) {
    next(error);
  }
}

export async function removeProduct(request: Request, response: Response, next: NextFunction) {
  try {
    const product = await deleteProduct(String(request.params.id));
    response.json(product);
  } catch (error) {
    next(error);
  }
}
