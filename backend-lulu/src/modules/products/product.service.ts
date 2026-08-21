import mongoose, { type HydratedDocument } from "mongoose";
import { env } from "../../config/env";
import { AppError } from "../../utils/AppError";
import { logger } from "../../utils/logger";
import { recordAuditEventSafely } from "../audit/audit-event.service";
import { synchronizeAdminNotificationsSafely } from "../admin-notifications/admin-notification.service";
import {
  getActiveCategory,
  resolveLegacyCategory,
} from "../categories/category.service";
import { normalizeCategoryValue } from "../categories/category.defaults";
import {
  isLowStock,
  LOW_STOCK_THRESHOLD,
  sendLowStockEmail,
} from "../notifications/low-stock-email.service";
import { OrderModel } from "../orders/order.model";
import { recordStockMovements } from "../stock-movements/stock-movement.service";
import { deleteUnreferencedProductImages } from "../uploads/upload.service";
import {
  buildProductReference,
  getAvailabilityFromStock,
  getPrimaryImageFromVariants,
  getStockFromVariantSizes,
  getStockFromVariants,
  MAX_VARIANT_STOCK,
  PRODUCT_STATUSES,
  ProductModel,
  type ProductRecord,
  type ProductSizeStockInput,
  type ProductStatus,
  type ProductVariantInput,
} from "./product.model";
import {
  DEFAULT_CLOTHING_SIZE,
  type ClothingSize,
} from "./product-size";
import { decorateProductBadge } from "./product-badge";
import {
  assertValidPromotion,
  decorateProductPricing,
  parsePriceAmount,
} from "./product-pricing";
import {
  EMPTY_PRODUCT_POPULARITY,
  rankProductPopularity,
  type ProductPopularity,
} from "./product-popularity";

type ProductVariantPayload = Omit<ProductVariantInput, "sizes"> & {
  sizes?: ProductSizeStockInput[];
};

type ProductInput = {
  slug: string;
  categoryId: string;
  category?: string;
  types: string[];
  name: string;
  shortDescription: string;
  description: string;
  benefits: string[];
  priceLabel: string;
  priceAmount?: number | null;
  promotionPrice?: number | null;
  promotionStartAt?: Date | null;
  promotionEndAt?: Date | null;
  image: string;
  badge?: string;
  whatsappMessage: string;
  featured?: boolean;
  order?: number;
  variants: ProductVariantPayload[];
  stock: number;
  availability?: "available" | "unavailable";
  status?: ProductStatus;
  isActive: boolean;
};

function getProductImageReferences(
  product: Pick<ProductRecord, "image" | "variants">,
) {
  return [
    product.image,
    ...product.variants.flatMap((variant) => variant.images),
  ].filter(Boolean);
}

type AlertableProduct = Pick<ProductRecord, "name" | "slug" | "stock" | "variants"> & {
  _id: unknown;
};

type ProductSnapshot = ProductRecord & {
  _id: unknown;
};

const PRODUCT_POPULARITY_CACHE_TTL_MS = 60_000;
let productDataMigrationPromise: Promise<void> | null = null;
let productPopularityCache:
  | {
      key: string;
      expiresAt: number;
      value: Map<string, ProductPopularity>;
    }
  | null = null;

function decorateProductForResponse<T extends ProductRecord>(
  product: T,
  popularity: ProductPopularity = EMPTY_PRODUCT_POPULARITY,
  now = new Date(),
) {
  return {
    ...decorateProductBadge(
      decorateProductPricing(product, now),
      env.NEW_PRODUCT_BADGE_DAYS,
      now,
    ),
    ...popularity,
  };
}

async function getProductPopularity<T extends ProductRecord & { _id: unknown }>(
  products: T[],
) {
  const productIds = products.map((product) => product._id);

  if (productIds.length === 0) {
    return new Map<string, ProductPopularity>();
  }

  const cacheKey = products
    .map((product) => `${String(product._id)}:${product.order}`)
    .sort()
    .join("|");

  if (
    productPopularityCache?.key === cacheKey &&
    productPopularityCache.expiresAt > Date.now()
  ) {
    return productPopularityCache.value;
  }

  const totals = await OrderModel.aggregate<{
    _id: unknown;
    confirmedOrderCount: number;
    confirmedQuantity: number;
  }>([
    {
      $match: {
        status: { $in: ["confirmed", "completed"] },
      },
    },
    { $unwind: "$items" },
    {
      $match: {
        "items.source": "catalog",
        "items.productId": { $in: productIds },
      },
    },
    {
      $group: {
        _id: {
          productId: "$items.productId",
          orderId: "$_id",
        },
        quantity: { $sum: "$items.quantity" },
      },
    },
    {
      $group: {
        _id: "$_id.productId",
        confirmedOrderCount: { $sum: 1 },
        confirmedQuantity: { $sum: "$quantity" },
      },
    },
  ]);

  const popularity = rankProductPopularity(
    products.map((product) => ({
      id: String(product._id),
      order: product.order,
    })),
    totals.map((total) => ({
      productId: String(total._id),
      confirmedOrderCount: total.confirmedOrderCount,
      confirmedQuantity: total.confirmedQuantity,
    })),
  );

  productPopularityCache = {
    key: cacheKey,
    expiresAt: Date.now() + PRODUCT_POPULARITY_CACHE_TTL_MS,
    value: popularity,
  };

  return popularity;
}

