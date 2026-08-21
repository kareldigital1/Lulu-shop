export type DefaultCategoryDefinition = {
  name: string;
  slug: string;
  order: number;
  defaultTypes: string[];
};

export const DEFAULT_CATEGORIES: DefaultCategoryDefinition[] = [
  { name: "Robes", slug: "robes", order: 1, defaultTypes: ["Robe"] },
  {
    name: "Hauts",
    slug: "hauts",
    order: 2,
    defaultTypes: ["T-shirt", "Crop top", "Body Sweet", "Chemise", "Blazer"],
  },
  { name: "Bas", slug: "bas", order: 3, defaultTypes: ["Palazzo"] },
  {
    name: "Combinaisons",
    slug: "combinaisons",
    order: 4,
    defaultTypes: ["Combinaison"],
  },
  {
    name: "Lingerie & Nuit",
    slug: "lingerie-nuit",
    order: 5,
    defaultTypes: ["Nuisette"],
  },
  {
    name: "Accessoires",
    slug: "accessoires",
    order: 6,
    defaultTypes: ["Ceinture"],
  },
];

export function normalizeCategoryValue(value: string) {
  return value.trim().toLocaleLowerCase("fr");
}

export function buildCategorySlug(value: string) {
  return value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "categorie";
}

export function findDefaultCategory(value: string) {
  const normalized = normalizeCategoryValue(value);

  return DEFAULT_CATEGORIES.find(
    (category) =>
      normalizeCategoryValue(category.name) === normalized ||
      category.defaultTypes.some(
        (type) => normalizeCategoryValue(type) === normalized,
      ),
  );
}
