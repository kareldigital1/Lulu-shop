export type ProductColorPreset = {
  name: string;
  hex: string;
};

export const PRODUCT_COLOR_PALETTE: ProductColorPreset[] = [
  { name: "Noir", hex: "#000000" },
  { name: "Blanc", hex: "#FFFFFF" },
  { name: "Rouge", hex: "#FF0000" },
  { name: "Bordeaux", hex: "#7B1E2B" },
  { name: "Rose", hex: "#EEAAC7" },
  { name: "Violet", hex: "#9A9DF4" },
  { name: "Bleu", hex: "#3034A1" },
  { name: "Bleu ciel", hex: "#87CEEB" },
  { name: "Vert", hex: "#2E7D32" },
  { name: "Vert olive", hex: "#78866B" },
  { name: "Jaune", hex: "#F4C430" },
  { name: "Orange", hex: "#F28C28" },
  { name: "Beige", hex: "#D8C4A3" },
  { name: "Marron", hex: "#7A4A2A" },
  { name: "Gris", hex: "#808080" },
  { name: "Doré", hex: "#C89B3C" },
];

export function findProductColorPreset(colorName: string) {
  const normalizedColorName = colorName.trim().toLocaleLowerCase("fr");

  return PRODUCT_COLOR_PALETTE.find(
    (preset) => preset.name.toLocaleLowerCase("fr") === normalizedColorName,
  );
}
