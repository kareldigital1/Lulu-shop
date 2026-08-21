import { Router } from "express";
import { authenticateAdmin } from "../../middlewares/authenticateAdmin";
import { validate } from "../../middlewares/validate";
import {
  getAdminProducts,
  getProducts,
  patchProduct,
  postProduct,
  postProductRestock,
  removeProduct,
} from "./product.controller";
import {
  createProductSchema,
  deleteProductSchema,
  restockProductSchema,
  updateProductSchema,
} from "./product.validation";

const productRouter = Router();
const adminProductRouter = Router();

productRouter.get("/", getProducts);
adminProductRouter.use(authenticateAdmin);
adminProductRouter.get("/", getAdminProducts);
adminProductRouter.post("/", validate(createProductSchema), postProduct);
adminProductRouter.post(
  "/:id/restock",
  validate(restockProductSchema),
  postProductRestock,
);
adminProductRouter.patch("/:id", validate(updateProductSchema), patchProduct);
adminProductRouter.delete(
  "/:id",
  validate(deleteProductSchema),
  removeProduct,
);

export { adminProductRouter, productRouter };
