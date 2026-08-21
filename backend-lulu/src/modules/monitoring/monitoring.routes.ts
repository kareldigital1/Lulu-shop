import { Router } from "express";
import { getHealth, getReadiness } from "./monitoring.controller";

const monitoringRouter = Router();

monitoringRouter.get("/health", getHealth);
monitoringRouter.get("/ready", getReadiness);

export { monitoringRouter };
