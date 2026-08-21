import { Router } from "express";
import { publicWriteRateLimiter } from "../../middlewares/rateLimiters";
import { validate } from "../../middlewares/validate";
import { postContactRequest } from "./contact-request.controller";
import { createContactRequestSchema } from "./contact-request.validation";

const contactRequestRouter = Router();

contactRequestRouter.post(
  "/",
  publicWriteRateLimiter,
  validate(createContactRequestSchema),
  postContactRequest,
);

export { contactRequestRouter };
