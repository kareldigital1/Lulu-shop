import { Router } from "express";
import { authenticateAdmin } from "../../middlewares/authenticateAdmin";
import { getAdminCategories, getCategories } from "./category.controller";

const categoryRouter = Router();
const adminCategoryRouter = Router();

categoryRouter.get("/", getCategories);
adminCategoryRouter.use(authenticateAdmin);
adminCategoryRouter.get("/", getAdminCategories);

export { adminCategoryRouter, categoryRouter };
