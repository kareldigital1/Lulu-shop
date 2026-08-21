import mongoose from "mongoose";
import { env } from "./env";
import { logger } from "../utils/logger";

let connectionPromise: Promise<void> | null = null;
let listenersAreRegistered = false;
let isIntentionalDisconnect = false;

function registerDatabaseLoggers() {
  if (listenersAreRegistered) {
    return;
  }

  listenersAreRegistered = true;

  mongoose.connection.on("connected", () => {
    isIntentionalDisconnect = false;
    logger.info("Connexion MongoDB établie.", {
      event: "database.connected",
      database: mongoose.connection.db?.databaseName ?? "inconnue",
    });
  });

  mongoose.connection.on("reconnected", () => {
    logger.info("Connexion MongoDB rétablie.", {
      event: "database.reconnected",
      database: mongoose.connection.db?.databaseName ?? "inconnue",
    });
  });

  mongoose.connection.on("disconnecting", () => {
    isIntentionalDisconnect = true;
  });

  mongoose.connection.on("disconnected", () => {
    const logDetails = {
      event: "database.disconnected",
      intentional: isIntentionalDisconnect,
    };

    if (isIntentionalDisconnect) {
      logger.info("Connexion MongoDB fermée.", logDetails);
    } else {
      logger.warn("Connexion MongoDB interrompue.", logDetails);
    }

    isIntentionalDisconnect = false;
  });

  mongoose.connection.on("error", (error) => {
    logger.error("Erreur de connexion MongoDB.", {
      event: "database.error",
      error,
    });
  });
}

export async function connectToDatabase(): Promise<void> {
  registerDatabaseLoggers();

  if (mongoose.connection.readyState === 1) {
    return;
  }

  if (connectionPromise) {
    return connectionPromise;
  }

  logger.info("Connexion MongoDB en cours.", {
    event: "database.connecting",
  });

  connectionPromise = mongoose
    .connect(env.MONGO_URI)
    .then(() => undefined)
    .finally(() => {
      connectionPromise = null;
    });

  return connectionPromise;
}
