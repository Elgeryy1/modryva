import { describe, expect, it } from "vitest";
import {
  buildImpersonationSignals,
  detectImpersonation,
  IMPERSONATION_THRESHOLD,
  type ImpersonationIdentity,
  nameSimilarity,
  normalizeDisplayName,
} from "./impersonation.js";

const admins: readonly ImpersonationIdentity[] = [
  { name: "Ana Soporte", username: "ana_admin" },
  { name: "Carlos Modryva", username: "carlosm" },
];

describe("normalizeDisplayName", () => {
  it("lowercases and strips diacritics", () => {
    expect(normalizeDisplayName("MODRÝVA Ádmin")).toBe("modryva admin");
  });

  it("collapses common confusables", () => {
    expect(normalizeDisplayName("M0dryva")).toBe("modryva");
    expect(normalizeDisplayName("adm1n")).toBe("admln");
    expect(normalizeDisplayName("$oporte")).toBe("soporte");
    expect(normalizeDisplayName("modryva")).toBe("modryva");
  });

  it("collapses the rn -> m confusable", () => {
    expect(normalizeDisplayName("adrnin")).toBe("admin");
  });

  it("collapses runs of whitespace and trims", () => {
    expect(normalizeDisplayName("  Ana   Soporte  ")).toBe("ana soporte");
  });

  it("is deterministic for the same input", () => {
    expect(normalizeDisplayName("Ténésé")).toBe(normalizeDisplayName("Ténésé"));
  });
});

describe("nameSimilarity", () => {
  it("returns 1 for identical normalized names", () => {
    expect(nameSimilarity("M0dryva", "MODRYVA")).toBe(1);
  });

  it("returns 1 for two empty strings", () => {
    expect(nameSimilarity("", "")).toBe(1);
  });

  it("returns 0 for a totally different pair of same length", () => {
    expect(nameSimilarity("abc", "xyz")).toBe(0);
  });

  it("gives a high score for near matches", () => {
    expect(nameSimilarity("Carlos Modryva", "Carlos M0dryva")).toBeGreaterThan(
      0.9,
    );
  });

  it("is symmetric", () => {
    expect(nameSimilarity("ana soporte", "ana suporte")).toBeCloseTo(
      nameSimilarity("ana suporte", "ana soporte"),
    );
  });

  it("stays within the 0..1 range", () => {
    const score = nameSimilarity("hola mundo", "x");
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });
});

describe("detectImpersonation", () => {
  it("flags a near-identical display name as impersonation", () => {
    const verdict = detectImpersonation(
      { name: "Carlos M0dryva", username: "fake123" },
      admins,
    );
    expect(verdict.isImpersonation).toBe(true);
    expect(verdict.matchedAdminName).toBe("Carlos Modryva");
    expect(verdict.score).toBeGreaterThanOrEqual(IMPERSONATION_THRESHOLD);
  });

  it("does not flag a clearly different name without role words", () => {
    const verdict = detectImpersonation(
      { name: "Pedro Gamer", username: "pedrog" },
      admins,
    );
    expect(verdict.isImpersonation).toBe(false);
    expect(verdict.matchedAdminName).toBe("Carlos Modryva");
  });

  it("never flags a real admin (matched by username, case-insensitive)", () => {
    const verdict = detectImpersonation(
      { name: "Carlos Modryva", username: "CARLOSM" },
      admins,
    );
    expect(verdict.isImpersonation).toBe(false);
    expect(verdict.score).toBe(0);
  });

  it("handles the @ prefix on usernames when matching real admins", () => {
    const verdict = detectImpersonation(
      { name: "Carlos Modryva", username: "@carlosm" },
      admins,
    );
    expect(verdict.isImpersonation).toBe(false);
  });

  it("flags a role keyword in the name even without name similarity", () => {
    const verdict = detectImpersonation(
      { name: "Official Support", username: "helper" },
      admins,
    );
    expect(verdict.isImpersonation).toBe(true);
    expect(verdict.reason).toContain("support");
  });

  it("flags a role keyword hidden in the username", () => {
    const verdict = detectImpersonation(
      { name: "Random Dude", username: "group_admin" },
      admins,
    );
    expect(verdict.isImpersonation).toBe(true);
    expect(verdict.reason).toContain("admin");
  });

  it("detects confusable role keywords like 'adrnin' (rn -> m)", () => {
    const verdict = detectImpersonation(
      { name: "adrnin", username: "sneaky" },
      admins,
    );
    expect(verdict.isImpersonation).toBe(true);
    expect(verdict.reason).toContain("admin");
  });

  it("respects a custom threshold via opts", () => {
    const candidate = { name: "Carlos Modryca", username: "x" };
    const strict = detectImpersonation(candidate, admins, { threshold: 0.99 });
    const loose = detectImpersonation(candidate, admins, { threshold: 0.6 });
    expect(strict.isImpersonation).toBe(false);
    expect(loose.isImpersonation).toBe(true);
  });

  it("works with an empty admin list and no role words", () => {
    const verdict = detectImpersonation({ name: "Nadie" }, []);
    expect(verdict.isImpersonation).toBe(false);
    expect(verdict.score).toBe(0);
    expect(verdict.matchedAdminName).toBeUndefined();
  });

  it("matches against an admin username too, not just the name", () => {
    const verdict = detectImpersonation(
      { name: "carlosm", username: "impostor" },
      admins,
    );
    expect(verdict.isImpersonation).toBe(true);
    expect(verdict.matchedAdminName).toBe("Carlos Modryva");
  });

  it("is deterministic for identical inputs", () => {
    const candidate = { name: "Ana Soparte", username: "z" };
    expect(detectImpersonation(candidate, admins)).toEqual(
      detectImpersonation(candidate, admins),
    );
  });
});

describe("buildImpersonationSignals", () => {
  it("reflects a positive verdict in its signals", () => {
    const verdict = detectImpersonation(
      { name: "Carlos M0dryva", username: "fake" },
      admins,
    );
    const signals = buildImpersonationSignals(verdict);
    const verdictSignal = signals.find((s) => s.key === "verdict");
    expect(verdictSignal?.present).toBe(true);
    expect(verdictSignal?.weight).toBe(1);
  });

  it("reflects a negative verdict in its signals", () => {
    const verdict = detectImpersonation(
      { name: "Pedro", username: "p" },
      admins,
    );
    const signals = buildImpersonationSignals(verdict);
    const verdictSignal = signals.find((s) => s.key === "verdict");
    expect(verdictSignal?.present).toBe(false);
    expect(verdictSignal?.weight).toBe(0);
  });
});
