export const CLOTHING_SIZES = [
  "XS",
  "S",
  "M",
  "L",
  "XL",
  "XXL",
  "3XL",
  "TU",
  "NON_RENSEIGNEE",
] as const;

export type ClothingSize = (typeof CLOTHING_SIZES)[number];

export const CLOTHING_SIZE_LABELS: Record<ClothingSize, string> = {
  XS: "XS",
  S: "S",
  M: "M",
  L: "L",
  XL: "XL",
  XXL: "XXL",
  "3XL": "3XL",
  TU: "Taille unique",
  NON_RENSEIGNEE: "Non renseignée",
};

export const DEFAULT_CLOTHING_SIZE: ClothingSize = "NON_RENSEIGNEE";

export function isClothingSize(value: unknown): value is ClothingSize {
  return (
    typeof value === "string" &&
    CLOTHING_SIZES.includes(value as ClothingSize)
  );
}
