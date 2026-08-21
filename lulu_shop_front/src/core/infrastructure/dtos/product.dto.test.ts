import { describe, expect, it } from "vitest";
import { apiBaseUrl } from "../http/request-manager";
import { mapProductDto, type ProductDto } from "./product.dto";

function buildProductDto(overrides: Partial<ProductDto> = {}): ProductDto {
  return {
    slug: "nuisette-satin",
    category: "nuisettes",
    name: "Nuisette satin",
    shortDescription: "Une nuisette légère.",
    description: "Une nuisette légère en satin.",
    benefits: [],
    priceLabel: "10 000 FCFA",
    image: "/api/uploads/products/abc",
    whatsappMessage: "Bonjour",
    featured: false,
    order: 1,
    stock: 4,
    isActive: true,
    ...overrides,
  } as ProductDto;
}

describe("mapProductDto", () => {
  it("préfixe les images relatives de l'API avec l'URL de base", () => {
    const product = mapProductDto(
      buildProductDto({
        variants: [
          {
            id: "red",
            colorName: "Rouge",
            colorHex: "#ff0000",
            images: ["/api/uploads/products/rouge", "https://cdn.test/externe.jpg"],
            sizes: [{ size: "M", stock: 2 }],
            stock: 2,
          },
        ],
      }),
    );

    expect(product.variants[0].images).toEqual([
      `${apiBaseUrl}/api/uploads/products/rouge`,
      "https://cdn.test/externe.jpg",
    ]);
  });

  it("retient la première image de variante comme image principale", () => {
    const product = mapProductDto(
      buildProductDto({
        image: "/api/uploads/products/repli",
        variants: [
          {
            id: "red",
            colorName: "Rouge",
            colorHex: "#ff0000",
            images: ["/api/uploads/products/rouge"],
            sizes: [{ size: "M", stock: 2 }],
            stock: 2,
          },
        ],
      }),
    );

    expect(product.image).toBe(`${apiBaseUrl}/api/uploads/products/rouge`);
  });

  it("retombe sur l'image du produit quand aucune variante n'a d'image", () => {
    const product = mapProductDto(buildProductDto({ variants: [] }));

    expect(product.image).toBe(`${apiBaseUrl}/api/uploads/products/abc`);
  });

  it("complète les variantes sans tailles avec la taille par défaut", () => {
    const product = mapProductDto(
      buildProductDto({
        variants: [
          {
            id: "red",
            colorName: "Rouge",
            colorHex: "#ff0000",
            images: [],
            sizes: [],
            stock: 7,
          },
        ],
      }),
    );

    expect(product.variants[0].sizes).toEqual([
      { size: "NON_RENSEIGNEE", stock: 7 },
    ]);
  });

  it("déduit le statut depuis isActive quand l'API ne le fournit pas", () => {
    expect(mapProductDto(buildProductDto({ isActive: true })).status).toBe(
      "published",
    );
    expect(mapProductDto(buildProductDto({ isActive: false })).status).toBe(
      "hidden",
    );
  });

  it("réaligne isActive sur le statut fourni par l'API", () => {
    const product = mapProductDto(
      buildProductDto({ isActive: true, status: "archived" }),
    );

    expect(product.isActive).toBe(false);
  });

  it("fabrique une référence de repli à partir du slug", () => {
    expect(mapProductDto(buildProductDto({ reference: "   " })).reference).toBe(
      "TLS-NUISETTE-SATIN",
    );
    expect(
      mapProductDto(buildProductDto({ reference: "TLS-042" })).reference,
    ).toBe("TLS-042");
  });

  it("déduit le montant et la disponibilité depuis le libellé et le stock", () => {
    const product = mapProductDto(buildProductDto({ stock: 0 }));

    expect(product.priceAmount).toBe(10_000);
    expect(product.currentPrice).toBe(10_000);
    expect(product.availability).toBe("unavailable");
  });

  it("n'active une promotion que si prix et dates sont tous présents", () => {
    const incomplete = mapProductDto(
      buildProductDto({ isPromotionActive: true, promotionPrice: 7_500 }),
    );

    expect(incomplete.isPromotionActive).toBe(false);
    expect(incomplete.displayPriceLabel).toBe("10 000 FCFA");
    expect(incomplete.discountPercentage).toBeNull();

    const complete = mapProductDto(
      buildProductDto({
        isPromotionActive: true,
        promotionPrice: 7_500,
        promotionStartAt: "2026-08-01T00:00:00.000Z",
        promotionEndAt: "2026-08-31T00:00:00.000Z",
        discountPercentage: 25,
      }),
    );

    expect(complete.isPromotionActive).toBe(true);
    expect(complete.displayPriceLabel).toBe("7 500 FCFA");
    expect(complete.discountPercentage).toBe(25);
  });

  it("neutralise un badge manuel qui usurpe le libellé automatique", () => {
    expect(mapProductDto(buildProductDto({ badge: "Nouveauté" })).displayBadge).toBe(
      "",
    );
    expect(mapProductDto(buildProductDto({ badge: "  Promo  " })).displayBadge).toBe(
      "Promo",
    );
  });

  it("applique des valeurs neutres pour les champs de popularité absents", () => {
    const product = mapProductDto(buildProductDto());

    expect(product.confirmedOrderCount).toBe(0);
    expect(product.confirmedQuantity).toBe(0);
    expect(product.popularityRank).toBeNull();
    expect(product.isPopular).toBe(false);
    expect(product.isNew).toBe(false);
    expect(product.types).toEqual([]);
    expect(product.categoryId).toBe("");
  });
});