function getChangedFields(
  before: ProductRecord,
  after: ProductRecord,
) {
  const fields: Array<keyof ProductRecord> = [
    "slug",
    "category",
    "types",
    "name",
    "shortDescription",
    "description",
    "benefits",
    "priceLabel",
    "priceAmount",
    "promotionPrice",
    "promotionStartAt",
    "promotionEndAt",
    "image",
    "badge",
    "whatsappMessage",
    "featured",
    "order",
    "variants",
    "stock",
    "availability",
    "status",
    "isActive",
    "publishedAt",
  ];

  return fields.filter(
    (field) =>
      JSON.stringify(before[field] ?? null) !==
      JSON.stringify(after[field] ?? null),
  );
}

function getVariantStockChanges(
  before: ProductVariantInput[],
  after: ProductVariantInput[],
) {
  const toStockMap = (variants: ProductVariantInput[]) =>
    new Map(
      variants.flatMap((variant) =>
        variant.sizes.map((entry) => [
          `${variant.id}::${entry.size}`,
          {
            variantId: variant.id,
            colorName: variant.colorName,
            size: entry.size,
            stock: entry.stock,
          },
        ] as const),
      ),
    );
  const beforeMap = toStockMap(before);
  const afterMap = toStockMap(after);
  const stockKeys = [
    ...afterMap.keys(),
    ...Array.from(beforeMap.keys()).filter((key) => !afterMap.has(key)),
  ];

  return stockKeys
    .map((key) => {
      const previous = beforeMap.get(key);
      const current = afterMap.get(key);
      const beforeStock = previous?.stock ?? 0;
      const afterStock = current?.stock ?? 0;

      return {
        variantId: current?.variantId ?? previous?.variantId ?? "",
        colorName: current?.colorName ?? previous?.colorName ?? "Couleur inconnue",
        size: current?.size ?? previous?.size ?? DEFAULT_CLOTHING_SIZE,
        before: beforeStock,
        after: afterStock,
        difference: afterStock - beforeStock,
      };
    })
    .filter((change) => change.difference !== 0);
}

function normalizeProductVariants(
  variants: ProductVariantPayload[] | ProductVariantInput[],
): ProductVariantInput[] {
  return variants.map((variant) => {
    const sizes =
      variant.sizes && variant.sizes.length > 0
        ? variant.sizes.map((entry) => ({ ...entry }))
        : [
            {
              size: DEFAULT_CLOTHING_SIZE,
              stock: variant.stock,
            },
          ];

    return {
      ...variant,
      sizes,
      stock: getStockFromVariantSizes(sizes, variant.stock),
    };
  });
}

async function trySendLowStockAlert(product: AlertableProduct) {
  try {
    const wasSent = await sendLowStockEmail(product);

    if (!wasSent) {
      return;
    }

    await ProductModel.updateOne(
      {
        _id: product._id,
        isActive: true,
        stock: { $lt: LOW_STOCK_THRESHOLD },
      },
      {
        $set: { lowStockAlertSentAt: new Date() },
      },
    );
  } catch (error) {
    logger.error(
      `Impossible d'envoyer l'alerte de stock pour ${product.name}. Le produit a bien été enregistré.`,
      error,
    );
  }
}

export async function notifyLowStockForProduct(productId: string) {
  const product = await ProductModel.findById(productId)
    .select("+lowStockAlertSentAt")
    .lean();

  if (
    !product ||
    !product.isActive ||
    !isLowStock(product.stock) ||
    product.lowStockAlertSentAt
  ) {
    return;
  }

  await trySendLowStockAlert(product);
}

