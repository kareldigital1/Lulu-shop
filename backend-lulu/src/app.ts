import cors from "cors";
import express from "express";
import helmet from "helmet";
import { env } from "./config/env";
import { errorHandler } from "./middlewares/errorHandler";
import { requestLogger } from "./middlewares/requestLogger";
import { adminAuditEventRouter } from "./modules/audit/audit-event.routes";
import { authRouter } from "./modules/auth/auth.routes";
import { adminBackupRouter } from "./modules/backups/backup.routes";
import { contactRequestRouter } from "./modules/contact-requests/contact-request.routes";
import { adminCustomerRouter } from "./modules/customers/customer.routes";
import {
  adminCategoryRouter,
  categoryRouter,
} from "./modules/categories/category.routes";
import { adminDashboardRouter } from "./modules/dashboard/dashboard.routes";
import { adminNotificationRouter } from "./modules/admin-notifications/admin-notification.routes";
import { monitoringRouter } from "./modules/monitoring/monitoring.routes";
import { adminOrderRouter, orderRouter } from "./modules/orders/order.routes";
import { adminProductRouter, productRouter } from "./modules/products/product.routes";
import { storeRouter } from "./modules/store/store.routes";
import { adminStoreRouter } from "./modules/store/store.routes";
import { adminStockMovementRouter } from "./modules/stock-movements/stock-movement.routes";
import { adminSystemRouter } from "./modules/system/system.routes";
import { adminUploadRouter, uploadRouter } from "./modules/uploads/upload.routes";
import { AppError } from "./utils/AppError";

export const app = express();

if (env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

app.disable("x-powered-by");
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);

const allowedOrigins = new Set(
  [env.CORS_ORIGIN, env.FRONTEND_URL].map((origin) => new URL(origin).origin),
);

app.use(requestLogger);
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }

      callback(new AppError("Origine non autorisée.", 403));
    },
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type", "X-Request-Id"],
    exposedHeaders: ["Content-Disposition", "X-Request-Id"],
    maxAge: 600,
  }),
);

app.use(express.json({ limit: "100kb", strict: true }));

app.use("/api", monitoringRouter);
app.use("/api/store", storeRouter);
app.use("/api/categories", categoryRouter);
app.use("/api/products", productRouter);
app.use("/api/uploads", uploadRouter);
app.use("/api/contact-requests", contactRequestRouter);
app.use("/api/orders", orderRouter);
app.use("/api/auth", authRouter);
app.use("/api/admin/dashboard", adminDashboardRouter);
app.use("/api/admin/backups", adminBackupRouter);
app.use("/api/admin/customers", adminCustomerRouter);
app.use("/api/admin/categories", adminCategoryRouter);
app.use("/api/admin/notifications", adminNotificationRouter);
app.use("/api/admin/audit-events", adminAuditEventRouter);
app.use("/api/admin/orders", adminOrderRouter);
app.use("/api/admin/products", adminProductRouter);
app.use("/api/admin/stock-movements", adminStockMovementRouter);
app.use("/api/admin/store", adminStoreRouter);
app.use("/api/admin/system", adminSystemRouter);
app.use("/api/admin/uploads", adminUploadRouter);

app.use(errorHandler);
