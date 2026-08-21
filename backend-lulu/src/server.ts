import { app } from "./app";
import { connectToDatabase } from "./config/db";
import { env } from "./config/env";
import { synchronizeCustomers } from "./modules/customers/customer.service";
import { ensureDefaultCategories } from "./modules/categories/category.service";
import {
  cleanupOldAdminNotifications,
  synchronizeAdminNotifications,
} from "./modules/admin-notifications/admin-notification.service";
import { expirePendingOrders } from "./modules/orders/order-expiration.service";
import { sendPendingOrderEmails } from "./modules/orders/order.service";
import {
  ensureProductDataMigrations,
  sendPendingLowStockAlerts,
} from "./modules/products/product.service";
import {
  cleanupOrphanProductImages,
  PRODUCT_IMAGE_ORPHAN_GRACE_PERIOD_MS,
} from "./modules/uploads/upload.service";
import { logger } from "./utils/logger";
import { registerProcessErrorHandlers } from "./utils/process-error-handlers";

const ORDER_EXPIRATION_CHECK_INTERVAL_MS = 15 * 60 * 1000;
const IMAGE_CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1_000;
const NOTIFICATION_CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1_000;

function reportBackgroundError(
  event: string,
  message: string,
  error: unknown,
) {
  logger.error(message, { event, error });
}

async function runOrderExpirationCheck() {
  const result = await expirePendingOrders();

  if (result.expiredCount > 0) {
    logger.info("Commandes en attente expirées automatiquement.", {
      event: "orders.expired",
      expiredCount: result.expiredCount,
      cutoff: result.cutoff,
    });
  }
}

async function runImageCleanup() {
  const result = await cleanupOrphanProductImages(
    PRODUCT_IMAGE_ORPHAN_GRACE_PERIOD_MS,
  );

  if (result.deletedFiles > 0) {
    logger.info("Images GridFS orphelines supprimées.", {
      event: "images.orphans_deleted",
      deletedFiles: result.deletedFiles,
      reclaimedBytes: result.reclaimedBytes,
    });
  }
}

async function bootstrap() {
  await connectToDatabase();
  await ensureDefaultCategories();
  await ensureProductDataMigrations();
  await synchronizeCustomers();
  await synchronizeAdminNotifications();
  await cleanupOldAdminNotifications();

  app.listen(env.PORT, () => {
    logger.info("Backend Lulu démarré.", {
      event: "server.started",
      port: env.PORT,
      environment: env.NODE_ENV,
    });
    void sendPendingLowStockAlerts().catch((error) => {
      reportBackgroundError(
        "stock.alert_check_failed",
        "Impossible de vérifier les alertes de stock en attente.",
        error,
      );
    });
    void runOrderExpirationCheck()
      .then(() => sendPendingOrderEmails())
      .catch((error) => {
        reportBackgroundError(
          "orders.startup_check_failed",
          "Impossible de vérifier les expirations ou les notifications de commande.",
          error,
        );
      });
    void runImageCleanup().catch((error) => {
      reportBackgroundError(
        "images.startup_cleanup_failed",
        "Impossible de nettoyer les images GridFS orphelines.",
        error,
      );
    });

    const expirationTimer = setInterval(() => {
      void runOrderExpirationCheck().catch((error) => {
        reportBackgroundError(
          "orders.expiration_check_failed",
          "Impossible de vérifier les commandes arrivées à expiration.",
          error,
        );
      });
    }, ORDER_EXPIRATION_CHECK_INTERVAL_MS);
    expirationTimer.unref();

    const imageCleanupTimer = setInterval(() => {
      void runImageCleanup().catch((error) => {
        reportBackgroundError(
          "images.cleanup_failed",
          "Impossible de nettoyer les images GridFS orphelines.",
          error,
        );
      });
    }, IMAGE_CLEANUP_INTERVAL_MS);
    imageCleanupTimer.unref();

    const notificationCleanupTimer = setInterval(() => {
      void cleanupOldAdminNotifications().catch((error) => {
        reportBackgroundError(
          "notifications.cleanup_failed",
          "Impossible de nettoyer les anciennes notifications.",
          error,
        );
      });
    }, NOTIFICATION_CLEANUP_INTERVAL_MS);
    notificationCleanupTimer.unref();
  });
}

registerProcessErrorHandlers();

bootstrap().catch((error) => {
  logger.fatal("Impossible de démarrer le backend.", {
    event: "server.startup_failed",
    error,
  });
  logger.flush();
  process.exit(1);
});