function assertValidVariants(variants: ProductVariantInput[], isActive: boolean) {
  if (isActive && variants.length === 0) {
    throw new AppError("Au moins une couleur est obligatoire pour publier le produit.", 400);
  }

  const variantIds = variants.map((variant) => variant.id);

  if (new Set(variantIds).size !== variantIds.length) {
    throw new AppError("Chaque couleur doit posséder un identifiant unique.", 400);
  }

  const colorNames = variants.map((variant) => variant.colorName.trim().toLocaleLowerCase("fr"));

  if (new Set(colorNames).size !== colorNames.length) {
    throw new AppError("Deux couleurs ne peuvent pas porter le même nom.", 400);
  }

  if (isActive && variants.some((variant) => variant.images.length === 0)) {
    throw new AppError("Chaque couleur doit avoir au moins une photo.", 400);
  }

  for (const variant of variants) {
    if (variant.sizes.length === 0) {
      throw new AppError(
        `Ajoute au moins une taille pour la couleur ${variant.colorName}.`,
        400,
      );
    }

    const sizes = variant.sizes.map((entry) => entry.size);

    if (new Set(sizes).size !== sizes.length) {
      throw new AppError(
        `Une taille est renseignée plusieurs fois pour la couleur ${variant.colorName}.`,
        400,
      );
    }
  }
}

async function assertVariantsCanBeRemoved(
  productId: string,
  before: ProductVariantInput[],
  after: ProductVariantInput[],
  session: mongoose.ClientSession,
) {
  const afterKeys = new Set(
    after.flatMap((variant) =>
      variant.sizes.map((entry) => `${variant.id}::${entry.size}`),
    ),
  );
  const removedSelections = before.flatMap((variant) =>
    variant.sizes
      .filter((entry) => !afterKeys.has(`${variant.id}::${entry.size}`))
      .map((entry) => ({ variantId: variant.id, size: entry.size })),
  );

  if (removedSelections.length === 0) {
    return;
  }

  const confirmedOrder = await OrderModel.exists({
    status: "confirmed",
    $or: removedSelections.map((selection) => ({
      items: {
        $elemMatch: {
          source: "catalog",
          productId,
          variantId: selection.variantId,
          size: selection.size,
        },
      },
    })),
  }).session(session);

  if (confirmedOrder) {
    throw new AppError(
      "Une couleur ou une taille supprimée est liée à une commande confirmée. Annule ou termine d'abord cette commande.",
      409,
    );
  }
}

async function assertProductCanBeDeleted(
  productId: string,
  session: mongoose.ClientSession,
) {
  const confirmedOrder = await OrderModel.exists({
    status: "confirmed",
    items: {
      $elemMatch: {
        source: "catalog",
        productId,
      },
    },
  }).session(session);

  if (confirmedOrder) {
    throw new AppError(
      "Ce produit est lié à une commande confirmée. Annule ou termine d'abord cette commande.",
      409,
    );
  }
}

async function syncLegacyVariants() {
  await ProductModel.updateMany(
    {
      $or: [
        { variants: { $exists: false } },
        { variants: null },
        { "variants.0": { $exists: false } },
      ],
    },
    [
      {
        $set: {
          types: { $ifNull: ["$types", []] },
          variants: [
            {
              id: "default",
              colorName: "Couleur unique",
              colorHex: "#D8C4A3",
              images: {
                $cond: [
                  { $gt: [{ $strLenCP: { $ifNull: ["$image", ""] } }, 0] },
                  ["$image"],
                  [],
                ],
              },
              stock: { $ifNull: ["$stock", 0] },
            },
          ],
        },
      },
    ],
  );
}

async function syncLegacyVariantSizes() {
  await ProductModel.updateMany(
    {
      variants: {
        $elemMatch: {
          $or: [
            { sizes: { $exists: false } },
            { sizes: null },
            { "sizes.0": { $exists: false } },
          ],
        },
      },
    },
    [
      {
        $set: {
          variants: {
            $map: {
              input: { $ifNull: ["$variants", []] },
              as: "variant",
              in: {
                $mergeObjects: [
                  "$$variant",
                  {
                    sizes: {
                      $cond: [
                        {
                          $gt: [
                            { $size: { $ifNull: ["$$variant.sizes", []] } },
                            0,
                          ],
                        },
                        "$$variant.sizes",
                        [
                          {
                            size: DEFAULT_CLOTHING_SIZE,
                            stock: { $ifNull: ["$$variant.stock", 0] },
                          },
                        ],
                      ],
                    },
                  },
                ],
              },
            },
          },
        },
      },
      {
        $set: {
          variants: {
            $map: {
              input: "$variants",
              as: "variant",
              in: {
                $mergeObjects: [
                  "$$variant",
                  {
                    stock: {
                      $sum: {
                        $map: {
                          input: "$$variant.sizes",
                          as: "sizeStock",
                          in: { $ifNull: ["$$sizeStock.stock", 0] },
                        },
                      },
                    },
                  },
                ],
              },
            },
          },
        },
      },
      {
        $set: {
          stock: { $sum: "$variants.stock" },
          availability: {
            $cond: [{ $gt: [{ $sum: "$variants.stock" }, 0] }, "available", "unavailable"],
          },
        },
      },
    ],
  );
}

