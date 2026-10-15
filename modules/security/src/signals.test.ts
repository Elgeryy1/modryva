import { describe, expect, it } from "vitest";
import {
  combineSignalSets,
  type ModerationSignal,
  mapScoreToSignalAction,
  SIGNAL_ACTION_THRESHOLDS,
  scoreSignals,
} from "./signals.js";

const signal = (
  overrides: Partial<ModerationSignal> = {},
): ModerationSignal => ({
  key: "spam.url",
  weight: 1,
  present: true,
  ...overrides,
});

describe("SIGNAL_ACTION_THRESHOLDS", () => {
  it("keeps escalating thresholds in ascending order", () => {
    expect(SIGNAL_ACTION_THRESHOLDS.warn).toBeLessThan(
      SIGNAL_ACTION_THRESHOLDS.mute,
    );
    expect(SIGNAL_ACTION_THRESHOLDS.mute).toBeLessThan(
      SIGNAL_ACTION_THRESHOLDS.ban,
    );
  });
});

describe("mapScoreToSignalAction", () => {
  it("maps a zero score with nothing present to ignore", () => {
    expect(mapScoreToSignalAction(0, false)).toBe("ignore");
  });

  it("maps a sub-warn score with something present to log", () => {
    expect(mapScoreToSignalAction(0, true)).toBe("log");
    expect(mapScoreToSignalAction(0.5, true)).toBe("log");
  });

  it("maps the warn threshold inclusively to warn", () => {
    expect(mapScoreToSignalAction(SIGNAL_ACTION_THRESHOLDS.warn, true)).toBe(
      "warn",
    );
    expect(mapScoreToSignalAction(2, true)).toBe("warn");
  });

  it("maps the mute threshold inclusively to mute", () => {
    expect(mapScoreToSignalAction(SIGNAL_ACTION_THRESHOLDS.mute, true)).toBe(
      "mute",
    );
    expect(mapScoreToSignalAction(4, true)).toBe("mute");
  });

  it("maps the ban threshold inclusively to ban", () => {
    expect(mapScoreToSignalAction(SIGNAL_ACTION_THRESHOLDS.ban, true)).toBe(
      "ban",
    );
    expect(mapScoreToSignalAction(999, true)).toBe("ban");
  });

  it("treats negative scores as sub-warn", () => {
    expect(mapScoreToSignalAction(-10, true)).toBe("log");
    expect(mapScoreToSignalAction(-10, false)).toBe("ignore");
  });
});

describe("scoreSignals", () => {
  it("returns ignore with score 0 for an empty set", () => {
    expect(scoreSignals([])).toEqual({
      score: 0,
      action: "ignore",
      triggered: [],
    });
  });

  it("ignores signals that are not present", () => {
    const result = scoreSignals([
      signal({ key: "a", weight: 5, present: false }),
      signal({ key: "b", weight: 5, present: false }),
    ]);
    expect(result).toEqual({ score: 0, action: "ignore", triggered: [] });
  });

  it("sums the weights of present signals only", () => {
    const result = scoreSignals([
      signal({ key: "a", weight: 2, present: true }),
      signal({ key: "b", weight: 4, present: false }),
      signal({ key: "c", weight: 3, present: true }),
    ]);
    expect(result.score).toBe(5);
    expect(result.triggered).toEqual(["a", "c"]);
    expect(result.action).toBe("ban");
  });

  it("collects triggered keys in first-appearance order without duplicates", () => {
    const result = scoreSignals([
      signal({ key: "x", weight: 1, present: true }),
      signal({ key: "y", weight: 1, present: true }),
      signal({ key: "x", weight: 1, present: true }),
    ]);
    expect(result.triggered).toEqual(["x", "y"]);
    expect(result.score).toBe(3);
  });

  it("maps a single unit-weight present signal to warn", () => {
    const result = scoreSignals([
      signal({ key: "a", weight: 1, present: true }),
    ]);
    expect(result.action).toBe("warn");
    expect(result.score).toBe(1);
  });

  it("maps present zero-weight signals to log", () => {
    const result = scoreSignals([
      signal({ key: "info", weight: 0, present: true }),
    ]);
    expect(result).toEqual({ score: 0, action: "log", triggered: ["info"] });
  });

  it("lets negative weights attenuate the total", () => {
    const result = scoreSignals([
      signal({ key: "bad", weight: 5, present: true }),
      signal({ key: "trusted", weight: -3, present: true }),
    ]);
    expect(result.score).toBe(2);
    expect(result.action).toBe("warn");
    expect(result.triggered).toEqual(["bad", "trusted"]);
  });

  it("ignores NaN weights without poisoning the score", () => {
    const result = scoreSignals([
      signal({ key: "broken", weight: Number.NaN, present: true }),
      signal({ key: "real", weight: 3, present: true }),
    ]);
    expect(result.score).toBe(3);
    expect(result.action).toBe("mute");
    expect(result.triggered).toEqual(["broken", "real"]);
  });

  it("is deterministic for identical inputs", () => {
    const set: readonly ModerationSignal[] = [
      signal({ key: "a", weight: 2, present: true }),
      signal({ key: "b", weight: 2, present: true }),
    ];
    expect(scoreSignals(set)).toEqual(scoreSignals(set));
  });
});

describe("combineSignalSets", () => {
  it("returns an empty array when given no sets", () => {
    expect(combineSignalSets()).toEqual([]);
  });

  it("flattens disjoint sets preserving order", () => {
    const a = signal({ key: "a", present: true });
    const b = signal({ key: "b", present: false });
    const c = signal({ key: "c", present: true });
    expect(combineSignalSets([a], [b, c])).toEqual([a, b, c]);
  });

  it("deduplicates by key keeping first appearance when none is present", () => {
    const first = signal({ key: "dup", weight: 1, present: false });
    const second = signal({ key: "dup", weight: 9, present: false });
    expect(combineSignalSets([first], [second])).toEqual([first]);
  });

  it("prefers a present signal over an earlier absent one for the same key", () => {
    const absent = signal({ key: "dup", weight: 1, present: false });
    const present = signal({ key: "dup", weight: 4, present: true });
    expect(combineSignalSets([absent], [present])).toEqual([present]);
  });

  it("keeps the first present signal when a later duplicate is also present", () => {
    const first = signal({
      key: "dup",
      weight: 4,
      present: true,
      detail: "one",
    });
    const second = signal({
      key: "dup",
      weight: 9,
      present: true,
      detail: "two",
    });
    expect(combineSignalSets([first], [second])).toEqual([first]);
  });

  it("feeds cleanly into scoreSignals without double-counting duplicates", () => {
    const spam = signal({ key: "spam", weight: 3, present: true });
    const flood = signal({ key: "flood", weight: 3, present: true });
    const spamDup = signal({ key: "spam", weight: 3, present: true });
    const combined = combineSignalSets([spam, flood], [spamDup]);
    expect(combined).toHaveLength(2);
    expect(scoreSignals(combined).score).toBe(6);
    expect(scoreSignals(combined).action).toBe("ban");
  });
});
