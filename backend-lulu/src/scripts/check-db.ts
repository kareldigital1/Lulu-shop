import mongoose from "mongoose";
import { connectToDatabase } from "../config/db";

async function checkDatabaseConnection() {
  try {
    await connectToDatabase();

    const databaseName = mongoose.connection.db?.databaseName ?? "inconnue";
    console.info(`Connexion MongoDB OK sur la base "${databaseName}".`);

    await mongoose.disconnect();
    console.info("Déconnexion MongoDB OK.");
  } catch (error) {
    console.error("Connexion MongoDB impossible.");

    if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error(error);
    }

    process.exit(1);
  }
}

void checkDatabaseConnection();
