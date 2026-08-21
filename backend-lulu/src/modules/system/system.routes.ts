import { Router } from "express";
import { authenticateAdmin } from "../../middlewares/authenticateAdmin";
import { getSystemStatus } from "./system.controller";

export const adminSystemRouter = Router();

adminSystemRouter.use(authenticateAdmin);
adminSystemRouter.get("/status", getSystemStatus);
