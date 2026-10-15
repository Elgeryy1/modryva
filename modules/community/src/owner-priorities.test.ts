import { describe, expect, it } from "vitest";
import {
  formatOwnerBrief,
  type OwnerSignal,
  ownerSignalWeight,
  rankOwnerPriorities,
} from "./owner-priorities.js";

const signal = (overrides: Partial<OwnerSignal> = {}): OwnerSignal => ({
  kind: "reportes",
  count: 1,
  severity: "info",
  ...overrides,
});

describe("ownerSignalWeight", () => {
  it("multiplies the severity factor by the count", () => {
    expect(ownerSignalWeight(signal({ severity: "info", count: 4 }))).toBe(4);
    expect(ownerSignalWeight(signal({ severity: "warn", count: 4 }))).toBe(12);
    expect(ownerSignalWeight(signal({ severity: "critical", count: 4 }))).toBe(
      40,
    );
  });

  it("treats a zero count as no weight", () => {
    expect(ownerSignalWeight(signal({ severity: "critical", count: 0 }))).toBe(
      0,
    );
  });

  it("clamps negative counts to zero", () => {
    expect(ownerSignalWeight(signal({ severity: "warn", count: -5 }))).toBe(0);
  });
});

describe("rankOwnerPriorities", () => {
  it("orders by weight descending", () => {
    const ranked = rankOwnerPriorities([
      signal({ kind: "a", severity: "info", count: 2 }),
      signal({ kind: "b", severity: "critical", count: 1 }),
      signal({ kind: "c", severity: "warn", count: 1 }),
    ]);
    expect(ranked.map((p) => p.kind)).toEqual(["b", "c", "a"]);
    expect(ranked.map((p) => p.weight)).toEqual([10, 3, 2]);
  });

  it("is a stable sort for equal weights", () => {
    const ranked = rankOwnerPriorities([
      signal({ kind: "first", severity: "warn", count: 1 }),
      signal({ kind: "second", severity: "info", count: 3 }),
      signal({ kind: "third", severity: "warn", count: 1 }),
    ]);
    // all weight 3, must keep input order
    expect(ranked.map((p) => p.kind)).toEqual(["first", "second", "third"]);
    expect(ranked.every((p) => p.weight === 3)).toBe(true);
  });

  it("returns an empty array for no signals", () => {
    expect(rankOwnerPriorities([])).toEqual([]);
  });

  it("keeps every signal in the ranking", () => {
    const input = [
      signal({ kind: "a", count: 1 }),
      signal({ kind: "b", count: 2 }),
      signal({ kind: "c", count: 3 }),
    ];
    expect(rankOwnerPriorities(input)).toHaveLength(3);
  });

  it("assigns zero weight to zero and negative counts", () => {
    const ranked = rankOwnerPriorities([
      signal({ kind: "empty", severity: "critical", count: 0 }),
      signal({ kind: "neg", severity: "warn", count: -3 }),
    ]);
    expect(ranked.map((p) => p.weight)).toEqual([0, 0]);
    expect(ranked.map((p) => p.kind)).toEqual(["empty", "neg"]);
  });

  it("does not mutate the input array", () => {
    const input = [
      signal({ kind: "a", severity: "info", count: 1 }),
      signal({ kind: "b", severity: "critical", count: 1 }),
    ];
    const snapshot = input.map((s) => s.kind);
    rankOwnerPriorities(input);
    expect(input.map((s) => s.kind)).toEqual(snapshot);
  });

  it("is deterministic across repeated calls", () => {
    const input = [
      signal({ kind: "x", severity: "warn", count: 2 }),
      signal({ kind: "y", severity: "critical", count: 1 }),
      signal({ kind: "z", severity: "info", count: 9 }),
    ];
    expect(rankOwnerPriorities(input)).toEqual(rankOwnerPriorities(input));
  });
});

describe("formatOwnerBrief", () => {
  it("lists only the top 3 priorities", () => {
    const brief = formatOwnerBrief([
      signal({ kind: "a", severity: "critical", count: 5 }),
      signal({ kind: "b", severity: "critical", count: 4 }),
      signal({ kind: "c", severity: "critical", count: 3 }),
      signal({ kind: "d", severity: "critical", count: 2 }),
    ]);
    const lines = brief.split("\n");
    expect(lines).toHaveLength(4); // header + 3
    expect(brief).toContain("1. 🔴 a (peso 50)");
    expect(brief).toContain("2. 🔴 b (peso 40)");
    expect(brief).toContain("3. 🔴 c (peso 30)");
    expect(brief).not.toContain(" d ");
  });

  it("uses the accented header", () => {
    const brief = formatOwnerBrief([
      signal({ kind: "reportes", severity: "warn", count: 2 }),
    ]);
    expect(brief.startsWith("📋 Prioridades del día:")).toBe(true);
  });

  it("shows the icon matching each severity", () => {
    const brief = formatOwnerBrief([
      signal({ kind: "info-one", severity: "info", count: 1 }),
      signal({ kind: "warn-one", severity: "warn", count: 1 }),
      signal({ kind: "crit-one", severity: "critical", count: 1 }),
    ]);
    expect(brief).toContain("🔴 crit-one");
    expect(brief).toContain("🟠 warn-one");
    expect(brief).toContain("🔵 info-one");
  });

  it("returns the calm message for no signals", () => {
    expect(formatOwnerBrief([])).toBe(
      "✅ Todo tranquilo: no hay prioridades pendientes hoy.",
    );
  });

  it("returns the calm message when every weight is zero", () => {
    const brief = formatOwnerBrief([
      signal({ kind: "a", severity: "critical", count: 0 }),
      signal({ kind: "b", severity: "warn", count: -1 }),
    ]);
    expect(brief).toBe("✅ Todo tranquilo: no hay prioridades pendientes hoy.");
  });

  it("omits zero-weight signals but keeps the positive ones", () => {
    const brief = formatOwnerBrief([
      signal({ kind: "real", severity: "warn", count: 2 }),
      signal({ kind: "hollow", severity: "critical", count: 0 }),
    ]);
    const lines = brief.split("\n");
    expect(lines).toHaveLength(2); // header + 1 real priority
    expect(brief).toContain("🟠 real (peso 6)");
    expect(brief).not.toContain("hollow");
  });

  it("is deterministic for identical inputs", () => {
    const input = [
      signal({ kind: "a", severity: "warn", count: 2 }),
      signal({ kind: "b", severity: "critical", count: 1 }),
    ];
    expect(formatOwnerBrief(input)).toBe(formatOwnerBrief(input));
  });

  it("numbers the priorities from 1", () => {
    const brief = formatOwnerBrief([
      signal({ kind: "top", severity: "critical", count: 1 }),
      signal({ kind: "next", severity: "info", count: 1 }),
    ]);
    expect(brief).toContain("1. 🔴 top");
    expect(brief).toContain("2. 🔵 next");
  });
});
