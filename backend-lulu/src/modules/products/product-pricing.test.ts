import { describe, expect, it } from "vitest";
import {
  assertValidPromotion,
  formatPriceAmount,
  parsePriceAmount,
  resolveProductPricing,
} from "./product-pricing";

describe("parsePriceAmount", () => {
  it("extrait le montant d'un libellé simple", () => {
    expect(parsePriceAmount("10 000 FCFA")).toBe(10_000);
  });

  it("ignore les espaces insécables utilisés par le formatage fr-FR", () => {
    expect(parsePriceAmount("10\u00a0000 FCFA")).toBe(10_000);
    expect(parsePriceAmount("10\u202f000 FCFA")).toBe(10_000);
  });

  it("gère le préfixe « À partir de »", () => {
    expect(parsePriceAmount("À partir de 5 000 FCFA")).toBe(5_000);
  });

  it("renvoie null quand aucun montant exploitable n'est présent", () => {
    expect(parsePriceAmount("Sur devis")).toBeNull();
    expect(parsePriceAmount("0 FCFA")).toBeNull();
  });
});

describe("formatPriceAmount", () => {
  it("formate en séparateurs d'espace normalisés", () => {
    expect(formatPriceAmount(5_000)).toBe("5 000 FCFA");
  });

  it("reconduit le préfixe « À partir de » du libellé d'origine", () => {
    expect(formatPriceAmount(5_000, "À partir de 8 000 FCFA")).toBe(
      "À partir de 5 000 FCFA",
    );
  });

  it("n'ajoute pas le préfixe si le libellé d'origine n'en a pas", () => {
    expect(formatPriceAmount(5_000, "8 000 FCFA")).toBe("5 000 FCFA");
  });
});

describe("resolveProductPricing", () => {
  const promotedProduct = {
    priceLabel: "10 000 FCFA",
    priceAmount: 10_000,
    promotionPrice: 7_500,
    promotionStartAt: new Date("2026-08-01T00:00:00.000Z"),
    promotionEndAt: new Date("2026-08-31T23:59:59.000Z"),
  };

  it("active la promotion à l'intérieur de la fenêtre", () => {
    const pricing = resolveProductPricing(
      promotedProduct,
      new Date("2026-08-15T12:00:00.000Z"),
    );

    expect(pricing.isPromotionActive).toBe(true);
    expect(pricing.currentPrice).toBe(7_500);
    expect(pricing.displayPriceLabel).toBe("7 500 FCFA");
    expect(pricing.discountPercentage).toBe(25);
  });

  it("désactive la promotion avant son début et après sa fin", () => {
    for (const instant of ["2026-07-31T23:00:00.000Z", "2026-09-01T00:00:00.000Z"]) {
      const pricing = resolveProductPricing(promotedProduct, new Date(instant));

      expect(pricing.isPromotionActive).toBe(false);
      expect(pricing.currentPrice).toBe(10_000);
      expect(pricing.displayPriceLabel).toBe("10 000 FCFA");
      expect(pricing.discountPercentage).toBeNull();
    }
  });

  it("ignore une promotion qui n'est pas moins chère que le prix normal", () => {
    const pricing = resolveProductPricing(
      { ...promotedProduct, promotionPrice: 10_000 },
      new Date("2026-08-15T12:00:00.000Z"),
    );

    expect(pricing.isPromotionActive).toBe(false);
  });

  it("déduit le prix normal du libellé quand priceAmount est absent", () => {
    const pricing = resolveProductPricing(
      { priceLabel: "12 000 FCFA" },
      new Date("2026-08-15T12:00:00.000Z"),
    );

    expect(pricing.currentPrice).toBe(12_000);
    expect(pricing.isPromotionActive).toBe(false);
  });

  it("arrondit la remise au dixième de pour cent", () => {
    const pricing = resolveProductPricing(
      { ...promotedProduct, promotionPrice: 6_667 },
      new Date("2026-08-15T12:00:00.000Z"),
    );

    expect(pricing.discountPercentage).toBe(33.3);
  });
});

describe("assertValidPromotion", () => {
  it("accepte un produit sans aucune donnée de promotion", () => {
    expect(() => assertValidPromotion({ priceLabel: "10 000 FCFA" })).not.toThrow();
  });

  it("refuse une promotion incomplète", () => {
    expect(() =>
      assertValidPromotion({
        priceLabel: "10 000 FCFA",
        promotionPrice: 7_500,
      }),
    ).toThrow(/tous obligatoires/);
  });

  it("refuse un prix promotionnel supérieur ou égal au prix normal", () => {
    expect(() =>
      assertValidPromotion({
        priceLabel: "10 000 FCFA",
        promotionPrice: 10_000,
        promotionStartAt: new Date("2026-08-01T00:00:00.000Z"),
        promotionEndAt: new Date("2026-08-31T00:00:00.000Z"),
      }),
    ).toThrow(/inférieur au prix normal/);
  });

  it("refuse une fenêtre de promotion inversée", () => {
    expect(() =>
      assertValidPromotion({
        priceLabel: "10 000 FCFA",
        promotionPrice: 7_500,
        promotionStartAt: new Date("2026-08-31T00:00:00.000Z"),
        promotionEndAt: new Date("2026-08-01T00:00:00.000Z"),
      }),
    ).toThrow(/postérieure à son début/);
  });
});
