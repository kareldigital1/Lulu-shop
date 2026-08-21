import { Router } from "express";
import { authenticateAdmin } from "../../middlewares/authenticateAdmin";
import { validate } from "../../middlewares/validate";
import { getCustomer, getCustomers } from "./customer.controller";
import {
  getCustomerSchema,
  listCustomersSchema,
} from "./customer.validation";

const adminCustomerRouter = Router();

adminCustomerRouter.use(authenticateAdmin);
adminCustomerRouter.get("/", validate(listCustomersSchema), getCustomers);
adminCustomerRouter.get("/:id", validate(getCustomerSchema), getCustomer);

export { adminCustomerRouter };
