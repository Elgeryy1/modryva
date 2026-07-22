import { describe, expect, it } from "vitest";
import { compareTwinGroups } from "./twin-group-compare.js";

describe("compareTwinGroups", () => {
  it("compares shared metrics and names the leader", () => {
    expect(
      compareTwinGroups(
        { spam: 5, actividad: 100 },
        { spam: 8, actividad: 90 },
      ),
    ).toEqual([
      { metric: "actividad", aValue: 100, bValue: 90, leader: "a" },
      { metric: "spam", aValue: 5, bValue: 8, leader: "b" },
    ]);
  });

  it("marks equal metrics as igual", () => {
    expect(compareTwinGroups({ x: 3 }, { x: 3 })).toEqual([
      { metric: "x", aValue: 3, bValue: 3, leader: "igual" },
    ]);
  });

  it("treats a missing metric as zero", () => {
    expect(compareTwinGroups({ x: 5 }, {})).toEqual([
      { metric: "x", aValue: 5, bValue: 0, leader: "a" },
    ]);
  });

  it("returns metrics in sorted order", () => {
    expect(
      compareTwinGroups({ b: 1, a: 1 }, { a: 1, b: 1 }).map(
        (row) => row.metric,
      ),
    ).toEqual(["a", "b"]);
  });

  it("handles two empty groups", () => {
    expect(compareTwinGroups({}, {})).toEqual([]);
  });
});
