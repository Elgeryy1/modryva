import { describe, expect, it } from "vitest";
import { detectClashingPairs } from "./clashing-pairs.js";

describe("detectClashingPairs", () => {
  it("normalizes reversed pairs and counts them together", () => {
    expect(
      detectClashingPairs([
        { a: 9, b: 1 },
        { a: 1, b: 9 },
      ]),
    ).toEqual([{ pair: [1, 9], count: 2 }]);
  });

  it("excludes pairs below the default minClashes of 2", () => {
    expect(
      detectClashingPairs([
        { a: 1, b: 2 },
        { a: 2, b: 1 },
        { a: 3, b: 4 },
      ]),
    ).toEqual([{ pair: [1, 2], count: 2 }]);
  });

  it("returns an empty list for no conflicts", () => {
    expect(detectClashingPairs([])).toEqual([]);
  });

  it("ignores self-conflicts", () => {
    expect(
      detectClashingPairs([
        { a: 5, b: 5 },
        { a: 5, b: 5 },
      ]),
    ).toEqual([]);
  });

  it("respects a custom minClashes of 1 and sorts ascending on ties", () => {
    expect(
      detectClashingPairs(
        [
          { a: 3, b: 4 },
          { a: 1, b: 2 },
        ],
        { minClashes: 1 },
      ),
    ).toEqual([
      { pair: [1, 2], count: 1 },
      { pair: [3, 4], count: 1 },
    ]);
  });

  it("sorts by count descending", () => {
    expect(
      detectClashingPairs(
        [
          { a: 1, b: 2 },
          { a: 1, b: 2 },
          { a: 1, b: 2 },
          { a: 3, b: 4 },
          { a: 3, b: 4 },
        ],
        { minClashes: 1 },
      ),
    ).toEqual([
      { pair: [1, 2], count: 3 },
      { pair: [3, 4], count: 2 },
    ]);
  });

  it("breaks count ties by pair ascending (first id then second id)", () => {
    expect(
      detectClashingPairs([
        { a: 2, b: 3 },
        { a: 2, b: 3 },
        { a: 1, b: 5 },
        { a: 1, b: 5 },
      ]),
    ).toEqual([
      { pair: [1, 5], count: 2 },
      { pair: [2, 3], count: 2 },
    ]);
  });

  it("filters everything out when minClashes exceeds all counts", () => {
    expect(
      detectClashingPairs(
        [
          { a: 1, b: 2 },
          { a: 1, b: 2 },
        ],
        { minClashes: 3 },
      ),
    ).toEqual([]);
  });

  it("includes single-conflict pairs when minClashes is 0", () => {
    expect(detectClashingPairs([{ a: 7, b: 8 }], { minClashes: 0 })).toEqual([
      { pair: [7, 8], count: 1 },
    ]);
  });

  it("is deterministic across repeated calls with the same input", () => {
    const input = [
      { a: 4, b: 1 },
      { a: 1, b: 4 },
      { a: 2, b: 2 },
      { a: 3, b: 6 },
      { a: 6, b: 3 },
    ];
    const first = detectClashingPairs(input);
    const second = detectClashingPairs(input);
    expect(first).toEqual(second);
    expect(first).toEqual([
      { pair: [1, 4], count: 2 },
      { pair: [3, 6], count: 2 },
    ]);
  });
});
