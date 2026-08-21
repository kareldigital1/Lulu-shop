import type { HttpStreamTarget } from "../../utils/http-download-target";
import { GridFSBucket, ObjectId } from "mongodb";
import mongoose from "mongoose";
import { AppError } from "../../utils/AppError";
import { logger } from "../../utils/logger";
import { recordAuditEventSafely } from "../audit/audit-event.service";
import { OrderModel, type OrderRecord } from "../orders/order.model";
import { StoreModel } from "../store/store.model";
import { generatePurchaseOrderPdf } from "./order-document.renderer";
import { OrderDocumentSequenceModel } from "./order-document-sequence.model";

const ORDER_DOCUMENT_BUCKET = "orderDocuments";
const ORDER_DOCUMENT_TIME_ZONE = "Africa/Porto-Novo";
const MAX_DAILY_DOCUMENTS = 9_999;

type StoredOrderDocument = {
  _id: ObjectId;
  length: number;
  filename: string;
  metadata?: {
    contentType?: string;
  };
};

function getDatabase() {
  const database = mongoose.connection.db;

  if (!database) {
    throw new AppError("La base de données n'est pas disponible.", 503);
  }

  return database;
}

function getOrderDocumentBucket() {
  return new GridFSBucket(getDatabase(), {
    bucketName: ORDER_DOCUMENT_BUCKET,
  });
}

function getDatePart(value: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: ORDER_DOCUMENT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return `${values.year}${values.month}${values.day}`;
}

function isDuplicateKeyError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === 11000
  );
}

async function allocatePurchaseOrderNumber(now: Date) {
  const datePart = getDatePart(now);
  const key = `purchase-order:${datePart}`;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const sequence = await OrderDocumentSequenceModel.findOneAndUpdate(
        { key },
        {
          $inc: { value: 1 },
          $setOnInsert: { key },
        },
        { upsert: true, new: true },
      ).lean();

      if (!sequence || sequence.value > MAX_DAILY_DOCUMENTS) {
        throw new AppError(
          "La limite quotidienne des bons de commande est atteinte.",
          409,
        );
      }

      return `BC-${datePart}-${sequence.value.toString().padStart(4, "0")}`;
    } catch (error) {
      if (!isDuplicateKeyError(error) || attempt === 2) {
        throw error;
      }
    }
  }

  throw new AppError("Impossible de numéroter le bon de commande.", 500);
}

async function findStoredDocument(fileId: ObjectId) {
  return getOrderDocumentBucket()
    .find({ _id: fileId })
    .limit(1)
    .next() as Promise<StoredOrderDocument | null>;
}

async function storeDocument(
  buffer: Buffer,
  fileName: string,
  order: OrderRecord & { _id: ObjectId },
  purchaseOrderNumber: string,
) {
  const bucket = getOrderDocumentBucket();
  const uploadStream = bucket.openUploadStream(fileName, {
    contentType: "application/pdf",
    metadata: {
      contentType: "application/pdf",
      orderId: order._id,
      orderReference: order.reference,
      purchaseOrderNumber,
    },
  });

  return new Promise<ObjectId>((resolve, reject) => {
    uploadStream.once("error", reject);
    uploadStream.once("finish", () => resolve(uploadStream.id));
    uploadStream.end(buffer);
  });
}

async function deleteStoredDocumentSafely(fileId: ObjectId) {
  try {
    await getOrderDocumentBucket().delete(fileId);
  } catch (error) {
    logger.error("Impossible de supprimer un bon de commande GridFS orphelin.", {
      event: "order_document.orphan_cleanup_failed",
      fileId: String(fileId),
      error,
    });
  }
}

async function getStoreConfiguration() {
  const store = await StoreModel.findOne({ slug: "main-store" })
    .select(
      "name email primaryPhone secondaryPhone whatsappNumber locationSection.addressLines logoUrl pdfSettings",
    )
    .lean();

  if (!store) {
    throw new AppError(
      "La configuration de la boutique est requise pour générer le bon.",
      500,
    );
  }

  return {
    name: store.name,
    email: store.pdfSettings?.email || store.email,
    primaryPhone: store.pdfSettings?.phone || store.primaryPhone,
    secondaryPhone: store.pdfSettings?.phone ? "" : store.secondaryPhone,
    whatsappNumber: store.whatsappNumber,
    addressLines: store.pdfSettings?.address
      ? [store.pdfSettings.address]
      : store.locationSection.addressLines,
    logoUrl: store.pdfSettings?.logoUrl || store.logoUrl || "",
    footerText: store.pdfSettings?.footerText || "",
  };
}

async function clearMissingDocumentAssociation(
  orderId: ObjectId,
  fileId: ObjectId,
) {
  await OrderModel.updateOne(
    { _id: orderId, "purchaseOrder.fileId": fileId },
    { $set: { purchaseOrder: null } },
  );
}

