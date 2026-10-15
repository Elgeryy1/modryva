import { describe, expect, it } from "vitest";
import {
  type AdminDecision,
  adminSeverity,
  CONSISTENCY_DEFAULT_SEVERITY,
  consistencyActionSeverity,
  detectInconsistency,
} from "./consistency-check.js";

const decision = (
  adminId: string,
  caseKind: string,
  action: string,
): AdminDecision => ({ adminId, caseKind, action });

describe("consistencyActionSeverity", () => {
  it("maps known actions to their weight", () => {
    expect(consistencyActionSeverity("warn")).toBe(1);
    expect(consistencyActionSeverity("mute")).toBe(3);
    expect(consistencyActionSeverity("ban")).toBe(6);
    expect(consistencyActionSeverity("none")).toBe(0);
  });

  it("is case-insensitive and trims whitespace", () => {
    expect(consistencyActionSeverity("  BAN ")).toBe(6);
    expect(consistencyActionSeverity("Silenciar")).toBe(3);
  });

  it("falls back to the default for unknown actions", () => {
    expect(consistencyActionSeverity("shrug")).toBe(
      CONSISTENCY_DEFAULT_SEVERITY,
    );
  });
});

describe("detectInconsistency", () => {
  it("returns empty for no decisions", () => {
    expect(detectInconsistency([])).toEqual([]);
  });

  it("returns empty when every case kind is resolved consistently", () => {
    const decisions = [
      decision("a", "spam", "ban"),
      decision("b", "spam", "ban"),
      decision("c", "flood", "mute"),
    ];
    expect(detectInconsistency(decisions)).toEqual([]);
  });

  it("flags a case kind resolved with distinct actions", () => {
    const decisions = [
      decision("a", "spam", "ban"),
      decision("b", "spam", "warn"),
    ];
    expect(detectInconsistency(decisions)).toEqual([
      { caseKind: "spam", actions: ["ban", "warn"] },
    ]);
  });

  it("deduplicates repeated actions within a case kind", () => {
    const decisions = [
      decision("a", "spam", "ban"),
      decision("b", "spam", "ban"),
      decision("c", "spam", "warn"),
      decision("d", "spam", "warn"),
    ];
    expect(detectInconsistency(decisions)).toEqual([
      { caseKind: "spam", actions: ["ban", "warn"] },
    ]);
  });

  it("preserves first-appearance order of case kinds and actions", () => {
    const decisions = [
      decision("a", "flood", "mute"),
      decision("b", "spam", "warn"),
      decision("c", "spam", "ban"),
      decision("d", "flood", "kick"),
      decision("e", "spam", "delete"),
    ];
    expect(detectInconsistency(decisions)).toEqual([
      { caseKind: "flood", actions: ["mute", "kick"] },
      { caseKind: "spam", actions: ["warn", "ban", "delete"] },
    ]);
  });

  it("distinguishes actions that differ only in case (no normalization)", () => {
    const decisions = [
      decision("a", "spam", "ban"),
      decision("b", "spam", "BAN"),
    ];
    expect(detectInconsistency(decisions)).toEqual([
      { caseKind: "spam", actions: ["ban", "BAN"] },
    ]);
  });

  it("is deterministic across identical calls", () => {
    const decisions = [
      decision("a", "spam", "ban"),
      decision("b", "spam", "warn"),
    ];
    expect(detectInconsistency(decisions)).toEqual(
      detectInconsistency(decisions),
    );
  });
});

describe("adminSeverity", () => {
  it("returns 0 for an admin with no decisions", () => {
    const decisions = [decision("a", "spam", "ban")];
    expect(adminSeverity(decisions, "ghost")).toBe(0);
    expect(adminSeverity([], "a")).toBe(0);
  });

  it("returns 0.5 (neutral) when a single admin is present", () => {
    const decisions = [
      decision("a", "spam", "ban"),
      decision("a", "flood", "warn"),
    ];
    expect(adminSeverity(decisions, "a")).toBe(0.5);
  });

  it("returns 0.5 when all admins share the same average severity", () => {
    const decisions = [
      decision("a", "spam", "ban"),
      decision("b", "flood", "ban"),
    ];
    expect(adminSeverity(decisions, "a")).toBe(0.5);
    expect(adminSeverity(decisions, "b")).toBe(0.5);
  });

  it("gives 1 to the hardest admin and 0 to the softest", () => {
    const decisions = [
      decision("hard", "spam", "ban"),
      decision("soft", "spam", "warn"),
    ];
    expect(adminSeverity(decisions, "hard")).toBe(1);
    expect(adminSeverity(decisions, "soft")).toBe(0);
  });

  it("places a mid admin proportionally between extremes", () => {
    const decisions = [
      decision("soft", "c", "warn"), // 1
      decision("mid", "c", "kick"), // 4
      decision("hard", "c", "ban"), // 6
    ];
    // (4 - 1) / (6 - 1) = 0.6
    expect(adminSeverity(decisions, "mid")).toBeCloseTo(0.6, 10);
  });

  it("uses the mean across each admin's own decisions", () => {
    const decisions = [
      decision("a", "c1", "ban"), // 6
      decision("a", "c2", "none"), // 0 -> mean 3
      decision("b", "c3", "mute"), // 3 -> mean 3
    ];
    // both means equal -> neutral
    expect(adminSeverity(decisions, "a")).toBe(0.5);
  });

  it("stays within 0..1 for arbitrary inputs", () => {
    const decisions = [
      decision("a", "c", "ban"),
      decision("b", "c", "warn"),
      decision("c", "c", "kick"),
      decision("d", "c", "unknown-action"),
    ];
    for (const id of ["a", "b", "c", "d"]) {
      const value = adminSeverity(decisions, id);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  it("is deterministic across identical calls", () => {
    const decisions = [
      decision("a", "spam", "ban"),
      decision("b", "spam", "warn"),
    ];
    expect(adminSeverity(decisions, "a")).toBe(adminSeverity(decisions, "a"));
  });
});
