import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PassThrough } from "node:stream";
import type { HttpStreamTarget } from "../utils/http-download-target";
import dotenv from "dotenv";

dotenv.config();
process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "silent";
process.env.GMAIL_APP_PASSWORD = "";
process.env.ORDER_NOTIFICATION_EMAIL = "";

const TEST_DATABASE_PREFIX = "tl_po_check_";

function createTestDatabaseName() {
  return `${TEST_DATABASE_PREFIX}${new Date()
    .toISOString()
    .replace(/\D/g, "")
    .slice(0, 14)}`;
}

function createStoreFixture() {
  return {
    slug: "main-store",
    name: "Tata Lulu Shop",
    seoTitle: "Tata Lulu Shop",
    seoDescription: "Boutique de vêtements pour femmes.",
    heroBadge: "Boutique",
    heroTitle: "Tata Lulu Shop",
    heroHighlight: "Mode féminine",
    heroDescription: "Sélection de vêtements.",
    heroStats: [],
    about: {
      title: "Notre histoire",
      subtitle: "Tata Lulu Shop",
      paragraphs: [],
      values: [],
    },
    productsSection: { title: "Produits", subtitle: "Catalogue" },
    benefitsSection: { title: "Avantages", subtitle: "Service", items: [] },
    testimonialsSection: {
      title: "Témoignages",
      subtitle: "Clientes",
      items: [],
    },
    faqSection: { title: "Questions", items: [] },
    locationSection: {
      subtitle: "Nous trouver",
      mapEmbedUrl: "https://maps.google.com",
      mapUrl: "https://maps.google.com",
      addressLines: ["Atrokpocodji", "Abomey-Calavi, Bénin"],
      openingHours: "Lundi au samedi",
      gps: { latitude: 6.387366, longitude: 2.321474 },
    },
    contactSection: {
      title: "Contact",
      subtitle: "Écrivez-nous",
      successMessage: "Message envoyé",
    },
    email: "tatalulushop@gmail.com",
    primaryPhone: "+229 01 56 37 56 82",
    secondaryPhone: "+229 01 66 38 60 30",
    whatsappNumber: "+229 56 37 56 82",
    whatsappUrl: "https://wa.me/22956375682",
    tiktokUrl: "https://www.tiktok.com/@tatalulu229",
    footerTagline: "Mode féminine",
    footerDescription: "Vêtements sélectionnés avec soin.",
    categories: [],
  };
}

