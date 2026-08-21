import mongoose from "mongoose";
import { env } from "../../config/env";

const DATA_STATES: Record<number, string> = {
  0: "Indisponibles",
  1: "Disponibles",
  2: "Vérification en cours",
  3: "Vérification en cours",
};

async function inspectDataAccess() {
  const database = mongoose.connection.db;

  if (!database || mongoose.connection.readyState !== 1) {
    return {
      ok: false,
      label: DATA_STATES[mongoose.connection.readyState] ?? "État inconnu",
    };
  }

  try {
    await database.command({ ping: 1 });
    return {
      ok: true,
      label: "Disponibles",
    };
  } catch {
    return {
      ok: false,
      label: "Indisponibles",
    };
  }
}

export async function getAdminSystemStatus() {
  const data = await inspectDataAccess();
  const emailsConfigured = Boolean(env.GMAIL_USER && env.GMAIL_APP_PASSWORD);

  return {
    checkedAt: new Date().toISOString(),
    services: {
      storefront: {
        ok: true,
        label: "Accessible",
      },
      data,
      emails: {
        ok: emailsConfigured,
        label: emailsConfigured ? "Prêts à l’envoi" : "Envoi indisponible",
      },
      backups: {
        ok: data.ok,
        label: data.ok ? "Disponibles" : "Indisponibles",
      },
    },
  };
}
