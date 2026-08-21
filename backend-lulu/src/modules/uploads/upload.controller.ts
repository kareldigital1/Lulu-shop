import type { NextFunction, Request, Response } from "express";
import { AppError } from "../../utils/AppError";
import {
  deleteUnreferencedProductImage,
  storeProductImage,
  streamProductImage,
} from "./upload.service";

export async function postProductImage(
  request: Request,
  response: Response,
  next: NextFunction,
) {
  try {
    if (!request.file) {
      throw new AppError("Sélectionne une image à envoyer.", 400);
    }

    const image = await storeProductImage(request.file);
    response.status(201).json({ image });
  } catch (error) {
    next(error);
  }
}

export async function getProductImage(
  request: Request,
  response: Response,
  next: NextFunction,
) {
  try {
    await streamProductImage(
      String(request.params.id),
      response,
      request.get("If-None-Match"),
    );
  } catch (error) {
    next(error);
  }
}

export async function deleteProductImage(
  request: Request,
  response: Response,
  next: NextFunction,
) {
  try {
    const result = await deleteUnreferencedProductImage(
      String(request.params.id),
    );

    if (result === "referenced") {
      throw new AppError(
        "Cette image est encore utilisée par un produit ou une commande.",
        409,
      );
    }

    if (result === "missing") {
      throw new AppError("Image introuvable.", 404);
    }

    response.status(204).end();
  } catch (error) {
    next(error);
  }
}
