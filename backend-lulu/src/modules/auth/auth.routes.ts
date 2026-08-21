import { Router } from "express";
import { authenticateAdmin } from "../../middlewares/authenticateAdmin";
import { loginRateLimiter } from "../../middlewares/rateLimiters";
import { validate } from "../../middlewares/validate";
import { monitorAuthentication } from "./auth-monitoring.middleware";
import { postAdminLogin, postAdminLogout } from "./auth.controller";
import { adminLoginSchema } from "./auth.validation";

const authRouter = Router();

authRouter.post(
  "/login",
  monitorAuthentication("login"),
  loginRateLimiter,
  validate(adminLoginSchema),
  postAdminLogin,
);
authRouter.post(
  "/logout",
  monitorAuthentication("logout"),
  authenticateAdmin,
  postAdminLogout,
);

export { authRouter };
