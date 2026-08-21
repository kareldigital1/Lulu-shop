export const PRODUCT_CATEGORY_GROUPS = [
  { label: "Robes", categories: ["Robe"] },
  { label: "Hauts", categories: ["T-shirt", "Crop top", "Body Sweet", "Chemise", "Blazer"] },
  { label: "Bas", categories: ["Palazzo"] },
  { label: "Combinaisons", categories: ["Combinaison"] },
  { label: "Lingerie & Nuit", categories: ["Nuisette"] },
  { label: "Accessoires", categories: ["Ceinture"] },
] as const;

const groupOrder: string[] = PRODUCT_CATEGORY_GROUPS.map((group) => group.label);
const categoryToGroup = new Map<string, string>();
const normalizedLookup = new Map<string, string>();

for (const group of PRODUCT_CATEGORY_GROUPS) {
  normalizedLookup.set(group.label.trim().toLowerCase(), group.label);

  for (const category of group.categories) {
    categoryToGroup.set(category, group.label);
    normalizedLookup.set(category.trim().toLowerCase(), group.label);
  }
}

function normalizeCategoryValue(value: string) {
  return value.trim().toLowerCase();
}

export function getProductGroup(category: string) {
  return categoryToGroup.get(category) ?? category;
}

export function normalizeCategoryFilter(category: string | null | undefined) {
  if (!category?.trim()) {
    return "all";
  }

  const normalized = normalizedLookup.get(normalizeCategoryValue(category));
  return normalized ?? category;
}

export function matchesCategoryFilter(productCategory: string, activeCategory: string) {
  if (activeCategory === "all") {
    return true;
  }

  return getProductGroup(productCategory) === normalizeCategoryFilter(activeCategory);
}

export function getGroupedCategories(categories: string[]) {
  const deduped = Array.from(new Set(categories.map(getProductGroup)));

  return deduped.sort((left, right) => {
    const leftIndex = groupOrder.indexOf(left);
    const rightIndex = groupOrder.indexOf(right);

    if (leftIndex === -1 && rightIndex === -1) {
      return left.localeCompare(right, "fr");
    }
    if (leftIndex === -1) {
      return 1;
    }
    if (rightIndex === -1) {
      return -1;
    }

    return leftIndex - rightIndex;
  });
}

export function formatProductCategory(category: string) {
  const group = getProductGroup(category);
  return group === category ? category : `${group} · ${category}`;
}
