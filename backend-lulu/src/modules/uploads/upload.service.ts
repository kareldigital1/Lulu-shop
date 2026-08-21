import type { HttpDownloadTarget } from "../../utils/http-download-target";
import { GridFSBucket, ObjectId } from "mongodb";
import mongoose from "mongoose";
import sharp from "sharp";
import { AppError } from "../../utils/AppError";
import { logger } from "../../utils/logger";
import { OrderModel } from "../orders/order.model";
import { ProductModel } from "../products/product.model";
import { StoreModel } from "../store/store.model";

const PRODUCT_IMAGE_BUCKET = "productImages";
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const PRODUCT_IMAGE_PATH_PATTERN =
  /\/api\/uploads\/([a-f\d]{24})(?:$|[?#])/i;
const MAX_IMAGE_WIDTH = 1_600;
const MAX_IMAGE_HEIGHT = 2_000;
const WEBP_QUALITY = 82;
export const PRODUCT_IMAGE_ORPHAN_GRACE_PERIOD_MS = 24 * 60 * 60 * 1_000;

type StoredImageFile = {
  _id: ObjectId;
  length: number;
  uploadDate: Date;
  metadata?: {
    contentType?: string;
  };
};

type UploadedProductImage = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
};

export type ProductImageAudit = {
  referencedImages: number;
  storedFiles: number;
  storedBytes: number;
  storedChunks: number;
  orphanChunks: number;
  orphanFiles: Array<{
    id: string;
    bytes: number;
    uploadedAt: Date;
    eligibleForCleanup: boolean;
  }>;
  missingReferences: string[];
  contentTypes: Record<string, number>;
};

function detectImageContentType(buffer: Buffer) {
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return "image/jpeg";
  }

  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    )
  ) {
    return "image/png";
  }

  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }

  return null;
}

function getProductImageBucket() {
  const database = mongoose.connection.db;

  if (!database) {
    throw new AppError("La base de données n'est pas disponible.", 503);
  }

  return new GridFSBucket(database, {
    bucketName: PRODUCT_IMAGE_BUCKET,
  });
}

function getDatabase() {
  const database = mongoose.connection.db;

  if (!database) {
    throw new AppError("La base de données n'est pas disponible.", 503);
  }

  return database;
}

export function extractStoredProductImageId(reference: string) {
  const trimmedReference = reference.trim();

  if (/^[a-f\d]{24}$/i.test(trimmedReference)) {
    return trimmedReference.toLowerCase();
  }

  return (
    trimmedReference.match(PRODUCT_IMAGE_PATH_PATTERN)?.[1]?.toLowerCase() ??
    null
  );
}

export async function readStoredProductImage(reference: string) {
  const imageId = extractStoredProductImageId(reference);

  if (!imageId) {
    return null;
  }

  const bucket = getProductImageBucket();
  const chunks: Buffer[] = [];

  return new Promise<Buffer | null>((resolve, reject) => {
    const stream = bucket.openDownloadStream(new ObjectId(imageId));
    stream.on("data", (chunk: Buffer) => chunks.push(chunk));
    stream.once("error", (error: Error & { code?: string }) => {
      if (error.code === "ENOENT") {
        resolve(null);
        return;
      }
      reject(error);
    });
    stream.once("end", () => resolve(Buffer.concat(chunks)));
  });
}

function collectStoredProductImageIds(value: unknown, references: Set<string>) {
  if (typeof value === "string") {
    const imageId = extractStoredProductImageId(value);

    if (imageId) {
      references.add(imageId);
    }

    return;
  }

  if (Array.isArray(value)) {
    value.forEach((entry) => collectStoredProductImageIds(entry, references));
    return;
  }

  if (value && typeof value === "object") {
    Object.values(value as Record<string, unknown>).forEach((entry) =>
      collectStoredProductImageIds(entry, references),
    );
  }
}

