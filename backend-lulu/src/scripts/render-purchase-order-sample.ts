import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { generatePurchaseOrderPdf } from "../modules/order-documents/order-document.renderer";

async function main() {
  const outputDirectory = resolve(process.cwd(), "../output/pdf");
  const outputPath = resolve(
    outputDirectory,
    "bon-de-commande-exemple.pdf",
  );
  const pdf = await generatePurchaseOrderPdf({
    number: "BC-20260804-0001",
    orderReference: "TL-20260804-328593",
    orderStatus: "confirmed",
    orderDate: new Date("2026-08-04T09:30:00+01:00"),
    generatedAt: new Date("2026-08-04T10:05:00+01:00"),
    customerName: "Aïcha Kossou",
    customerPhone: "+229 01 97 00 00 00",
    items: [
      {
        lineId: "1",
        source: "catalog",
        name: "Robe de soirée Élégance",
        category: "Robes",
        colorName: "Bordeaux",
        colorHex: "#8C3B4A",
        size: "M",
        image: "",
        priceLabel: "5 000 FCFA",
        unitPrice: 5_000,
        quantity: 2,
      },
      {
        lineId: "2",
        source: "catalog",
        name: "Crop top Audace",
        category: "Hauts",
        colorName: "Bleu",
        colorHex: "#1E40AF",
        size: "S",
        image: "",
        priceLabel: "2 000 FCFA",
        unitPrice: 2_000,
        quantity: 1,
      },
      {
        lineId: "3",
        source: "manual",
        name: "Ceinture fine avec boucle dorée",
        category: "Accessoires",
        colorName: "Noir",
        colorHex: "#111111",
        size: "TU",
        image: "",
        priceLabel: "Prix à confirmer",
        unitPrice: null,
        quantity: 1,
      },
      {
        lineId: "4",
        source: "catalog",
        name: "Blazer structuré coupe longue",
        category: "Hauts",
        colorName: "Beige",
        colorHex: "#D8C4A3",
        size: "XL",
        image: "",
        priceLabel: "7 500 FCFA",
        unitPrice: 7_500,
        quantity: 1,
      },
    ],
    store: {
      name: "Tata Lulu Shop",
      email: "tatalulushop@gmail.com",
      primaryPhone: "+229 01 56 37 56 82",
      secondaryPhone: "+229 01 66 38 60 30",
      whatsappNumber: "+229 56 37 56 82",
      logoUrl: "/images/logo.png",
      footerText: "Merci pour votre confiance.",
      addressLines: [
        "Atrokpocodji, Carrefour Séminaire St Jean Eudes",
        "Rue en face Station Bénin pétro, cinquième boutique à droite",
        "Abomey-Calavi, Bénin",
      ],
    },
  });

  await mkdir(outputDirectory, { recursive: true });
  await writeFile(outputPath, pdf);
  console.log(outputPath);
}

main().catch((error) => {
  console.error("Génération de l'exemple PDF impossible.");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
