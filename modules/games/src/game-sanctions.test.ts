import { describe, expect, it } from "vitest";
import { decideGameSanction } from "./game-sanctions.js";

describe("decideGameSanction", () => {
  it("returns no sanction for a low score", () => {
    expect(decideGameSanction({ abuseScore: 5 })).toEqual({
      sanction: "ninguna",
      scopeChat: false,
    });
  });

  it("issues a warning at the aviso boundary", () => {
    expect(decideGameSanction({ abuseScore: 20 })).toEqual({
      sanction: "aviso",
      scopeChat: false,
    });
  });

  it("keeps warning just below the suspension boundary", () => {
    expect(decideGameSanction({ abuseScore: 49 })).toEqual({
      sanction: "aviso",
      scopeChat: false,
    });
  });

  it("suspends games at the suspension boundary", () => {
    expect(decideGameSanction({ abuseScore: 50 })).toEqual({
      sanction: "suspension_juegos",
      scopeChat: false,
    });
  });

  it("resets points at the reset boundary", () => {
    expect(decideGameSanction({ abuseScore: 80 })).toEqual({
      sanction: "reset_puntos",
      scopeChat: false,
    });
  });

  it("resets points for very high scores", () => {
    expect(decideGameSanction({ abuseScore: 999 })).toEqual({
      sanction: "reset_puntos",
      scopeChat: false,
    });
  });

  it("treats zero and negative scores as no sanction", () => {
    expect(decideGameSanction({ abuseScore: 0 })).toEqual({
      sanction: "ninguna",
      scopeChat: false,
    });
    expect(decideGameSanction({ abuseScore: -10 })).toEqual({
      sanction: "ninguna",
      scopeChat: false,
    });
  });

  it("treats non-finite scores as no sanction", () => {
    expect(decideGameSanction({ abuseScore: Number.NaN })).toEqual({
      sanction: "ninguna",
      scopeChat: false,
    });
    expect(
      decideGameSanction({ abuseScore: Number.POSITIVE_INFINITY }),
    ).toEqual({ sanction: "ninguna", scopeChat: false });
  });

  it("never scopes to chat for any sanction level", () => {
    const scores = [0, 20, 50, 80, 500];
    for (const abuseScore of scores) {
      expect(decideGameSanction({ abuseScore }).scopeChat).toBe(false);
    }
  });

  it("escalates monotonically as the score increases", () => {
    const order: readonly string[] = [
      "ninguna",
      "aviso",
      "suspension_juegos",
      "reset_puntos",
    ];
    const scores = [0, 10, 20, 35, 50, 70, 80, 200];
    let prevRank = -1;
    for (const abuseScore of scores) {
      const { sanction } = decideGameSanction({ abuseScore });
      const rank = order.indexOf(sanction);
      expect(rank).toBeGreaterThanOrEqual(prevRank);
      prevRank = rank;
    }
  });

  it("is deterministic for repeated identical input", () => {
    const first = decideGameSanction({ abuseScore: 55 });
    const second = decideGameSanction({ abuseScore: 55 });
    expect(first).toEqual(second);
    expect(first).toEqual({ sanction: "suspension_juegos", scopeChat: false });
  });
});
