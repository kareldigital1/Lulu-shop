import { env } from "../../config/env";
import type { ProductRecord } from "../products/product.model";
import {
  CLOTHING_SIZE_LABELS,
  DEFAULT_CLOTHING_SIZE,
} from "../products/product-size";
import { logger } from "../../utils/logger";
import {
  escapeHtml,
  getMailSender,
  getMailTransport,
} from "./email-transport";

export const LOW_STOCK_THRESHOLD = 4;

type LowStockProduct = Pick<ProductRecord, "name" | "slug" | "stock" | "variants">;

function formatStock(stock: number) {
  return stock === 1 ? "1 pièce" : `${stock} pièces`;
}

function buildVariantSummary(product: LowStockProduct) {
  if (product.variants.length === 0) {
    return "Aucune déclinaison renseignée.";
  }

  return product.variants
    .flatMap((variant) =>
      (variant.sizes?.length > 0
        ? variant.sizes
        : [{ size: DEFAULT_CLOTHING_SIZE, stock: variant.stock }]
      ).map(
        (entry) =>
          `${variant.colorName} / ${CLOTHING_SIZE_LABELS[entry.size]} : ${formatStock(entry.stock)}`,
      ),
    )
    .join("\n");
}

function buildVariantHtml(product: LowStockProduct) {
  if (product.variants.length === 0) {
    return "<p style=\"margin:0;color:#6f645e;\">Aucune déclinaison renseignée.</p>";
  }

  const items = product.variants
    .flatMap((variant) =>
      (variant.sizes?.length > 0
        ? variant.sizes
        : [{ size: DEFAULT_CLOTHING_SIZE, stock: variant.stock }]
      ).map(
        (entry) =>
          `<li style="margin:0 0 6px;">${escapeHtml(variant.colorName)} / ${escapeHtml(CLOTHING_SIZE_LABELS[entry.size])} : <strong>${formatStock(entry.stock)}</strong></li>`,
      ),
    )
    .join("");

  return `<ul style="margin:8px 0 0;padding-left:20px;color:#4b403b;">${items}</ul>`;
}

export function isLowStock(stock: number) {
  return stock < LOW_STOCK_THRESHOLD;
}

export async function sendLowStockEmail(product: LowStockProduct) {
  const transport = getMailTransport();

  if (!transport) {
    return false;
  }

  const stockLabel = formatStock(product.stock);
  const isOutOfStock = product.stock === 0;
  const subject = isOutOfStock
    ? `[Stock épuisé] ${product.name}`
    : `[Stock faible] ${product.name} : ${stockLabel} restantes`;
  const adminUrl = `${env.FRONTEND_URL.replace(/\/$/, "")}/admin`;
  const headline = isOutOfStock ? "Ce produit est épuisé" : "Le stock devient faible";
  const message = isOutOfStock
    ? `Le produit ${product.name} n'est plus disponible. Pensez à recharger son stock.`
    : `Il ne reste que ${stockLabel} pour le produit ${product.name}. Pensez à recharger son stock.`;

  await transport.sendMail({
    from: `"${env.MAIL_FROM_NAME}" <${getMailSender()}>`,
    to: env.LOW_STOCK_EMAIL,
    subject,
    text: [
      headline,
      "",
      message,
      "",
      "Stock par couleur et taille :",
      buildVariantSummary(product),
      "",
      `Gérer le produit : ${adminUrl}`,
    ].join("\n"),
    html: `
      <div style="margin:0;padding:32px 16px;background:#f7f3ec;font-family:Arial,sans-serif;color:#2c2522;">
        <div style="max-width:560px;margin:0 auto;overflow:hidden;border:1px solid #eaded5;border-radius:16px;background:#ffffff;">
          <div style="padding:22px 26px;background:#8c3b4a;color:#ffffff;">
            <p style="margin:0 0 5px;font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">Tata Lulu Shop</p>
            <h1 style="margin:0;font-size:23px;line-height:1.25;">${headline}</h1>
          </div>
          <div style="padding:26px;">
            <p style="margin:0 0 18px;font-size:16px;line-height:1.65;">${escapeHtml(message)}</p>
            <div style="margin:0 0 22px;padding:16px;border-radius:12px;background:#fbf7f2;">
              <p style="margin:0;color:#8c3b4a;font-size:13px;font-weight:700;text-transform:uppercase;">Stock total</p>
              <p style="margin:4px 0 14px;font-size:25px;font-weight:700;">${stockLabel}</p>
              <p style="margin:0;font-size:13px;font-weight:700;">Détail par couleur et taille</p>
              ${buildVariantHtml(product)}
            </div>
            <a href="${escapeHtml(adminUrl)}" style="display:inline-block;padding:12px 18px;border-radius:999px;background:#8c3b4a;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;">
              Ouvrir le backoffice
            </a>
          </div>
        </div>
      </div>
    `,
  });

  logger.info(
    `Alerte de stock envoyée à ${env.LOW_STOCK_EMAIL} pour ${product.name} (${product.stock}).`,
  );

  return true;
}
