import type { NextFunction, Request, Response } from "express";
import { AppError } from "../../utils/AppError";
import {
  getAdminStoreSettings,
  getHomepageStoreContent,
  updateAdminStoreSettings,
} from "./store.service";
import type { StoreSettingsInput } from "./store.validation";

export async function getHomepageContent(_request: Request, response: Response, next: NextFunction) {
  try {
    const store = await getHomepageStoreContent();

    if (!store) {
      throw new AppError("Le contenu de la boutique n'a pas encore été initialisé.", 404);
    }

    response.json(store);
  } catch (error) {
    next(error);
  }
}

export async function getAdminStoreContent(
  _request: Request,
  response: Response,
  next: NextFunction,
) {
  try {
    const store = await getAdminStoreSettings();

    if (!store) {
      throw new AppError("La boutique n'a pas encore été initialisée.", 404);
    }

    response.json(store);
  } catch (error) {
    next(error);
  }
}

export async function patchAdminStoreContent(
  request: Request,
  response: Response,
  next: NextFunction,
) {
  try {
    const store = await updateAdminStoreSettings(
      request.body as StoreSettingsInput,
    );

    if (!store) {
      throw new AppError("La boutique n'a pas encore été initialisée.", 404);
    }

    response.json(store);
  } catch (error) {
    next(error);
  }
}
