import { Router } from "express";
import { authenticateAdmin } from "../../middlewares/authenticateAdmin";
import { adminBackupRateLimiter } from "../../middlewares/rateLimiters";
import {
  downloadJsonBackup,
  downloadMongoDbBackup,
} from "./backup.controller";

export const adminBackupRouter = Router();

adminBackupRouter.use(authenticateAdmin);
adminBackupRouter.get(
  "/json",
  adminBackupRateLimiter,
  downloadJsonBackup,
);
adminBackupRouter.get(
  "/mongodb",
  adminBackupRateLimiter,
  downloadMongoDbBackup,
);
