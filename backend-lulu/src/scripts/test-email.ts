import { sendLowStockEmail } from "../modules/notifications/low-stock-email.service";
import { logger } from "../utils/logger";

async function testEmail() {
  const wasSent = await sendLowStockEmail({
    name: "Test de notification",
    slug: "test-notification",
    stock: 3,
    variants: [
      {
        id: "test",
        colorName: "Couleur test",
        colorHex: "#8C3B4A",
        images: [],
        sizes: [{ size: "M", stock: 3 }],
        stock: 3,
      },
    ],
  });

  if (!wasSent) {
    throw new Error(
      "Envoi désactivé. Ajoute GMAIL_APP_PASSWORD dans backend-lulu/.env.",
    );
  }

  logger.info("E-mail de test envoyé avec succès.");
}

testEmail().catch((error) => {
  logger.error("Impossible d'envoyer l'e-mail de test.", error);
  process.exitCode = 1;
});
