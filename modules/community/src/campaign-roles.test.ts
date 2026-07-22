import { describe, expect, it } from "vitest";
import { type CampaignRoleRule, tagByCampaign } from "./campaign-roles.js";

const MAPPING: readonly CampaignRoleRule[] = [
  { link: "https://t.me/+verano2026", tag: "verano" },
  { link: "https://t.me/+influencer", tag: "influencer" },
];

describe("tagByCampaign", () => {
  it("returns the mapped tag for a matching link", () => {
    expect(tagByCampaign("https://t.me/+verano2026", MAPPING)).toBe("verano");
  });

  it("matches a later rule in the mapping", () => {
    expect(tagByCampaign("https://t.me/+influencer", MAPPING)).toBe(
      "influencer",
    );
  });

  it("returns the default fallback for an unmatched link", () => {
    expect(tagByCampaign("https://t.me/+desconocido", MAPPING)).toBe(
      "organico",
    );
  });

  it("returns the default fallback for undefined", () => {
    expect(tagByCampaign(undefined, MAPPING)).toBe("organico");
  });

  it("returns the default fallback for an empty string", () => {
    expect(tagByCampaign("", MAPPING)).toBe("organico");
  });

  it("returns the default fallback for whitespace-only input", () => {
    expect(tagByCampaign("   ", MAPPING)).toBe("organico");
  });

  it("returns the default fallback when the mapping is empty", () => {
    expect(tagByCampaign("https://t.me/+verano2026", [])).toBe("organico");
  });

  it("honours a custom fallback tag", () => {
    expect(
      tagByCampaign("https://t.me/+nope", MAPPING, {
        fallbackTag: "sin-campana",
      }),
    ).toBe("sin-campana");
  });

  it("trims surrounding whitespace on the input link before matching", () => {
    expect(tagByCampaign("  https://t.me/+verano2026  ", MAPPING)).toBe(
      "verano",
    );
  });

  it("is case-sensitive and does not match a different case", () => {
    expect(tagByCampaign("https://t.me/+VERANO2026", MAPPING)).toBe("organico");
  });

  it("returns the FIRST matching rule when duplicates exist (deterministic order)", () => {
    const dupes: readonly CampaignRoleRule[] = [
      { link: "https://t.me/+dup", tag: "primero" },
      { link: "https://t.me/+dup", tag: "segundo" },
    ];
    expect(tagByCampaign("https://t.me/+dup", dupes)).toBe("primero");
  });
});
