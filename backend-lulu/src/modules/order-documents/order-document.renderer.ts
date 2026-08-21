import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import PDFDocument from "pdfkit";
import sharp from "sharp";
import type { OrderItemRecord, OrderStatus } from "../orders/order.model";
import {
  CLOTHING_SIZE_LABELS,
  DEFAULT_CLOTHING_SIZE,
} from "../products/product-size";
import { readStoredProductImage } from "../uploads/upload.service";

const COLORS = {
  burgundy: "#8C3B4A",
  burgundyDark: "#6F2837",
  navy: "#102D4F",
  gold: "#C7952D",
  cream: "#FBF6EE",
  creamDark: "#F2E8D9",
  text: "#2F2925",
  muted: "#756D66",
  border: "#E5D9CC",
  white: "#FFFFFF",
};
const PAGE_MARGIN = 42;
const CONTENT_WIDTH = 511;
const FOOTER_TOP = 765;

export type PurchaseOrderStoreConfig = {
  name: string;
  email: string;
  primaryPhone: string;
  secondaryPhone: string;
  whatsappNumber: string;
  addressLines: string[];
  logoUrl: string;
  footerText: string;
};

export type PurchaseOrderPdfInput = {
  number: string;
  orderReference: string;
  orderStatus: OrderStatus;
  orderDate: Date;
  generatedAt: Date;
  customerName: string;
  customerPhone: string;
  items: OrderItemRecord[];
  store: PurchaseOrderStoreConfig;
};

function formatCurrency(value: number) {
  return `${new Intl.NumberFormat("fr-FR")
    .format(value)
    .replace(/\u00a0|\u202f/g, " ")} FCFA`;
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "long",
    timeZone: "Africa/Porto-Novo",
  }).format(value);
}

function getStatusLabel(status: OrderStatus) {
  const labels: Record<OrderStatus, string> = {
    pending: "En attente",
    confirmed: "Confirmée",
    cancelled: "Annulée",
    completed: "Terminée",
    expired: "Expirée",
  };

  return labels[status];
}

function getKnownTotal(items: OrderItemRecord[]) {
  return items.reduce(
    (total, item) => total + (item.unitPrice ?? 0) * item.quantity,
    0,
  );
}

function hasUnknownPrice(items: OrderItemRecord[]) {
  return items.some(
    (item) => item.unitPrice === null || item.unitPrice === undefined,
  );
}

function getItemSizeLabel(item: OrderItemRecord) {
  return CLOTHING_SIZE_LABELS[item.size ?? DEFAULT_CLOTHING_SIZE];
}