export async function main() {
  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    throw new Error("MONGO_URI est requis pour le contrôle des bons.");
  }

  const databaseName = createTestDatabaseName();
  const mongoose = (await import("mongoose")).default;
  const { GridFSBucket } = await import("mongodb");
  const { CustomerModel } = await import(
    "../modules/customers/customer.model"
  );
  const { resolveLegacyCategory } = await import(
    "../modules/categories/category.service"
  );
  const { OrderDocumentSequenceModel } = await import(
    "../modules/order-documents/order-document-sequence.model"
  );
  const {
    ensureOrderPurchaseOrder,
    streamOrderPurchaseOrder,
  } = await import(
    "../modules/order-documents/order-document.service"
  );
  const { OrderModel } = await import("../modules/orders/order.model");
  const {
    completeAdminOrder,
    confirmAdminOrder,
    createOrder,
  } = await import("../modules/orders/order.service");
  const { ProductModel } = await import("../modules/products/product.model");
  const { StoreModel } = await import("../modules/store/store.model");
  let connected = false;

  try {
    await mongoose.connect(mongoUri, {
      dbName: databaseName,
      serverSelectionTimeoutMS: 15_000,
    });
    connected = true;
    console.log("[1/8] Connexion Atlas établie.");
    await Promise.all([
      CustomerModel.init(),
      OrderDocumentSequenceModel.init(),
      OrderModel.init(),
      ProductModel.init(),
      StoreModel.init(),
    ]);
    console.log("[2/8] Index MongoDB initialisés.");
    await StoreModel.create(createStoreFixture());
    const category = await resolveLegacyCategory("Robe");
    assert.ok(category);

    await ProductModel.create({
      slug: "audit-bon-commande",
      reference: "TLS-AUDIT-BC",
      categoryId: category._id,
      category: category.name,
      types: ["Robe de soirée"],
      name: "Robe Audit Bon",
      shortDescription: "Produit de contrôle.",
      description: "Produit temporaire pour le contrôle du bon.",
      benefits: [],
      priceLabel: "5 000 FCFA",
      priceAmount: 5_000,
      image: "",
      badge: "",
      whatsappMessage: "Audit bon",
      featured: false,
      order: 1,
      variants: [
        {
          id: "red",
          colorName: "Rouge",
           colorHex: "#FF0000",
           images: [],
           sizes: [
             { size: "M", stock: 12 },
             { size: "L", stock: 8 },
           ],
           stock: 20,
        },
      ],
      stock: 20,
      availability: "available",
      status: "published",
      isActive: true,
    });
    console.log("[3/8] Configuration et produit de contrôle créés.");

    const firstOrder = await createOrder({
      clientRequestId: randomUUID(),
      customerName: "Aïcha Test",
      customerPhone: "01 90 00 00 01",
      items: [
        {
          slug: "audit-bon-commande",
          variantId: "red",
          size: "M",
          quantity: 2,
        },
      ],
    });
    const firstConfirmed = await confirmAdminOrder(String(firstOrder._id));
    console.log("[4/8] Première commande confirmée.");
    assert.ok(firstConfirmed.purchaseOrder);
    assert.equal(firstConfirmed.items[0].size, "M");
    assert.match(
      firstConfirmed.purchaseOrder.number,
      /^BC-\d{8}-\d{4}$/,
    );

    const bucket = new GridFSBucket(mongoose.connection.db!, {
      bucketName: "orderDocuments",
    });
    assert.equal(await bucket.find({}).toArray().then((files) => files.length), 1);

    const idempotentOrder = await ensureOrderPurchaseOrder(
      String(firstOrder._id),
    );
    assert.equal(
      idempotentOrder.purchaseOrder?.number,
      firstConfirmed.purchaseOrder.number,
    );
    assert.equal(await bucket.find({}).toArray().then((files) => files.length), 1);
    console.log("[5/8] Idempotence vérifiée.");

    const secondOrder = await createOrder({
      clientRequestId: randomUUID(),
      customerName: "Mariam Test",
      customerPhone: "01 95 00 00 02",
      items: [
        {
          slug: "audit-bon-commande",
          variantId: "red",
          size: "L",
          quantity: 1,
        },
      ],
    });
    const secondConfirmed = await confirmAdminOrder(String(secondOrder._id));
    console.log("[6/8] Deuxième commande confirmée.");
    assert.ok(secondConfirmed.purchaseOrder);
    assert.notEqual(
      secondConfirmed.purchaseOrder.number,
      firstConfirmed.purchaseOrder.number,
    );
    assert.equal(await bucket.find({}).toArray().then((files) => files.length), 2);

    await completeAdminOrder(String(firstOrder._id));
    const firstCustomer = await CustomerModel.findOne({
      normalizedPhone: "2290190000001",
    }).lean();
    assert.ok(firstCustomer);
    assert.equal(firstCustomer.completedOrderCount, 1);
    assert.equal(firstCustomer.totalSpent, 10_000);
    console.log("[7/8] Cliente et statistiques vérifiées.");

    const chunks: Buffer[] = [];
    const headers = new Map<string, string>();
    const response = new PassThrough() as PassThrough & {
      setHeader(name: string, value: string): void;
    };
    response.setHeader = (name, value) => {
      headers.set(name.toLowerCase(), value);
    };
    response.on("data", (chunk: Buffer) => chunks.push(chunk));
    // Le faux flux satisfait le contrat du service : plus besoin de cast Express.
    const downloadTarget: HttpStreamTarget = response;
    const downloadResult = await streamOrderPurchaseOrder(
      String(firstOrder._id),
      downloadTarget,
    );
    const downloadedPdf = Buffer.concat(chunks);

    assert.equal(downloadedPdf.subarray(0, 4).toString("ascii"), "%PDF");
    assert.equal(headers.get("content-type"), "application/pdf");
    assert.match(
      headers.get("content-disposition") ?? "",
      /bon-de-commande-BC-\d{8}-\d{4}\.pdf/,
    );
    assert.equal(downloadResult.purchaseOrderNumber, firstConfirmed.purchaseOrder.number);
    console.log("[8/8] Téléchargement PDF vérifié.");

    console.log(
      JSON.stringify(
        {
          database: databaseName,
          premierBon: firstConfirmed.purchaseOrder.number,
          secondBon: secondConfirmed.purchaseOrder.number,
          fichiersGridFs: 2,
          idempotence: "vérifiée",
          creationCliente: "vérifiée",
          statistiquesCliente: "vérifiées",
          telechargementPdf: `${downloadedPdf.length} octets`,
        },
        null,
        2,
      ),
    );
    console.log("Contrôles des bons de commande réussis.");
  } finally {
    if (connected) {
      await mongoose.connection.db?.dropDatabase();
      await mongoose.disconnect();
    }
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error("Contrôle des bons de commande impossible.");
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
