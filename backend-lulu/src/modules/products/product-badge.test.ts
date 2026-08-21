import { describe, expect, it } from "vitest";
import {
  AUTOMATIC_NEW_BADGE_LABEL,
  isReservedAutomaticBadge,
  resolveProductBadge,
} from "./product-badge";

describe("isReservedAutomaticBadge", () => {
  it("reconnaît les libellés réservés quelle que soit la casse", () => {
    expect(isReservedAutomaticBadge("Nouveau")).toBe(true);
    expect(isReservedAutomaticBadge("  NOUVEAUTÉ  ")).toBe(true);
  });

  it("laisse passer un badge personnalisé", () => {
    expect(isReservedAutomaticBadge("Promo")).toBe(false);
    expect(isReservedAutomaticBadge(null)).toBe(false);
  });
});

describe("resolveProductBadge", () => {
  const publishedAt = new Date("2026-08-01T00:00:00.000Z");

  it("affiche le badge automatique pendant la fenêtre de nouveauté", () => {
    const badge = resolveProductBadge(
      { status: "published", publishedAt },
      30,
      new Date("2026-08-10T00:00:00.000Z"),
    );

    expect(badge.isNew).toBe(true);
    expect(badge.displayBadge).toBe(AUTOMATIC_NEW_BADGE_LABEL);
    expect(badge.newBadgeExpiresAt).toEqual(new Date("2026-08-31T00:00:00.000Z"));
  });

  it("retire le badge une fois la fenêtre écoulée", () => {
    const badge = resolveProductBadge(
      { status: "published", publishedAt },
      30,
      new Date("2026-09-05T00:00:00.000Z"),
    );

    expect(badge.isNew).toBe(false);
    expect(badge.displayBadge).toBe("");
  });

  it("n'applique jamais le badge automatique à un produit non publié", () => {
    const badge = resolveProductBadge(
      { status: "hidden", publishedAt },
      30,
      new Date("2026-08-10T00:00:00.000Z"),
    );

    expect(badge.isNew).toBe(false);
  });

  it("donne la priorité au badge manuel", () => {
    const badge = resolveProductBadge(
      { status: "published", publishedAt, badge: "  Promo  " },
      30,
      new Date("2026-08-10T00:00:00.000Z"),
    );

    expect(badge.isNew).toBe(true);
    expect(badge.displayBadge).toBe("Promo");
  });

  it("ignore un badge manuel qui usurpe le libellé automatique", () => {
    const badge = resolveProductBadge(
      { status: "published", publishedAt, badge: "Nouveauté" },
      30,
      new Date("2026-09-05T00:00:00.000Z"),
    );

    expect(badge.displayBadge).toBe("");
  });

  it("désactive la nouveauté quand la durée est nulle ou négative", () => {
    const badge = resolveProductBadge(
      { status: "published", publishedAt },
      -5,
      new Date("2026-08-10T00:00:00.000Z"),
    );

    expect(badge.newBadgeDurationDays).toBe(0);
    expect(badge.newBadgeExpiresAt).toBeNull();
    expect(badge.isNew).toBe(false);
  });
});