async function loadLogo(reference: string) {
  if (reference) {
    const storedImage = await readStoredProductImage(reference);

    if (storedImage) {
      return sharp(storedImage).png().toBuffer();
    }
  }

  const publicReference = reference.startsWith("/images/")
    ? reference.replace(/^\//, "")
    : "";
  const candidates = [
    ...(publicReference
      ? [
          resolve(process.cwd(), `../lulu_shop_front/public/${publicReference}`),
          resolve(process.cwd(), `public/${publicReference}`),
        ]
      : []),
    resolve(process.cwd(), "assets/logo.png"),
    resolve(process.cwd(), "../images/logo.png"),
    resolve(process.cwd(), "images/logo.png"),
    resolve(process.cwd(), "../lulu_shop_front/public/images/logo.png"),
    resolve(__dirname, "../../../../images/logo.png"),
  ];

  for (const candidate of candidates) {
    try {
      return await readFile(candidate);
    } catch {
      // Le monogramme de secours permet de générer le document hors monorepo.
    }
  }

  return null;
}

function drawLogo(
  document: PDFKit.PDFDocument,
  logo: Buffer | null,
  x: number,
  y: number,
) {
  document
    .save()
    .roundedRect(x, y, 66, 66, 14)
    .fill(COLORS.cream)
    .restore();

  if (logo) {
    document.image(logo, x + 7, y + 7, {
      fit: [52, 52],
      align: "center",
      valign: "center",
    });
    return;
  }

  document
    .fillColor(COLORS.burgundy)
    .font("Helvetica-Bold")
    .fontSize(21)
    .text("TL", x, y + 21, { width: 66, align: "center" });
}

function drawHeader(
  document: PDFKit.PDFDocument,
  input: PurchaseOrderPdfInput,
  logo: Buffer | null,
) {
  drawLogo(document, logo, PAGE_MARGIN, 34);

  document
    .fillColor(COLORS.navy)
    .font("Helvetica-Bold")
    .fontSize(15)
    .text(input.store.name, 120, 47, { width: 210 });
  document
    .fillColor(COLORS.muted)
    .font("Helvetica")
    .fontSize(8.5)
    .text(input.store.footerText || "Mode féminine sélectionnée avec soin", 120, 70, {
      width: 230,
    });

  document
    .fillColor(COLORS.burgundy)
    .font("Helvetica-Bold")
    .fontSize(19)
    .text("BON DE COMMANDE", 335, 42, {
      width: 218,
      align: "right",
    });
  document
    .fillColor(COLORS.text)
    .font("Helvetica-Bold")
    .fontSize(10)
    .text(input.number, 335, 72, { width: 218, align: "right" });

  document
    .moveTo(PAGE_MARGIN, 113)
    .lineTo(PAGE_MARGIN + CONTENT_WIDTH, 113)
    .lineWidth(1.2)
    .strokeColor(COLORS.gold)
    .stroke();
}

function drawInfoBox(
  document: PDFKit.PDFDocument,
  input: PurchaseOrderPdfInput,
) {
  const y = 130;
  document
    .save()
    .roundedRect(PAGE_MARGIN, y, CONTENT_WIDTH, 72, 10)
    .fill(COLORS.cream)
    .restore();

  const entries = [
    ["Référence commande", input.orderReference],
    ["Date de la commande", formatDate(input.orderDate)],
    ["Date du bon", formatDate(input.generatedAt)],
    ["Statut", getStatusLabel(input.orderStatus)],
  ];

  entries.forEach(([label, value], index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    const x = PAGE_MARGIN + 16 + column * 251;
    const entryY = y + 13 + row * 31;

    document
      .fillColor(COLORS.muted)
      .font("Helvetica-Bold")
      .fontSize(7)
      .text(label.toUpperCase(), x, entryY, { width: 220 });
    document
      .fillColor(COLORS.text)
      .font("Helvetica")
      .fontSize(9)
      .text(value, x, entryY + 11, { width: 220 });
  });
}

function drawCustomerBox(
  document: PDFKit.PDFDocument,
  input: PurchaseOrderPdfInput,
) {
  const y = 216;

  document
    .fillColor(COLORS.burgundy)
    .font("Helvetica-Bold")
    .fontSize(8)
    .text("CLIENTE", PAGE_MARGIN, y);
  document
    .moveTo(PAGE_MARGIN, y + 14)
    .lineTo(PAGE_MARGIN + CONTENT_WIDTH, y + 14)
    .lineWidth(0.7)
    .strokeColor(COLORS.border)
    .stroke();
  document
    .fillColor(COLORS.text)
    .font("Helvetica-Bold")
    .fontSize(10)
    .text(input.customerName, PAGE_MARGIN, y + 24, { width: 300 });
  document
    .fillColor(COLORS.muted)
    .font("Helvetica")
    .fontSize(9)
    .text(input.customerPhone, 360, y + 24, {
      width: 193,
      align: "right",
    });
}

const TABLE_COLUMNS = [
  { label: "Produit", x: 42, width: 150, align: "left" as const },
  { label: "Couleur", x: 192, width: 72, align: "left" as const },
  { label: "Taille", x: 264, width: 55, align: "center" as const },
  { label: "Qté", x: 319, width: 35, align: "center" as const },
  { label: "Prix unitaire", x: 354, width: 90, align: "right" as const },
  { label: "Sous-total", x: 444, width: 109, align: "right" as const },
];

function drawTableHeader(document: PDFKit.PDFDocument, y: number) {
  document
    .save()
    .rect(PAGE_MARGIN, y, CONTENT_WIDTH, 27)
    .fill(COLORS.burgundy)
    .restore();

  TABLE_COLUMNS.forEach((column) => {
    document
      .fillColor(COLORS.white)
      .font("Helvetica-Bold")
      .fontSize(7.2)
      .text(column.label.toUpperCase(), column.x + 7, y + 9, {
        width: column.width - 14,
        align: column.align,
      });
  });

  return y + 27;
}

function drawContinuationHeader(
  document: PDFKit.PDFDocument,
  input: PurchaseOrderPdfInput,
) {
  document
    .fillColor(COLORS.burgundy)
    .font("Helvetica-Bold")
    .fontSize(12)
    .text("BON DE COMMANDE", PAGE_MARGIN, 40);
  document
    .fillColor(COLORS.muted)
    .font("Helvetica")
    .fontSize(8)
    .text(`${input.number} - suite`, 300, 42, {
      width: 253,
      align: "right",
    });
  document
    .moveTo(PAGE_MARGIN, 63)
    .lineTo(PAGE_MARGIN + CONTENT_WIDTH, 63)
    .lineWidth(0.8)
    .strokeColor(COLORS.gold)
    .stroke();

  return drawTableHeader(document, 78);
}

function getRowHeight(document: PDFKit.PDFDocument, item: OrderItemRecord) {
  document.font("Helvetica").fontSize(8.5);
  const productHeight = document.heightOfString(item.name, {
    width: TABLE_COLUMNS[0].width - 14,
  });
  const colorHeight = document.heightOfString(item.colorName || "Non précisée", {
    width: TABLE_COLUMNS[1].width - 14,
  });
  const sizeHeight = document.heightOfString(getItemSizeLabel(item), {
    width: TABLE_COLUMNS[2].width - 14,
  });

  return Math.max(
    34,
    Math.ceil(Math.max(productHeight, colorHeight, sizeHeight) + 16),
  );
}

function drawTableRow(
  document: PDFKit.PDFDocument,
  item: OrderItemRecord,
  y: number,
  height: number,
  index: number,
) {
  if (index % 2 === 0) {
    document
      .save()
      .rect(PAGE_MARGIN, y, CONTENT_WIDTH, height)
      .fill("#FDFBF8")
      .restore();
  }

  document
    .moveTo(PAGE_MARGIN, y + height)
    .lineTo(PAGE_MARGIN + CONTENT_WIDTH, y + height)
    .lineWidth(0.45)
    .strokeColor(COLORS.border)
    .stroke();

  const unitPrice = item.unitPrice;
  const values = [
    item.name,
    item.colorName || "Non précisée",
    getItemSizeLabel(item),
    String(item.quantity),
    unitPrice === null || unitPrice === undefined
      ? "À confirmer"
      : formatCurrency(unitPrice),
    unitPrice === null || unitPrice === undefined
      ? "À confirmer"
      : formatCurrency(unitPrice * item.quantity),
  ];

  TABLE_COLUMNS.forEach((column, columnIndex) => {
    document
      .fillColor(columnIndex === 0 ? COLORS.text : COLORS.muted)
      .font(columnIndex === 0 ? "Helvetica-Bold" : "Helvetica")
      .fontSize(columnIndex >= 3 ? 7.7 : 8.2)
      .text(values[columnIndex], column.x + 7, y + 10, {
        width: column.width - 14,
        align: column.align,
      });
  });
}

function drawTotals(
  document: PDFKit.PDFDocument,
  input: PurchaseOrderPdfInput,
  y: number,
) {
  const unknownPrices = hasUnknownPrice(input.items);
  const knownTotal = getKnownTotal(input.items);
  const boxX = 319;
  const boxWidth = 234;

  document
    .save()
    .roundedRect(boxX, y, boxWidth, 58, 9)
    .fill(COLORS.creamDark)
    .restore();
  document
    .fillColor(COLORS.muted)
    .font("Helvetica-Bold")
    .fontSize(7.5)
    .text("MONTANT TOTAL", boxX + 15, y + 13, { width: 100 });
  document
    .fillColor(COLORS.burgundyDark)
    .font("Helvetica-Bold")
    .fontSize(12.5)
    .text(unknownPrices ? "À confirmer" : formatCurrency(knownTotal), boxX + 105, y + 11, {
      width: boxWidth - 120,
      align: "right",
    });

  if (unknownPrices) {
    document
      .fillColor(COLORS.muted)
      .font("Helvetica")
      .fontSize(7)
      .text("Un ou plusieurs prix restent à valider.", boxX + 15, y + 36, {
        width: boxWidth - 30,
        align: "right",
      });
  }

  document
    .fillColor(COLORS.text)
    .font("Helvetica-Bold")
    .fontSize(9.5)
    .text("Merci pour votre confiance.", PAGE_MARGIN, y + 8, { width: 240 });
  document
    .fillColor(COLORS.muted)
    .font("Helvetica")
    .fontSize(7.5)
    .text("Ce bon de commande n'est pas une facture comptable.", PAGE_MARGIN, y + 26, {
      width: 245,
    });
}

function drawFooters(
  document: PDFKit.PDFDocument,
  input: PurchaseOrderPdfInput,
) {
  const range = document.bufferedPageRange();
  const address = input.store.addressLines.filter(Boolean).join(", ");
  const contact = [
    input.store.primaryPhone,
    input.store.secondaryPhone,
    `WhatsApp ${input.store.whatsappNumber}`,
    input.store.email,
  ]
    .filter(Boolean)
    .join(" | ");

  for (let index = range.start; index < range.start + range.count; index += 1) {
    document.switchToPage(index);
    document
      .moveTo(PAGE_MARGIN, FOOTER_TOP)
      .lineTo(PAGE_MARGIN + CONTENT_WIDTH, FOOTER_TOP)
      .lineWidth(0.6)
      .strokeColor(COLORS.border)
      .stroke();
    document
      .fillColor(COLORS.text)
      .font("Helvetica-Bold")
      .fontSize(7.2)
      .text(input.store.name, PAGE_MARGIN, FOOTER_TOP + 10, { width: 170 });
    document
      .fillColor(COLORS.muted)
      .font("Helvetica")
      .fontSize(6.4)
      .text(address, PAGE_MARGIN, FOOTER_TOP + 23, {
        width: 390,
        lineGap: 1,
      })
      .text(contact, PAGE_MARGIN, FOOTER_TOP + 42, { width: 455 });
    document
      .fillColor(COLORS.muted)
      .font("Helvetica-Bold")
      .fontSize(7)
      .text(`${index - range.start + 1} / ${range.count}`, 500, FOOTER_TOP + 42, {
        width: 53,
        align: "right",
      });
  }
}

export async function generatePurchaseOrderPdf(
  input: PurchaseOrderPdfInput,
) {
    const logo = await loadLogo(input.store.logoUrl);

  return new Promise<Buffer>((resolveBuffer, reject) => {
    const chunks: Buffer[] = [];
    const document = new PDFDocument({
      size: "A4",
      margins: {
        top: PAGE_MARGIN,
        right: PAGE_MARGIN,
        bottom: 18,
        left: PAGE_MARGIN,
      },
      bufferPages: true,
      info: {
        Title: `Bon de commande ${input.number}`,
        Author: input.store.name,
        Subject: `Commande ${input.orderReference}`,
        Creator: "Tata Lulu Shop",
      },
    });

    document.on("data", (chunk: Buffer) => chunks.push(chunk));
    document.once("error", reject);
    document.once("end", () => resolveBuffer(Buffer.concat(chunks)));

    drawHeader(document, input, logo);
    drawInfoBox(document, input);
    drawCustomerBox(document, input);

    document
      .fillColor(COLORS.burgundy)
      .font("Helvetica-Bold")
      .fontSize(8)
      .text("ARTICLES", PAGE_MARGIN, 270);
    let y = drawTableHeader(document, 286);

    input.items.forEach((item, index) => {
      const rowHeight = getRowHeight(document, item);

      if (y + rowHeight > FOOTER_TOP - 24) {
        document.addPage();
        y = drawContinuationHeader(document, input);
      }

      drawTableRow(document, item, y, rowHeight, index);
      y += rowHeight;
    });

    if (y + 78 > FOOTER_TOP - 18) {
      document.addPage();
      y = 84;
    } else {
      y += 16;
    }

    drawTotals(document, input, y);
    drawFooters(document, input);
    document.end();
  });
}
