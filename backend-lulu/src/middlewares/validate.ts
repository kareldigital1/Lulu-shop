import type { NextFunction, Request, Response } from "express";
import type { ZodType } from "zod";
import { AppError } from "../utils/AppError";

type ValidatedRequestData = {
  body?: unknown;
  params?: Record<string, string>;
  query?: Record<string, unknown>;
};

const TECHNICAL_VALIDATION_MESSAGE =
  /^(invalid|expected|required|too (small|big)|unrecognized|not multiple)/i;

function getPublicValidationMessage(message?: string) {
  const normalizedMessage = message?.trim();

  if (!normalizedMessage || TECHNICAL_VALIDATION_MESSAGE.test(normalizedMessage)) {
    return "Certaines informations saisies ne sont pas valides.";
  }

  return normalizedMessage;
}

export function validate(schema: ZodType) {
  return (request: Request, _response: Response, next: NextFunction): void => {
    const result = schema.safeParse({
      body: request.body,
      params: request.params,
      query: request.query,
    });

    if (!result.success) {
      next(
        new AppError(
          getPublicValidationMessage(result.error.issues[0]?.message),
          400,
        ),
      );
      return;
    }

    const validated = result.data as ValidatedRequestData;

    if (validated.body !== undefined) {
      request.body = validated.body;
    }

    if (validated.params !== undefined) {
      request.params = validated.params;
    }

    if (validated.query !== undefined) {
      Object.defineProperty(request, "query", {
        value: validated.query,
        configurable: true,
        enumerable: true,
        writable: false,
      });
    }

    next();
  };
}
