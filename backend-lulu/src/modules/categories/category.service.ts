import { AppError } from "../../utils/AppError";
import {
  buildCategorySlug,
  DEFAULT_CATEGORIES,
  findDefaultCategory,
  normalizeCategoryValue,
} from "./category.defaults";
import { CategoryModel } from "./category.model";

let categoryInitializationPromise: Promise<void> | null = null;

async function initializeCategories() {
  await CategoryModel.bulkWrite(
    DEFAULT_CATEGORIES.map((category) => ({
      updateOne: {
        filter: { slug: category.slug },
        update: {
          $setOnInsert: {
            ...category,
            isActive: true,
          },
        },
        upsert: true,
      },
    })),
  );
  await CategoryModel.createIndexes();
}

export async function ensureDefaultCategories() {
  if (!categoryInitializationPromise) {
    categoryInitializationPromise = initializeCategories().catch((error) => {
      categoryInitializationPromise = null;
      throw error;
    });
  }

  await categoryInitializationPromise;
}

export async function listPublicCategories() {
  await ensureDefaultCategories();
  return CategoryModel.find({ isActive: true })
    .sort({ order: 1, name: 1 })
    .lean();
}

export async function listAdminCategories() {
  await ensureDefaultCategories();
  return CategoryModel.find().sort({ order: 1, name: 1 }).lean();
}

export async function getActiveCategory(categoryId: string) {
  await ensureDefaultCategories();
  const category = await CategoryModel.findOne({
    _id: categoryId,
    isActive: true,
  }).lean();

  if (!category) {
    throw new AppError("La catégorie sélectionnée est introuvable ou inactive.", 400);
  }

  return category;
}

export async function resolveLegacyCategory(value: string) {
  await ensureDefaultCategories();
  const defaultCategory = findDefaultCategory(value);

  if (defaultCategory) {
    const category = await CategoryModel.findOne({ slug: defaultCategory.slug }).lean();

    if (category) {
      return category;
    }
  }

  const normalized = normalizeCategoryValue(value);
  const categories = await CategoryModel.find().lean();
  const existingCategory = categories.find(
    (category) =>
      normalizeCategoryValue(category.name) === normalized ||
      category.defaultTypes.some(
        (type) => normalizeCategoryValue(type) === normalized,
      ),
  );

  if (existingCategory) {
    return existingCategory;
  }

  const highestOrder = categories.reduce(
    (maximum, category) => Math.max(maximum, category.order),
    0,
  );
  const name = value.trim();
  const slug = buildCategorySlug(name);

  return CategoryModel.findOneAndUpdate(
    { slug },
    {
      $setOnInsert: {
        name,
        slug,
        order: highestOrder + 1,
        defaultTypes: [name],
        isActive: true,
      },
    },
    { upsert: true, new: true },
  ).lean();
}