async function syncMissingAvailability() {
  await ProductModel.updateMany(
    {
      $or: [
        { availability: { $exists: false } },
        { availability: null },
        { availability: "" },
      ],
    },
    [
      {
        $set: {
          availability: {
            $cond: [{ $gt: ["$stock", 0] }, "available", "unavailable"],
          },
        },
      },
    ],
  );
}

async function syncProductLifecycle() {
  await ProductModel.updateMany(
    {
      status: { $nin: PRODUCT_STATUSES },
    },
    [
      {
        $set: {
          status: {
            $cond: [{ $eq: ["$isActive", false] }, "hidden", "published"],
          },
        },
      },
    ],
  );

  await ProductModel.updateMany(
    {
      $expr: {
        $ne: ["$isActive", { $eq: ["$status", "published"] }],
      },
    },
    [
      {
        $set: {
          isActive: { $eq: ["$status", "published"] },
        },
      },
    ],
  );

  await ProductModel.updateMany(
    {
      status: "published",
      $or: [
        { publishedAt: { $exists: false } },
        { publishedAt: null },
      ],
    },
    [
      {
        $set: {
          publishedAt: { $ifNull: ["$createdAt", "$$NOW"] },
        },
      },
    ],
  );

  await ProductModel.updateMany(
    {
      badge: { $regex: /^(nouveau|nouveauté)$/i },
    },
    {
      $set: { badge: "" },
    },
  );
}

async function syncProductPriceAmounts() {
  const products = await ProductModel.find({
    $or: [
      { priceAmount: { $exists: false } },
      { priceAmount: null },
    ],
  })
    .select("_id priceLabel")
    .lean();
  const updates = products.flatMap((product) => {
    const priceAmount = parsePriceAmount(product.priceLabel);

    return priceAmount === null
      ? []
      : [
          {
            updateOne: {
              filter: { _id: product._id },
              update: { $set: { priceAmount } },
            },
          },
        ];
  });

  if (updates.length > 0) {
    await ProductModel.bulkWrite(updates);
  }
}

async function syncProductReferences() {
  const products = await ProductModel.find({
    $or: [
      { reference: { $exists: false } },
      { reference: null },
      { reference: "" },
    ],
  })
    .select("_id slug")
    .lean();

  if (products.length === 0) {
    return;
  }

  await ProductModel.collection.bulkWrite(
    products.map((product) => ({
      updateOne: {
        filter: { _id: product._id },
        update: {
          $set: { reference: buildProductReference(product.slug) },
        },
      },
    })),
  );
}

async function syncProductCategories() {
  const products = await ProductModel.find()
    .select("_id category categoryId types")
    .lean();

  if (products.length === 0) {
    return;
  }

  const categoryByLegacyValue = new Map<
    string,
    Awaited<ReturnType<typeof resolveLegacyCategory>>
  >();

  for (const legacyValue of new Set(
    products.map((product) => product.category.trim()).filter(Boolean),
  )) {
    categoryByLegacyValue.set(
      legacyValue,
      await resolveLegacyCategory(legacyValue),
    );
  }

  const updates = products.flatMap((product) => {
    const legacyValue = product.category.trim();
    const category = categoryByLegacyValue.get(legacyValue);

    if (!category) {
      return [];
    }

    const types = [...(product.types ?? [])];
    const legacyValueIsCategory =
      normalizeCategoryValue(legacyValue) ===
      normalizeCategoryValue(category.name);
    const alreadyContainsLegacyType = types.some(
      (type) =>
        normalizeCategoryValue(type) === normalizeCategoryValue(legacyValue),
    );

    if (
      legacyValue &&
      !legacyValueIsCategory &&
      !alreadyContainsLegacyType
    ) {
      types.unshift(legacyValue);
    }

    const categoryIsCurrent =
      String(product.categoryId ?? "") === String(category._id) &&
      product.category === category.name;
    const typesAreCurrent =
      types.length === (product.types ?? []).length &&
      types.every((type, index) => type === product.types[index]);

    return categoryIsCurrent && typesAreCurrent
      ? []
      : [
          {
            updateOne: {
              filter: { _id: product._id },
              update: {
                $set: {
                  categoryId: category._id,
                  category: category.name,
                  types,
                },
              },
            },
          },
        ];
  });

  if (updates.length > 0) {
    await ProductModel.collection.bulkWrite(updates);
  }
}

async function runProductDataMigrations() {
  await syncProductCategories();
  await syncLegacyVariants();
  await syncLegacyVariantSizes();
  await syncMissingAvailability();
  await syncProductLifecycle();
  await syncProductPriceAmounts();
  await syncProductReferences();
  await ProductModel.createIndexes();

  logger.info("Données et index produits vérifiés.", {
    event: "products.data_ready",
  });
}

