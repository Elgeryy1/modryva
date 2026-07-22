import { describe, expect, it } from "vitest";
import {
  type DestructiveAction,
  detectMassAction,
  massActionTargetsInWindow,
  massActionWithinWindow,
} from "./mass-action-guard.js";

const action = (
  overrides: Partial<DestructiveAction> = {},
): DestructiveAction => ({
  kind: "ban",
  targetCount: 1,
  ms: 0,
  ...overrides,
});

const MINUTE = 60_000;

describe("massActionWithinWindow", () => {
  it("keeps only actions inside (nowMs - windowMs, nowMs]", () => {
    const recent = [
      action({ ms: 0 }),
      action({ ms: 30_000 }),
      action({ ms: 60_000 }),
    ];
    // window (0, 60000] -> ms=0 excluded (edge), 30000 and 60000 kept.
    expect(massActionWithinWindow(recent, MINUTE, 60_000)).toEqual([
      recent[1],
      recent[2],
    ]);
  });

  it("drops actions in the future relative to nowMs", () => {
    const recent = [action({ ms: 100 }), action({ ms: 5_000 })];
    expect(massActionWithinWindow(recent, MINUTE, 1_000)).toEqual([recent[0]]);
  });

  it("returns empty for a non-positive window", () => {
    const recent = [action({ ms: 1_000 })];
    expect(massActionWithinWindow(recent, 0, 1_000)).toEqual([]);
    expect(massActionWithinWindow(recent, -5, 1_000)).toEqual([]);
  });

  it("returns empty for an empty input", () => {
    expect(massActionWithinWindow([], MINUTE, 1_000)).toEqual([]);
  });

  it("preserves the original order", () => {
    const recent = [
      action({ ms: 900, kind: "kick" }),
      action({ ms: 500, kind: "ban" }),
    ];
    expect(massActionWithinWindow(recent, MINUTE, 1_000)).toEqual([
      recent[0],
      recent[1],
    ]);
  });
});

describe("massActionTargetsInWindow", () => {
  it("sums targetCount across in-window actions", () => {
    const recent = [
      action({ ms: 100, targetCount: 3 }),
      action({ ms: 200, targetCount: 5 }),
    ];
    expect(massActionTargetsInWindow(recent, MINUTE, 1_000)).toBe(8);
  });

  it("floors negative targetCount to zero", () => {
    const recent = [
      action({ ms: 100, targetCount: -10 }),
      action({ ms: 200, targetCount: 2 }),
    ];
    expect(massActionTargetsInWindow(recent, MINUTE, 1_000)).toBe(2);
  });

  it("ignores out-of-window targets", () => {
    const recent = [
      action({ ms: 0, targetCount: 100 }),
      action({ ms: 500, targetCount: 4 }),
    ];
    expect(massActionTargetsInWindow(recent, 1_000, 1_000)).toBe(4);
  });

  it("returns zero for empty input", () => {
    expect(massActionTargetsInWindow([], MINUTE, 1_000)).toBe(0);
  });
});

describe("detectMassAction", () => {
  it("blocks when total targets reach the threshold", () => {
    const recent = [
      action({ ms: 100, targetCount: 6 }),
      action({ ms: 200, targetCount: 4 }),
    ];
    const verdict = detectMassAction(recent, MINUTE, 1_000, 10);
    expect(verdict.blocked).toBe(true);
    expect(verdict.reason).toContain("10");
    expect(verdict.reason.length).toBeGreaterThan(0);
  });

  it("does not block below the threshold", () => {
    const recent = [action({ ms: 100, targetCount: 3 })];
    expect(detectMassAction(recent, MINUTE, 1_000, 10)).toEqual({
      blocked: false,
      reason: "",
    });
  });

  it("blocks exactly at the threshold boundary", () => {
    const recent = [action({ ms: 100, targetCount: 5 })];
    expect(detectMassAction(recent, MINUTE, 1_000, 5).blocked).toBe(true);
  });

  it("never blocks with a non-positive threshold", () => {
    const recent = [action({ ms: 100, targetCount: 1000 })];
    expect(detectMassAction(recent, MINUTE, 1_000, 0)).toEqual({
      blocked: false,
      reason: "",
    });
    expect(detectMassAction(recent, MINUTE, 1_000, -3).blocked).toBe(false);
  });

  it("only counts actions inside the window", () => {
    const recent = [
      action({ ms: 0, targetCount: 50 }),
      action({ ms: 500, targetCount: 2 }),
    ];
    // window (0, 1000] excludes ms=0, so total=2 < threshold 10.
    expect(detectMassAction(recent, 1_000, 1_000, 10).blocked).toBe(false);
  });

  it("returns an empty reason when not blocked", () => {
    expect(detectMassAction([], MINUTE, 1_000, 5).reason).toBe("");
  });

  it("is deterministic for identical inputs", () => {
    const recent = [
      action({ ms: 100, targetCount: 7 }),
      action({ ms: 200, targetCount: 8 }),
    ];
    expect(detectMassAction(recent, MINUTE, 1_000, 10)).toEqual(
      detectMassAction(recent, MINUTE, 1_000, 10),
    );
  });

  it("does not mutate the input array", () => {
    const recent: readonly DestructiveAction[] = [
      action({ ms: 100, targetCount: 5 }),
    ];
    const snapshot = [...recent];
    detectMassAction(recent, MINUTE, 1_000, 3);
    expect(recent).toEqual(snapshot);
  });

  it("handles a mix of kinds when accumulating targets", () => {
    const recent = [
      action({ ms: 100, kind: "kick", targetCount: 4 }),
      action({ ms: 150, kind: "ban", targetCount: 4 }),
      action({ ms: 200, kind: "delete", targetCount: 4 }),
    ];
    expect(detectMassAction(recent, MINUTE, 1_000, 12).blocked).toBe(true);
  });
});
