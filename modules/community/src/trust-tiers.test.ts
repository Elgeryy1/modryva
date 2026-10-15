import { describe, expect, it } from "vitest";
import {
  computeTrustTier,
  formatTrustTier,
  TRUST_TIERS,
  TRUST_WARNINGS_PER_DEMOTION,
  type TrustStats,
  tierUnlocks,
} from "./trust-tiers.js";

const stats = (overrides: Partial<TrustStats> = {}): TrustStats => ({
  ageDays: 0,
  messages: 0,
  reputation: 0,
  activeWarnings: 0,
  thanksReceived: 0,
  ...overrides,
});

const helperStats = (overrides: Partial<TrustStats> = {}): TrustStats =>
  stats({
    ageDays: 90,
    messages: 800,
    reputation: 50,
    thanksReceived: 20,
    ...overrides,
  });

describe("TRUST_TIERS", () => {
  it("lists the four tiers from lowest to highest privilege", () => {
    expect(TRUST_TIERS).toEqual(["nuevo", "activo", "veterano", "helper"]);
  });
});

describe("computeTrustTier", () => {
  it("returns 'nuevo' for a brand new member with no activity", () => {
    expect(computeTrustTier(stats())).toBe("nuevo");
  });

  it("promotes to 'activo' once age and messages thresholds are met", () => {
    expect(computeTrustTier(stats({ ageDays: 3, messages: 20 }))).toBe(
      "activo",
    );
  });

  it("stays 'nuevo' when only one 'activo' threshold is met", () => {
    expect(computeTrustTier(stats({ ageDays: 3, messages: 19 }))).toBe("nuevo");
    expect(computeTrustTier(stats({ ageDays: 2, messages: 20 }))).toBe("nuevo");
  });

  it("promotes to 'veterano' when all its thresholds are met", () => {
    expect(
      computeTrustTier(
        stats({
          ageDays: 30,
          messages: 200,
          reputation: 10,
          thanksReceived: 3,
        }),
      ),
    ).toBe("veterano");
  });

  it("promotes to 'helper' at the top thresholds", () => {
    expect(computeTrustTier(helperStats())).toBe("helper");
  });

  it("keeps a member at 'veterano' when helper thanks are missing", () => {
    expect(computeTrustTier(helperStats({ thanksReceived: 5 }))).toBe(
      "veterano",
    );
  });

  it("degrades one full tier per block of active warnings", () => {
    expect(
      computeTrustTier(
        helperStats({ activeWarnings: TRUST_WARNINGS_PER_DEMOTION }),
      ),
    ).toBe("veterano");
    expect(
      computeTrustTier(
        helperStats({ activeWarnings: TRUST_WARNINGS_PER_DEMOTION * 2 }),
      ),
    ).toBe("activo");
  });

  it("does not degrade below the number of full warning blocks", () => {
    // One warning is below the per-demotion block, so no degradation yet.
    expect(computeTrustTier(helperStats({ activeWarnings: 1 }))).toBe("helper");
  });

  it("never degrades below 'nuevo' no matter how many warnings", () => {
    expect(computeTrustTier(helperStats({ activeWarnings: 100 }))).toBe(
      "nuevo",
    );
    expect(computeTrustTier(stats({ activeWarnings: 50 }))).toBe("nuevo");
  });

  it("treats negative reputation as failing the requirement", () => {
    expect(
      computeTrustTier(
        stats({
          ageDays: 30,
          messages: 200,
          reputation: -5,
          thanksReceived: 3,
        }),
      ),
    ).toBe("activo");
  });

  it("is deterministic for identical inputs", () => {
    const s = helperStats({ activeWarnings: 3 });
    expect(computeTrustTier(s)).toBe(computeTrustTier(s));
  });
});

describe("tierUnlocks", () => {
  it("unlocks nothing for 'nuevo'", () => {
    expect(tierUnlocks("nuevo")).toEqual({
      canSendLinks: false,
      canSendMedia: false,
      canUseInline: false,
    });
  });

  it("unlocks media (not links/inline) for 'activo'", () => {
    expect(tierUnlocks("activo")).toEqual({
      canSendLinks: false,
      canSendMedia: true,
      canUseInline: false,
    });
  });

  it("unlocks links and media (not inline) for 'veterano'", () => {
    expect(tierUnlocks("veterano")).toEqual({
      canSendLinks: true,
      canSendMedia: true,
      canUseInline: false,
    });
  });

  it("unlocks everything for 'helper'", () => {
    expect(tierUnlocks("helper")).toEqual({
      canSendLinks: true,
      canSendMedia: true,
      canUseInline: true,
    });
  });

  it("falls back to the 'nuevo' floor for unknown tiers", () => {
    expect(tierUnlocks("desconocido")).toEqual({
      canSendLinks: false,
      canSendMedia: false,
      canUseInline: false,
    });
  });

  it("privileges are monotonic across the tier order", () => {
    let prevScore = -1;
    for (const tier of TRUST_TIERS) {
      const u = tierUnlocks(tier);
      const score =
        (u.canSendMedia ? 1 : 0) +
        (u.canSendLinks ? 1 : 0) +
        (u.canUseInline ? 1 : 0);
      expect(score).toBeGreaterThan(prevScore);
      prevScore = score;
    }
  });
});

describe("formatTrustTier", () => {
  it("formats each known tier with an emoji label", () => {
    expect(formatTrustTier("nuevo")).toBe("🌱 Nuevo");
    expect(formatTrustTier("activo")).toBe("💬 Activo");
    expect(formatTrustTier("veterano")).toBe("⭐ Veterano");
    expect(formatTrustTier("helper")).toBe("🛡️ Helper");
  });

  it("returns a generic marker for unknown tiers", () => {
    expect(formatTrustTier("otro")).toBe("❔ Desconocido");
    expect(formatTrustTier("")).toBe("❔ Desconocido");
  });
});