export async function ensureProductDataMigrations() {
  if (!productDataMigrationPromise) {
    productDataMigrationPromise = runProductDataMigrations().catch((error) => {
      productDataMigrationPromise = null;
      throw error;
    });
  }

  await productDataMigrationPromise;
}

export async function listProducts() {
  await ensureProductDataMigrations();
  const products = await ProductModel.find({ status: "published" })
    .sort({ order: 1, name: 1 })
    .lean();
  const now = new Date();
  const popularity = await getProductPopularity(products);
  return products.map((product) =>
    decorateProductForResponse(
      product,
      popularity.get(String(product._id)),
      now,
    ),
  );
}

export async function listAdminProducts() {
  await ensureProductDataMigrations();
  const products = await ProductModel.find().sort({ order: 1, name: 1 }).lean();
  const now = new Date();
  const popularity = await getProductPopularity(products);
  return products.map((product) =>
    decorateProductForResponse(
      product,
      popularity.get(String(product._id)),
      now,
    ),
  );
}

export async function createProduct(input: ProductInput) {
  const category = await getActiveCategory(input.categoryId);
  const existingProduct = await ProductModel.findOne({ slug: input.slug });

  if (existingProduct) {
    throw new AppError("Un produit avec ce slug existe déjà.", 409);
  }

  const variants = normalizeProductVariants(input.variants ?? []);
  const stock = getStockFromVariants(variants, 0);
  const image = getPrimaryImageFromVariants(variants, input.image);
  const priceAmount =
    input.priceAmount ?? parsePriceAmount(input.priceLabel);
  const status =
    input.status ?? (input.isActive === false ? "hidden" : "published");
  const isPublished = status === "published";

  assertValidVariants(variants, isPublished);

  if (isPublished && !image.trim()) {
    throw new AppError("Au moins une photo est obligatoire pour publier le produit.", 400);
  }

  try {
    assertValidPromotion({ ...input, priceAmount });
  } catch (error) {
    throw new AppError(
      error instanceof Error ? error.message : "La promotion est invalide.",
      400,
    );
  }

  const session = await mongoose.startSession();
  let product: HydratedDocument<ProductRecord> | null = null;

  try {
    await session.withTransaction(async () => {
      const [createdProduct] = await ProductModel.create(
        [
          {
            ...input,
            variants,
            categoryId: category._id,
            category: category.name,
            priceAmount,
            image,
            stock,
            availability: getAvailabilityFromStock(stock),
            status,
            isActive: isPublished,
            publishedAt: isPublished ? new Date() : null,
          },
        ],
        { session },
      );

      await recordStockMovements(
        createdProduct.variants.flatMap((variant) =>
          variant.sizes
            .filter((entry) => entry.stock > 0)
            .map((entry) => ({
            productId: String(createdProduct._id),
            productName: createdProduct.name,
            productSlug: createdProduct.slug,
            variantId: variant.id,
            colorName: variant.colorName,
            size: entry.size,
            quantityBefore: 0,
            quantityAfter: entry.stock,
            difference: entry.stock,
            reason: "product_created" as const,
            actor: "admin" as const,
            note: "Stock initial enregistré lors de la création du produit.",
            })),
        ),
        session,
      );
      product = createdProduct;
    });
  } finally {
    await session.endSession();
  }

  const createdProduct = product as HydratedDocument<ProductRecord> | null;

  if (!createdProduct) {
    throw new AppError("La création du produit a échoué.", 500);
  }

  if (isPublished && isLowStock(stock)) {
    await trySendLowStockAlert(createdProduct);
  }

  await recordAuditEventSafely({
    action: "product.created",
    actor: "admin",
    resource: "product",
    resourceId: String(createdProduct._id),
    resourceLabel: createdProduct.name,
    summary: `Produit "${createdProduct.name}" créé.`,
    details: {
      slug: createdProduct.slug,
      category: createdProduct.category,
      stock: createdProduct.stock,
      status: createdProduct.status,
      isActive: createdProduct.isActive,
      publishedAt: createdProduct.publishedAt ?? null,
      variants: createdProduct.variants.length,
    },
  });

  await synchronizeAdminNotificationsSafely();
  return decorateProductForResponse(createdProduct.toObject());
}

