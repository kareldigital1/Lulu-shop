import { describe, expect, it } from "vitest";
import { buildOrderReferenceDatePart } from "./order-reference";

describe("buildOrderReferenceDatePart", () => {
  it("formate la date en AAAAMMJJ", () => {
    expect(
      buildOrderReferenceDatePart(new Date("2026-08-21T12:00:00.000Z")),
    ).toBe("20260821");
  });

  it("bascule au jour suivant selon le fuseau d'Afrique/Porto-Novo (UTC+1)", () => {
    // 23h30 UTC le 21 correspond à 00h30 le 22 à Cotonou.
    expect(
      buildOrderReferenceDatePart(new Date("2026-08-21T23:30:00.000Z")),
    ).toBe("20260822");
  });

  it("reste sur le jour courant juste avant la bascule locale", () => {
    expect(
      buildOrderReferenceDatePart(new Date("2026-08-21T22:30:00.000Z")),
    ).toBe("20260821");
  });

  it("complète les mois et jours sur deux chiffres", () => {
    expect(
      buildOrderReferenceDatePart(new Date("2026-01-05T12:00:00.000Z")),
    ).toBe("20260105");
  });
});
