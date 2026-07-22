import { describe, expect, it } from "vitest";
import { detectCommercialUsername } from "./commercial-username.js";

describe("detectCommercialUsername", () => {
  it("detects curated commercial terms in list order", () => {
    expect(detectCommercialUsername("promo_deals")).toEqual({
      matched: true,
      hits: ["promo", "deal"],
      score: 2,
    });
  });

  it("detects an impersonation term plus a t.me domain marker", () => {
    expect(detectCommercialUsername("official_giveaway_t.me")).toEqual({
      matched: true,
      hits: ["official", "giveaway", "t.me"],
      score: 4,
    });
  });

  it("detects a term alongside an embedded money symbol", () => {
    expect(detectCommercialUsername("cashprize$100")).toEqual({
      matched: true,
      hits: ["cash", "money"],
      score: 3,
    });
  });

  it("flags a bare .com domain even without commercial terms", () => {
    expect(detectCommercialUsername("joinnow.com")).toEqual({
      matched: true,
      hits: [".com"],
      score: 2,
    });
  });

  it("flags a currency-word money amount on its own", () => {
    expect(detectCommercialUsername("win5000usd")).toEqual({
      matched: true,
      hits: ["money"],
      score: 2,
    });
  });

  it("matches case-insensitively", () => {
    expect(detectCommercialUsername("PROMO_VIP")).toEqual({
      matched: true,
      hits: ["promo", "vip"],
      score: 2,
    });
  });

  it("returns hits in curated order regardless of appearance order", () => {
    expect(detectCommercialUsername("giveaway_promo_vip")).toEqual({
      matched: true,
      hits: ["promo", "vip", "giveaway"],
      score: 3,
    });
  });

  it("caps the weighted score when many markers are present", () => {
    expect(
      detectCommercialUsername(
        "promo deal cash support free bonus vip official giveaway .com .io t.me $5",
      ),
    ).toEqual({
      matched: true,
      hits: [
        "promo",
        "deal",
        "cash",
        "support",
        "free",
        "bonus",
        "vip",
        "official",
        "giveaway",
        ".com",
        ".io",
        "t.me",
        "money",
      ],
      score: 10,
    });
  });

  it("returns no match for a clean human username", () => {
    expect(detectCommercialUsername("juan_perez")).toEqual({
      matched: false,
      hits: [],
      score: 0,
    });
  });

  it("handles an empty string", () => {
    expect(detectCommercialUsername("")).toEqual({
      matched: false,
      hits: [],
      score: 0,
    });
  });

  it("handles undefined", () => {
    expect(detectCommercialUsername(undefined)).toEqual({
      matched: false,
      hits: [],
      score: 0,
    });
  });
});