export async function updateProduct(id: string, input: Partial<ProductInput>) {
  await ensureProductDataMigrations();
  const selectedCategory = input.categoryId
    ? await getActiveCategory(input.categoryId)
    : null;
  const session = await mongoose.startSession();
  let transactionResult: {
    before: ProductSnapshot;
    after: ProductSnapshot;
    existingAlertDate: Date | null;
  } | null = null;

  try {
    await session.withTransaction(async () => {
      const existingDocument = await ProductModel.findById(id)
        .select("+lowStockAlertSentAt")
        .session(session);

      if (!existingDocument) {
        throw new AppError("Produit introuvable.", 404);
      }

      const before = existingDocument.toObject();
      const nextStatus =
        input.status ??
        (input.isActive === undefined
          ? before.status
          : input.isActive
            ? "published"
            : "hidden");
      const nextIsPublished = nextStatus === "published";
      const nextVariants = normalizeProductVariants(
        input.variants ?? before.variants ?? [],
      );
      const nextStock = getStockFromVariants(nextVariants, 0);
      const nextImage = getPrimaryImageFromVariants(
        nextVariants,
        input.image ?? before.image,
      );
      const nextPriceLabel = input.priceLabel ?? before.priceLabel;
      const nextPriceAmount =
        input.priceAmount === undefined
          ? before.priceAmount ?? parsePriceAmount(nextPriceLabel)
          : input.priceAmount;
      const nextPromotion = {
        priceLabel: nextPriceLabel,
        priceAmount: nextPriceAmount,
        promotionPrice:
          input.promotionPrice === undefined
            ? before.promotionPrice ?? null
            : input.promotionPrice,
        promotionStartAt:
          input.promotionStartAt === undefined
            ? before.promotionStartAt ?? null
            : input.promotionStartAt,
        promotionEndAt:
          input.promotionEndAt === undefined
            ? before.promotionEndAt ?? null
            : input.promotionEndAt,
      };

      assertValidVariants(nextVariants, nextIsPublished);
      await assertVariantsCanBeRemoved(
        String(existingDocument._id),
        before.variants as ProductVariantInput[],
        nextVariants,
        session,
      );

      if (nextIsPublished && !nextImage.trim()) {
        throw new AppError("Au moins une photo est obligatoire pour publier le produit.", 400);
      }

      try {
        assertValidPromotion(nextPromotion);
      } catch (error) {
        throw new AppError(
          error instanceof Error ? error.message : "La promotion est invalide.",
          400,
        );
      }

      const continuesSameLowStockEpisode =
        before.status === "published" &&
        isLowStock(before.stock) &&
        nextIsPublished &&
        isLowStock(nextStock);
      const alertDate = continuesSameLowStockEpisode
        ? before.lowStockAlertSentAt ?? null
        : null;

      existingDocument.set({
        ...input,
        variants: nextVariants,
        categoryId: selectedCategory?._id ?? before.categoryId,
        category: selectedCategory?.name ?? before.category,
        image: nextImage,
        priceAmount: nextPriceAmount,
        stock: nextStock,
        availability: getAvailabilityFromStock(nextStock),
        status: nextStatus,
        isActive: nextIsPublished,
        publishedAt:
          before.publishedAt ??
          (nextIsPublished ? new Date() : null),
        lowStockAlertSentAt:
          nextIsPublished && isLowStock(nextStock) ? alertDate : null,
      });
      await existingDocument.save({ session });

      const after = existingDocument.toObject();
      const stockChanges = getVariantStockChanges(
        before.variants as ProductVariantInput[],
        after.variants as ProductVariantInput[],
      );

      await recordStockMovements(
        stockChanges.map((change) => ({
          productId: String(after._id),
          productName: after.name,
          productSlug: after.slug,
          variantId: change.variantId,
          colorName: change.colorName,
          size: change.size,
          quantityBefore: change.before,
          quantityAfter: change.after,
          difference: change.difference,
          reason: "manual_correction",
          actor: "admin",
          note: "Stock modifié depuis la fiche produit du backoffice.",
        })),
        session,
      );

      transactionResult = {
        before: before as ProductSnapshot,
        after: after as ProductSnapshot,
        existingAlertDate: alertDate,
      };
    });
  } finally {
    await session.endSession();
  }

  const result = transactionResult as {
    before: ProductSnapshot;
    after: ProductSnapshot;
    existingAlertDate: Date | null;
  } | null;

  if (!result) {
    throw new AppError("La modification du produit a échoué.", 500);
  }

  const {
    before: existingProduct,
    after: product,
    existingAlertDate,
  } = result;

  if (
    product.status === "published" &&
    isLowStock(product.stock) &&
    !existingAlertDate
  ) {
    await trySendLowStockAlert(product);
  }

  const changedFields = getChangedFields(
    existingProduct as ProductRecord,
    product as ProductRecord,
  );

  await recordAuditEventSafely({
    action: "product.updated",
    actor: "admin",
    resource: "product",
    resourceId: String(product._id),
    resourceLabel: product.name,
    summary: `Produit "${product.name}" modifié.`,
    details: { changedFields },
  });

  if (existingProduct.priceLabel !== product.priceLabel) {
    await recordAuditEventSafely({
      action: "product.price_changed",
      actor: "admin",
      resource: "product",
      resourceId: String(product._id),
      resourceLabel: product.name,
      summary: `Prix de "${product.name}" modifié.`,
      details: {
        before: existingProduct.priceLabel,
        after: product.priceLabel,
      },
    });
  }

  if (
    existingProduct.promotionPrice !== product.promotionPrice ||
    String(existingProduct.promotionStartAt ?? "") !==
      String(product.promotionStartAt ?? "") ||
    String(existingProduct.promotionEndAt ?? "") !==
      String(product.promotionEndAt ?? "")
  ) {
    await recordAuditEventSafely({
      action: "product.promotion_changed",
      actor: "admin",
      resource: "product",
      resourceId: String(product._id),
      resourceLabel: product.name,
      summary: `Promotion de "${product.name}" modifiée.`,
      details: {
        before: {
          price: existingProduct.promotionPrice ?? null,
          startAt: existingProduct.promotionStartAt ?? null,
          endAt: existingProduct.promotionEndAt ?? null,
        },
        after: {
          price: product.promotionPrice ?? null,
          startAt: product.promotionStartAt ?? null,
          endAt: product.promotionEndAt ?? null,
        },
      },
    });
  }

  if (existingProduct.stock !== product.stock) {
    await recordAuditEventSafely({
      action: "product.stock_changed",
      actor: "admin",
      resource: "product",
      resourceId: String(product._id),
      resourceLabel: product.name,
      summary: `Stock de "${product.name}" modifié de ${existingProduct.stock} à ${product.stock}.`,
      details: {
        before: existingProduct.stock,
        after: product.stock,
        difference: product.stock - existingProduct.stock,
        variants: getVariantStockChanges(
          existingProduct.variants as ProductVariantInput[],
          product.variants as ProductVariantInput[],
        ),
      },
    });
  }

  if (
    existingProduct.status === "published" &&
    product.status !== "published"
  ) {
    await recordAuditEventSafely({
      action: "product.hidden",
      actor: "admin",
      resource: "product",
      resourceId: String(product._id),
      resourceLabel: product.name,
      summary: `Produit "${product.name}" retiré du catalogue public.`,
      details: {
        beforeStatus: existingProduct.status,
        afterStatus: product.status,
      },
    });
  } else if (
    existingProduct.status !== "published" &&
    product.status === "published"
  ) {
    await recordAuditEventSafely({
      action: "product.shown",
      actor: "admin",
      resource: "product",
      resourceId: String(product._id),
      resourceLabel: product.name,
      summary: `Produit "${product.name}" publié dans le catalogue.`,
      details: {
        beforeStatus: existingProduct.status,
        afterStatus: product.status,
      },
    });
  }

  const nextImageReferences = new Set(getProductImageReferences(product));
  await deleteUnreferencedProductImages(
    getProductImageReferences(existingProduct).filter(
      (reference) => !nextImageReferences.has(reference),
    ),
  );

  await synchronizeAdminNotificationsSafely();
  return decorateProductForResponse(product);
}