export async function ensureOrderPurchaseOrder(id: string) {
  if (!ObjectId.isValid(id)) {
    throw new AppError("Commande introuvable.", 404);
  }

  let order = await OrderModel.findById(id).lean();

  if (!order) {
    throw new AppError("Commande introuvable.", 404);
  }

  if (!order.items.length) {
    throw new AppError("La commande ne contient aucun article.", 409);
  }

  if (order.status !== "confirmed" && order.status !== "completed") {
    throw new AppError(
      "Le bon de commande est disponible après confirmation.",
      409,
    );
  }

  const previousNumber = order.purchaseOrder?.number;

  if (order.purchaseOrder?.fileId) {
    const storedDocument = await findStoredDocument(
      new ObjectId(String(order.purchaseOrder.fileId)),
    );

    if (storedDocument) {
      return order;
    }

    await clearMissingDocumentAssociation(
      new ObjectId(String(order._id)),
      new ObjectId(String(order.purchaseOrder.fileId)),
    );
    order = await OrderModel.findById(id).lean();

    if (!order) {
      throw new AppError("Commande introuvable.", 404);
    }
  }

  const generatedAt = new Date();
  const purchaseOrderNumber =
    previousNumber ?? (await allocatePurchaseOrderNumber(generatedAt));
  const fileName = `bon-de-commande-${purchaseOrderNumber}.pdf`;
  const store = await getStoreConfiguration();
  const pdfBuffer = await generatePurchaseOrderPdf({
    number: purchaseOrderNumber,
    orderReference: order.reference,
    orderStatus: order.status,
    orderDate: order.confirmedAt ?? order.createdAt,
    generatedAt,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    items: order.items,
    store,
  });
  const fileId = await storeDocument(
    pdfBuffer,
    fileName,
    order as OrderRecord & { _id: ObjectId },
    purchaseOrderNumber,
  );

  try {
    const updatedOrder = await OrderModel.findOneAndUpdate(
      {
        _id: order._id,
        purchaseOrder: null,
        status: { $in: ["confirmed", "completed"] },
      },
      {
        $set: {
          purchaseOrder: {
            number: purchaseOrderNumber,
            fileId,
            fileName,
            generatedAt,
          },
        },
      },
      { new: true },
    ).lean();

    if (!updatedOrder) {
      const concurrentOrder = await OrderModel.findById(id).lean();

      if (concurrentOrder?.purchaseOrder?.fileId) {
        await deleteStoredDocumentSafely(fileId);
        return concurrentOrder;
      }

      throw new AppError(
        "Le bon n'a pas pu être associé à la commande.",
        409,
      );
    }

    await recordAuditEventSafely({
      action: "order.document_generated",
      actor: "system",
      resource: "order",
      resourceId: String(updatedOrder._id),
      resourceLabel: updatedOrder.reference,
      summary: `Bon de commande ${purchaseOrderNumber} généré.`,
      details: {
        purchaseOrderNumber,
        fileId: String(fileId),
        fileName,
        bytes: pdfBuffer.length,
      },
    });

    return updatedOrder;
  } catch (error) {
    await deleteStoredDocumentSafely(fileId);
    throw error;
  }
}

export async function ensureOrderPurchaseOrderSafely(id: string) {
  try {
    return await ensureOrderPurchaseOrder(id);
  } catch (error) {
    logger.error("Impossible de générer automatiquement le bon de commande.", {
      event: "order_document.auto_generation_failed",
      orderId: id,
      error,
    });
    return null;
  }
}

export async function streamOrderPurchaseOrder(
  id: string,
  response: HttpStreamTarget,
) {
  if (!ObjectId.isValid(id)) {
    throw new AppError("Commande introuvable.", 404);
  }

  const order = await OrderModel.findById(id)
    .select("reference purchaseOrder")
    .lean();

  if (!order) {
    throw new AppError("Commande introuvable.", 404);
  }

  if (!order.purchaseOrder?.fileId) {
    throw new AppError(
      "Aucun bon de commande n'a encore été généré.",
      404,
    );
  }

  const fileId = new ObjectId(String(order.purchaseOrder.fileId));
  const file = await findStoredDocument(fileId);

  if (!file) {
    throw new AppError(
      "Le fichier du bon est introuvable. Génère-le à nouveau.",
      404,
    );
  }

  response.setHeader("Cache-Control", "private, no-store");
  response.setHeader("Content-Type", "application/pdf");
  response.setHeader("Content-Length", file.length.toString());
  response.setHeader(
    "Content-Disposition",
    `attachment; filename="${order.purchaseOrder.fileName}"`,
  );

  await new Promise<void>((resolve, reject) => {
    const downloadStream = getOrderDocumentBucket().openDownloadStream(fileId);
    downloadStream.once("error", reject);
    downloadStream.once("end", resolve);
    downloadStream.pipe(response);
  });

  return {
    orderId: String(order._id),
    orderReference: order.reference,
    purchaseOrderNumber: order.purchaseOrder.number,
    fileName: order.purchaseOrder.fileName,
    bytes: file.length,
  };
}
