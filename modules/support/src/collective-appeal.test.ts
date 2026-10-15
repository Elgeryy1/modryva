import { describe, expect, it } from "vitest";
import {
  type AppealItem,
  detectMassFalsePositive,
  groupAppealsByIncident,
} from "./collective-appeal.js";

const appeal = (overrides: Partial<AppealItem> = {}): AppealItem => ({
  userId: "u1",
  incidentId: "inc1",
  ms: 0,
  ...overrides,
});

describe("groupAppealsByIncident", () => {
  it("returns an empty object for no items", () => {
    expect(groupAppealsByIncident([])).toEqual({});
  });

  it("groups a single appeal under its incident", () => {
    expect(
      groupAppealsByIncident([appeal({ userId: "a", incidentId: "x" })]),
    ).toEqual({ x: ["a"] });
  });

  it("groups multiple users under the same incident", () => {
    const items = [
      appeal({ userId: "a", incidentId: "x" }),
      appeal({ userId: "b", incidentId: "x" }),
      appeal({ userId: "c", incidentId: "x" }),
    ];
    expect(groupAppealsByIncident(items)).toEqual({ x: ["a", "b", "c"] });
  });

  it("splits users across different incidents", () => {
    const items = [
      appeal({ userId: "a", incidentId: "x" }),
      appeal({ userId: "b", incidentId: "y" }),
      appeal({ userId: "c", incidentId: "x" }),
    ];
    expect(groupAppealsByIncident(items)).toEqual({
      x: ["a", "c"],
      y: ["b"],
    });
  });

  it("deduplicates the same user apealing an incident twice", () => {
    const items = [
      appeal({ userId: "a", incidentId: "x", ms: 10 }),
      appeal({ userId: "a", incidentId: "x", ms: 20 }),
      appeal({ userId: "b", incidentId: "x", ms: 30 }),
    ];
    expect(groupAppealsByIncident(items)).toEqual({ x: ["a", "b"] });
  });

  it("preserves first-appearance order of incidents", () => {
    const items = [
      appeal({ userId: "a", incidentId: "second" }),
      appeal({ userId: "b", incidentId: "first" }),
      appeal({ userId: "c", incidentId: "second" }),
    ];
    expect(Object.keys(groupAppealsByIncident(items))).toEqual([
      "second",
      "first",
    ]);
  });

  it("preserves first-appearance order of users within an incident", () => {
    const items = [
      appeal({ userId: "zeta", incidentId: "x" }),
      appeal({ userId: "alpha", incidentId: "x" }),
      appeal({ userId: "mike", incidentId: "x" }),
    ];
    expect(groupAppealsByIncident(items).x).toEqual(["zeta", "alpha", "mike"]);
  });

  it("keeps distinct users that share no dedupe across incidents", () => {
    const items = [
      appeal({ userId: "a", incidentId: "x" }),
      appeal({ userId: "a", incidentId: "y" }),
    ];
    expect(groupAppealsByIncident(items)).toEqual({ x: ["a"], y: ["a"] });
  });

  it("is deterministic for identical inputs", () => {
    const items = [
      appeal({ userId: "a", incidentId: "x" }),
      appeal({ userId: "b", incidentId: "y" }),
      appeal({ userId: "a", incidentId: "x" }),
    ];
    expect(groupAppealsByIncident(items)).toEqual(
      groupAppealsByIncident(items),
    );
  });
});

describe("detectMassFalsePositive", () => {
  it("returns empty for no items", () => {
    expect(detectMassFalsePositive([], 3)).toEqual([]);
  });

  it("flags an incident meeting the threshold exactly", () => {
    const items = [
      appeal({ userId: "a", incidentId: "x" }),
      appeal({ userId: "b", incidentId: "x" }),
      appeal({ userId: "c", incidentId: "x" }),
    ];
    expect(detectMassFalsePositive(items, 3)).toEqual(["x"]);
  });

  it("does not flag an incident below the threshold", () => {
    const items = [
      appeal({ userId: "a", incidentId: "x" }),
      appeal({ userId: "b", incidentId: "x" }),
    ];
    expect(detectMassFalsePositive(items, 3)).toEqual([]);
  });

  it("counts unique users, not raw appeals", () => {
    const items = [
      appeal({ userId: "a", incidentId: "x", ms: 1 }),
      appeal({ userId: "a", incidentId: "x", ms: 2 }),
      appeal({ userId: "a", incidentId: "x", ms: 3 }),
    ];
    expect(detectMassFalsePositive(items, 2)).toEqual([]);
  });

  it("flags only the incidents that reach the threshold", () => {
    const items = [
      appeal({ userId: "a", incidentId: "x" }),
      appeal({ userId: "b", incidentId: "x" }),
      appeal({ userId: "c", incidentId: "y" }),
    ];
    expect(detectMassFalsePositive(items, 2)).toEqual(["x"]);
  });

  it("preserves first-appearance order of flagged incidents", () => {
    const items = [
      appeal({ userId: "a", incidentId: "y" }),
      appeal({ userId: "b", incidentId: "y" }),
      appeal({ userId: "c", incidentId: "x" }),
      appeal({ userId: "d", incidentId: "x" }),
    ];
    expect(detectMassFalsePositive(items, 2)).toEqual(["y", "x"]);
  });

  it("treats a threshold of 1 as flagging every incident with an appeal", () => {
    const items = [
      appeal({ userId: "a", incidentId: "x" }),
      appeal({ userId: "b", incidentId: "y" }),
    ];
    expect(detectMassFalsePositive(items, 1)).toEqual(["x", "y"]);
  });

  it("clamps a zero threshold up to 1 (never flags empty incidents)", () => {
    const items = [appeal({ userId: "a", incidentId: "x" })];
    expect(detectMassFalsePositive(items, 0)).toEqual(["x"]);
    expect(detectMassFalsePositive([], 0)).toEqual([]);
  });

  it("clamps a negative threshold up to 1", () => {
    const items = [appeal({ userId: "a", incidentId: "x" })];
    expect(detectMassFalsePositive(items, -5)).toEqual(["x"]);
  });

  it("flags all incidents when all meet a high threshold", () => {
    const items = [
      appeal({ userId: "a", incidentId: "x" }),
      appeal({ userId: "b", incidentId: "x" }),
      appeal({ userId: "c", incidentId: "y" }),
      appeal({ userId: "d", incidentId: "y" }),
    ];
    expect(detectMassFalsePositive(items, 2)).toEqual(["x", "y"]);
  });

  it("is deterministic for identical inputs", () => {
    const items = [
      appeal({ userId: "a", incidentId: "x" }),
      appeal({ userId: "b", incidentId: "x" }),
    ];
    expect(detectMassFalsePositive(items, 2)).toEqual(
      detectMassFalsePositive(items, 2),
    );
  });
});
