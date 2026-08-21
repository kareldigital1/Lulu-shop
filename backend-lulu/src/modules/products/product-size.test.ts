import { describe, expect, it } from "vitest";
import {
  CLOTHING_SIZES,
  CLOTHING_SIZE_LABELS,
  DEFAULT_CLOTHING_SIZE,
  isClothingSize,
} from "./product-size";

describe("isClothingSize", () => {
  it("accepte toutes les tailles déclarées", () => {
    for (const size of CLOTHING_SIZES) {
      expect(isClothingSize(size)).toBe(true);
    }
  });

  it("refuse les valeurs inconnues ou non textuelles", () => {
    expect(isClothingSize("XXXL")).toBe(false);
    expect(isClothingSize("m")).toBe(false);
    expect(isClothingSize(42)).toBe(false);
    expect(isClothingSize(null)).toBe(false);
    expect(isClothingSize(undefined)).toBe(false);
  });
});

describe("CLOTHING_SIZE_LABELS", () => {
  it("fournit un libellé pour chaque taille", () => {
    for (const size of CLOTHING_SIZES) {
      expect(CLOTHING_SIZE_LABELS[size]).toBeTruthy();
    }
  });

  it("expose une taille par défaut valide", () => {
    expect(isClothingSize(DEFAULT_CLOTHING_SIZE)).toBe(true);
  });
});
