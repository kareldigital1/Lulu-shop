import { env } from "../../config/env";
import { logger } from "../../utils/logger";
import type { OrderItemRecord, OrderRecord } from "../orders/order.model";
import {
  CLOTHING_SIZE_LABELS,
  DEFAULT_CLOTHING_SIZE,
} from "../products/product-size";
import {
  escapeHtml,
  getMailSender,
  getMailTransport,
} from "./email-transport";

type NewOrderEmail = Pick<
  OrderRecord,
  "reference" | "customerName" | "customerPhone" | "note" | "items"
>;

function formatItem(item: OrderItemRecord) {
  const color = item.colorName ? ` — ${item.colorName}` : "";
  const size = ` — ${CLOTHING_SIZE_LABELS[item.size ?? DEFAULT_CLOTHING_SIZE]}`;
  return `${item.quantity} × ${item.name}${color}${size} — ${item.priceLabel}`;
}

function buildItemsHtml(items: OrderItemRecord[]) {
  return items
    .map(
      (item) => `
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #eaded5;">
            <strong>${escapeHtml(item.name)}</strong>
            ${item.colorName ? `<br><span style="color:#736861;">${escapeHtml(item.colorName)}</span>` : ""}
            <br><span style="color:#736861;">Taille : ${escapeHtml(CLOTHING_SIZE_LABELS[item.size ?? DEFAULT_CLOTHING_SIZE])}</span>
          </td>
          <td style="padding:12px 10px;border-bottom:1px solid #eaded5;text-align:center;">${item.quantity}</td>
          <td style="padding:12px 0;border-bottom:1px solid #eaded5;text-align:right;">${escapeHtml(item.priceLabel)}</td>
        </tr>
      `,
    )
    .join("");
}

export async function sendNewOrderEmail(order: NewOrderEmail) {
  const transport = getMailTransport();

  if (!transport) {
    return false;
  }

  const recipient = env.ORDER_NOTIFICATION_EMAIL ?? env.LOW_STOCK_EMAIL;
  const adminUrl = `${env.FRONTEND_URL.replace(/\/$/, "")}/admin`;
  const whatsappNumber = order.customerPhone.replace(/\D/g, "");
  const whatsappUrl = whatsappNumber
    ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
        `Bonjour ${order.customerName}, concernant votre commande ${order.reference}...`,
      )}`
    : adminUrl;
  const itemCount = order.items.reduce(
    (total, item) => total + item.quantity,
    0,
  );

  await transport.sendMail({
    from: `"${env.MAIL_FROM_NAME}" <${getMailSender()}>`,
    to: recipient,
    subject: `[Nouvelle commande] ${order.reference} — ${order.customerName}`,
    text: [
      "Nouvelle commande Tata Lulu Shop",
      "",
      `Référence : ${order.reference}`,
      `Cliente : ${order.customerName}`,
      `WhatsApp : ${order.customerPhone}`,
      `Articles : ${itemCount}`,
      "",
      ...order.items.map(formatItem),
      ...(order.note ? ["", `Note : ${order.note}`] : []),
      "",
      `Ouvrir le backoffice : ${adminUrl}`,
    ].join("\n"),
    html: `
      <div style="margin:0;padding:32px 16px;background:#f7f3ec;font-family:Arial,sans-serif;color:#2c2522;">
        <div style="max-width:620px;margin:0 auto;overflow:hidden;border:1px solid #eaded5;border-radius:16px;background:#ffffff;">
          <div style="padding:22px 26px;background:#8c3b4a;color:#ffffff;">
            <p style="margin:0 0 5px;font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">Tata Lulu Shop</p>
            <h1 style="margin:0;font-size:23px;line-height:1.25;">Nouvelle commande</h1>
          </div>
          <div style="padding:26px;">
            <p style="margin:0 0 4px;color:#8c3b4a;font-size:13px;font-weight:700;text-transform:uppercase;">Référence</p>
            <p style="margin:0 0 22px;font-size:24px;font-weight:700;">${escapeHtml(order.reference)}</p>

            <div style="margin-bottom:22px;padding:16px;border-radius:12px;background:#fbf7f2;">
              <p style="margin:0 0 7px;"><strong>Cliente :</strong> ${escapeHtml(order.customerName)}</p>
              <p style="margin:0;"><strong>WhatsApp :</strong> ${escapeHtml(order.customerPhone)}</p>
            </div>

            <table role="presentation" style="width:100%;border-collapse:collapse;font-size:14px;">
              <thead>
                <tr style="color:#736861;font-size:12px;text-transform:uppercase;">
                  <th style="padding-bottom:8px;text-align:left;">Article</th>
                  <th style="padding:0 10px 8px;text-align:center;">Qté</th>
                  <th style="padding-bottom:8px;text-align:right;">Prix affiché</th>
                </tr>
              </thead>
              <tbody>${buildItemsHtml(order.items)}</tbody>
            </table>

            ${
              order.note
                ? `<div style="margin-top:20px;padding:14px 16px;border-left:3px solid #d3aa35;background:#fffaf0;"><strong>Note :</strong> ${escapeHtml(order.note)}</div>`
                : ""
            }

            <div style="margin-top:24px;">
              <a href="${escapeHtml(adminUrl)}" style="display:inline-block;margin:0 8px 8px 0;padding:12px 18px;border-radius:999px;background:#8c3b4a;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;">
                Ouvrir la commande
              </a>
              <a href="${escapeHtml(whatsappUrl)}" style="display:inline-block;padding:11px 18px;border:1px solid #8c3b4a;border-radius:999px;color:#8c3b4a;font-size:14px;font-weight:700;text-decoration:none;">
                Contacter la cliente
              </a>
            </div>
          </div>
        </div>
      </div>
    `,
  });

  logger.info(
    `Notification de commande envoyée à ${recipient} pour ${order.reference}.`,
  );

  return true;
}