export async function restockProduct(
  id: string,
  input: {
    items: Array<{
      variantId: string;
      size?: ClothingSize;
      quantity: number;
    }>;
    note?: string;
  },
) {
  await ensureProductDataMigrations();
  const session = await mongoose.startSession();
  const stockChanges: Array<{
    variantId: string;
    colorName: string;
    size: ClothingSize;
    before: number;
    after: number;
    difference: number;
  }> = [];
  let transactionResult: {
    product: ProductSnapshot;
    stockBefore: number;
  } | null = null;

  try {
    await session.withTransaction(async () => {
      stockChanges.length = 0;
      transactionResult = null;
      const product = await ProductModel.findById(id)
        .select("+lowStockAlertSentAt")
        .session(session);

      if (!product) {
        throw new AppError("Produit introuvable.", 404);
      }

      const stockBefore = product.stock;

      for (const item of input.items) {
        const variant = product.variants.find(
          (entry) => entry.id === item.variantId,
        );

        if (!variant) {
          throw new AppError(
            "Une couleur sélectionnée n'existe plus pour ce produit.",
            409,
          );
        }

        const size = item.size ?? DEFAULT_CLOTHING_SIZE;
        const sizeStock = variant.sizes.find((entry) => entry.size === size);

        if (!sizeStock) {
          throw new AppError(
            `La taille ${size} n'existe plus pour la couleur ${variant.colorName}.`,
            409,
          );
        }

        const before = sizeStock.stock;
        const after = before + item.quantity;

        if (after > MAX_VARIANT_STOCK) {
          throw new AppError(
            `Le stock de ${variant.colorName} / ${size} dépasserait la limite maximale de ${MAX_VARIANT_STOCK.toLocaleString("fr-FR")} unités.`,
            400,
          );
        }

        sizeStock.stock = after;
        variant.stock = getStockFromVariantSizes(variant.sizes, variant.stock);
        stockChanges.push({
          variantId: variant.id,
          colorName: variant.colorName,
          size,
          before,
          after: sizeStock.stock,
          difference: item.quantity,
        });
      }

      product.stock = getStockFromVariants(
        product.variants as ProductVariantInput[],
        product.stock,
      );
      product.availability = getAvailabilityFromStock(product.stock);

      if (product.stock >= LOW_STOCK_THRESHOLD) {
        product.lowStockAlertSentAt = null;
      }

      await product.save({ session });
      const snapshot = product.toObject() as ProductSnapshot;

      await recordStockMovements(
        stockChanges.map((change) => ({
          productId: String(snapshot._id),
          productName: snapshot.name,
          productSlug: snapshot.slug,
          variantId: change.variantId,
          colorName: change.colorName,
          size: change.size,
          quantityBefore: change.before,
          quantityAfter: change.after,
          difference: change.difference,
          reason: "restock",
          actor: "admin",
          note:
            input.note?.trim() ||
            "Réapprovisionnement effectué depuis le backoffice.",
        })),
        session,
      );

      transactionResult = { product: snapshot, stockBefore };
    });
  } finally {
    await session.endSession();
  }

  const result = transactionResult as {
    product: ProductSnapshot;
    stockBefore: number;
  } | null;

  if (!result) {
    throw new AppError("Le réapprovisionnement a échoué.", 500);
  }

  const totalAdded = stockChanges.reduce(
    (total, change) => total + change.difference,
    0,
  );

  await recordAuditEventSafely({
    action: "product.stock_changed",
    actor: "admin",
    resource: "product",
    resourceId: String(result.product._id),
    resourceLabel: result.product.name,
    summary: `${totalAdded} unité${totalAdded > 1 ? "s" : ""} ajoutée${totalAdded > 1 ? "s" : ""} au stock de "${result.product.name}".`,
    details: {
      reason: "restock",
      before: result.stockBefore,
      after: result.product.stock,
      difference: totalAdded,
      variants: stockChanges,
      note: input.note?.trim() ?? "",
    },
  });

  await synchronizeAdminNotificationsSafely();
  return decorateProductForResponse(result.product);
}

