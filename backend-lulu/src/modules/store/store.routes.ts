import { Router } from "express";
import { authenticateAdmin } from "../../middlewares/authenticateAdmin";
import { validate } from "../../middlewares/validate";
import {
  getAdminStoreContent,
  getHomepageContent,
  patchAdminStoreContent,
} from "./store.controller";
import { updateStoreSettingsSchema } from "./store.validation";

const storeRouter = Router();
const adminStoreRouter = Router();

storeRouter.get("/homepage", getHomepageContent);
adminStoreRouter.use(authenticateAdmin);
adminStoreRouter.get("/", getAdminStoreContent);
adminStoreRouter.patch(
  "/",
  validate(updateStoreSettingsSchema),
  patchAdminStoreContent,
);

export { adminStoreRouter, storeRouter };