async function getReferencedProductImageIds() {
  const references = new Set<string>();
  const [products, orders, stores] = await Promise.all([
    ProductModel.find()
      .select({ image: 1, "variants.images": 1 })
      .lean(),
    OrderModel.find()
      .select({ "items.image": 1 })
      .lean(),
    StoreModel.find()
      .select({
        logoUrl: 1,
        faviconUrl: 1,
        heroImageUrl: 1,
        openGraphImageUrl: 1,
        "pdfSettings.logoUrl": 1,
      })
      .lean(),
  ]);

  collectStoredProductImageIds(products, references);
  collectStoredProductImageIds(orders, references);
  collectStoredProductImageIds(stores, references);

  return references;
}

async function optimizeProductImage(file: UploadedProductImage) {
  try {
    return await sharp(file.buffer, {
      failOn: "warning",
      limitInputPixels: 40_000_000,
    })
      .rotate()
      .resize({
        width: MAX_IMAGE_WIDTH,
        height: MAX_IMAGE_HEIGHT,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({
        quality: WEBP_QUALITY,
        effort: 4,
        smartSubsample: true,
      })
      .toBuffer({ resolveWithObject: true });
  } catch {
    throw new AppError(
      "L'image est endommagée ou ne peut pas être traitée.",
      415,
    );
  }
}

export async function storeProductImage(file: UploadedProductImage) {
  const detectedContentType = detectImageContentType(file.buffer);

  if (!detectedContentType || detectedContentType !== file.mimetype) {
    throw new AppError(
      "Le contenu du fichier ne correspond pas à une image JPG, PNG ou WebP valide.",
      415,
    );
  }

  const optimizedImage = await optimizeProductImage(file);
  const bucket = getProductImageBucket();
  const baseName =
    file.originalname
      .replace(/\.[^.]+$/, "")
      .replace(/[^a-z0-9_-]+/gi, "-")
      .replace(/^-+|-+$/g, "") || "produit";
  const uploadStream = bucket.openUploadStream(`${baseName}.webp`, {
    metadata: {
      contentType: "image/webp",
      originalContentType: detectedContentType,
      originalBytes: file.buffer.length,
      optimizedBytes: optimizedImage.data.length,
      width: optimizedImage.info.width,
      height: optimizedImage.info.height,
      uploadedAt: new Date(),
      usage: "product",
    },
  });

  await new Promise<void>((resolve, reject) => {
    uploadStream.once("finish", resolve);
    uploadStream.once("error", reject);
    uploadStream.end(optimizedImage.data);
  });

  return `/api/uploads/${uploadStream.id.toString()}`;
}

export async function deleteUnreferencedProductImage(
  referenceOrId: string,
): Promise<"deleted" | "referenced" | "missing"> {
  const imageId = extractStoredProductImageId(referenceOrId);

  if (!imageId) {
    throw new AppError("Image introuvable.", 404);
  }

  const references = await getReferencedProductImageIds();

  if (references.has(imageId)) {
    return "referenced";
  }

  const fileId = new ObjectId(imageId);
  const bucket = getProductImageBucket();
  const file = await bucket.find({ _id: fileId }).limit(1).next();

  if (!file) {
    return "missing";
  }

  await bucket.delete(fileId);
  return "deleted";
}

export async function deleteUnreferencedProductImages(
  references: Iterable<string>,
) {
  const uniqueIds = new Set<string>();

  for (const reference of references) {
    const imageId = extractStoredProductImageId(reference);

    if (imageId) {
      uniqueIds.add(imageId);
    }
  }

  let deletedCount = 0;

  for (const imageId of uniqueIds) {
    try {
      if ((await deleteUnreferencedProductImage(imageId)) === "deleted") {
        deletedCount += 1;
      }
    } catch (error) {
      logger.warn("Une image devenue inutilisée n'a pas pu être supprimée.", {
        event: "images.cleanup_failed",
        imageId,
        error,
      });
    }
  }

  return deletedCount;
}

export async function auditProductImages(
  gracePeriodMs = PRODUCT_IMAGE_ORPHAN_GRACE_PERIOD_MS,
): Promise<ProductImageAudit> {
  const database = getDatabase();
  const references = await getReferencedProductImageIds();
  const files = await database
    .collection<StoredImageFile>(`${PRODUCT_IMAGE_BUCKET}.files`)
    .find({})
    .toArray();
  const storedIds = new Set(
    files.map((file) => file._id.toString().toLowerCase()),
  );
  const cutoff = Date.now() - gracePeriodMs;
  const contentTypes: Record<string, number> = {};

  for (const file of files) {
    const contentType = file.metadata?.contentType ?? "unknown";
    contentTypes[contentType] = (contentTypes[contentType] ?? 0) + 1;
  }

  const orphanFiles = files
    .filter((file) => !references.has(file._id.toString().toLowerCase()))
    .map((file) => ({
      id: file._id.toString(),
      bytes: file.length,
      uploadedAt: file.uploadDate,
      eligibleForCleanup: file.uploadDate.getTime() <= cutoff,
    }));
  const fileIds = files.map((file) => file._id);
  const chunksCollection = database.collection(
    `${PRODUCT_IMAGE_BUCKET}.chunks`,
  );

  return {
    referencedImages: references.size,
    storedFiles: files.length,
    storedBytes: files.reduce((total, file) => total + file.length, 0),
    storedChunks: await chunksCollection.countDocuments(),
    orphanChunks: await chunksCollection.countDocuments({
      files_id: { $nin: fileIds },
    }),
    orphanFiles,
    missingReferences: [...references].filter(
      (reference) => !storedIds.has(reference),
    ),
    contentTypes,
  };
}

export async function cleanupOrphanProductImages(
  gracePeriodMs = PRODUCT_IMAGE_ORPHAN_GRACE_PERIOD_MS,
) {
  const audit = await auditProductImages(gracePeriodMs);
  const eligibleOrphans = audit.orphanFiles.filter(
    (file) => file.eligibleForCleanup,
  );
  const bucket = getProductImageBucket();
  let deletedFiles = 0;
  let reclaimedBytes = 0;

  for (const file of eligibleOrphans) {
    try {
      await bucket.delete(new ObjectId(file.id));
      deletedFiles += 1;
      reclaimedBytes += file.bytes;
    } catch (error) {
      logger.warn("Une image orpheline n'a pas pu être supprimée.", {
        event: "images.orphan_cleanup_failed",
        imageId: file.id,
        error,
      });
    }
  }

  return {
    deletedFiles,
    reclaimedBytes,
    audit,
  };
}

export async function streamProductImage(
  id: string,
  response: HttpDownloadTarget,
  ifNoneMatch?: string,
) {
  if (!ObjectId.isValid(id)) {
    throw new AppError("Image introuvable.", 404);
  }

  const fileId = new ObjectId(id);
  const etag = `"${fileId.toString()}"`;

  response.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  response.setHeader("ETag", etag);

  if (
    ifNoneMatch
      ?.split(",")
      .map((value) => value.trim())
      .includes(etag)
  ) {
    response.status(304).end();
    return;
  }

  const bucket = getProductImageBucket();
  const file = await bucket.find({ _id: fileId }).limit(1).next();

  if (!file) {
    throw new AppError("Image introuvable.", 404);
  }

  const storedContentType =
    typeof file.metadata?.contentType === "string"
      ? file.metadata.contentType
      : "";
  const contentType = ALLOWED_IMAGE_TYPES.has(storedContentType)
    ? storedContentType
    : "application/octet-stream";

  response.setHeader("Content-Type", contentType);
  response.setHeader("Content-Length", file.length.toString());

  await new Promise<void>((resolve, reject) => {
    const downloadStream = bucket.openDownloadStream(fileId);
    downloadStream.once("error", reject);
    downloadStream.once("end", resolve);
    downloadStream.pipe(response);
  });
}
