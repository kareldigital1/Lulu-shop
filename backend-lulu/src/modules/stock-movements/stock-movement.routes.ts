import { Router } from "express";
import { authenticateAdmin } from "../../middlewares/authenticateAdmin";
import { validate } from "../../middlewares/validate";
import { getStockMovements } from "./stock-movement.controller";
import { listStockMovementsSchema } from "./stock-movement.validation";

const adminStockMovementRouter = Router();

adminStockMovementRouter.use(authenticateAdmin);
adminStockMovementRouter.get(
  "/",
  validate(listStockMovementsSchema),
  getStockMovements,
);

export { adminStockMovementRouter };
