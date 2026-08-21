import { logger } from "./logger";

let handlersAreRegistered = false;

export function registerProcessErrorHandlers() {
  if (handlersAreRegistered) {
    return;
  }

  handlersAreRegistered = true;

  process.once("uncaughtException", (error) => {
    logger.fatal("Exception non interceptée. Arrêt du serveur.", {
      event: "process.uncaught_exception",
      error,
    });
    logger.flush();
    process.exit(1);
  });

  process.once("unhandledRejection", (reason) => {
    logger.fatal("Promesse rejetée sans gestionnaire. Arrêt du serveur.", {
      event: "process.unhandled_rejection",
      error:
        reason instanceof Error
          ? reason
          : new Error(`Rejet non-Error : ${String(reason)}`),
    });
    logger.flush();
    process.exit(1);
  });
}