export async function sendPendingLowStockAlerts() {
  const products = await ProductModel.find({
    isActive: true,
    stock: { $lt: LOW_STOCK_THRESHOLD },
    lowStockAlertSentAt: null,
  })
    .select("+lowStockAlertSentAt")
    .lean();

  for (const product of products) {
    await trySendLowStockAlert(product);
  }
}

export async function deleteProduct(id: string) {
  const session = await mongoose.startSession();
  let deletedProduct: ProductSnapshot | null = null;

  try {
    await session.withTransaction(async () => {
      const product = await ProductModel.findById(id)
        .session(session)
        .lean();

      if (!product) {
        throw new AppError("Produit introuvable.", 404);
      }

      await assertProductCanBeDeleted(String(product._id), session);
      await ProductModel.deleteOne({ _id: product._id }, { session });

      await recordStockMovements(
        product.variants.flatMap((variant) =>
          variant.sizes
            .filter((entry) => entry.stock > 0)
            .map((entry) => ({
            productId: String(product._id),
            productName: product.name,
            productSlug: product.slug,
            variantId: variant.id,
            colorName: variant.colorName,
            size: entry.size,
            quantityBefore: entry.stock,
            quantityAfter: 0,
            difference: -entry.stock,
            reason: "product_deleted" as const,
            actor: "admin" as const,
            note: "Stock retiré lors de la suppression du produit.",
            })),
        ),
        session,
      );
      deletedProduct = product as ProductSnapshot;
    });
  } finally {
    await session.endSession();
  }

  const product = deletedProduct as ProductSnapshot | null;

  if (!product) {
    throw new AppError("La suppression du produit a échoué.", 500);
  }

  await recordAuditEventSafely({
    action: "product.deleted",
    actor: "admin",
    resource: "product",
    resourceId: String(product._id),
    resourceLabel: product.name,
    summary: `Produit "${product.name}" supprimé définitivement.`,
    details: {
      slug: product.slug,
      category: product.category,
      stock: product.stock,
      status: product.status,
    },
  });

  await deleteUnreferencedProductImages(getProductImageReferences(product));

  await synchronizeAdminNotificationsSafely();
  return product;
}
