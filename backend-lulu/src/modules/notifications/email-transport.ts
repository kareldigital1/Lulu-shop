import nodemailer from "nodemailer";
import { env } from "../../config/env";
import { logger } from "../../utils/logger";

let mailTransport: ReturnType<typeof nodemailer.createTransport> | null | undefined;
let missingConfigurationWasLogged = false;

export function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[character] ?? character,
  );
}

export function getMailSender() {
  return env.GMAIL_USER ?? env.ADMIN_EMAIL;
}

export function getMailTransport() {
  if (mailTransport !== undefined) {
    return mailTransport;
  }

  const appPassword = env.GMAIL_APP_PASSWORD?.replace(/\s/g, "");

  if (!appPassword) {
    if (!missingConfigurationWasLogged) {
      logger.warn(
        "Notifications e-mail désactivées : ajoute GMAIL_APP_PASSWORD dans l'environnement du backend.",
      );
      missingConfigurationWasLogged = true;
    }

    mailTransport = null;
    return mailTransport;
  }

  mailTransport = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: getMailSender(),
      pass: appPassword,
    },
  });

  return mailTransport;
}
