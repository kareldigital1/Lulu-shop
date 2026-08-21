import type { NextFunction, Request, Response } from "express";
import { createContactRequest } from "./contact-request.service";

export async function postContactRequest(request: Request, response: Response, next: NextFunction) {
  try {
    const contactRequest = await createContactRequest({
      name: request.body.name,
      email: request.body.email,
      phone: request.body.phone,
      message: request.body.message,
    });

    response.status(201).json({
      message: "Votre demande a bien été enregistrée.",
      id: contactRequest.id,
    });
  } catch (error) {
    next(error);
  }
}
