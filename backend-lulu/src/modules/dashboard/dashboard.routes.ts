import { Router } from "express";
import { authenticateAdmin } from "../../middlewares/authenticateAdmin";
import { getAdminDashboard } from "./dashboard.controller";

export const adminDashboardRouter = Router();

adminDashboardRouter.use(authenticateAdmin);
adminDashboardRouter.get("/", getAdminDashboard);
