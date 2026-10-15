import { describe, expect, it } from "vitest";
import { computeAnswerUtility } from "./answer-utility.js";

describe("computeAnswerUtility", () => {
  it("tallies per author and sorts by utility descending", () => {
    expect(
      computeAnswerUtility([
        { authorId: 1, helpful: true },
        { authorId: 1, helpful: false },
        { authorId: 2, helpful: true },
      ]),
    ).toEqual([
      { authorId: 2, helpful: 1, total: 1, utility: 1 },
      { authorId: 1, helpful: 1, total: 2, utility: 0.5 },
    ]);
  });

  it("rounds utility to two decimals", () => {
    expect(
      computeAnswerUtility([
        { authorId: 5, helpful: true },
        { authorId: 5, helpful: true },
        { authorId: 5, helpful: false },
      ]),
    ).toEqual([{ authorId: 5, helpful: 2, total: 3, utility: 0.67 }]);
  });

  it("returns an empty array for empty input", () => {
    expect(computeAnswerUtility([])).toEqual([]);
  });

  it("breaks utility ties by helpful count descending", () => {
    expect(
      computeAnswerUtility([
        { authorId: 2, helpful: true },
        { authorId: 1, helpful: true },
        { authorId: 1, helpful: true },
      ]),
    ).toEqual([
      { authorId: 1, helpful: 2, total: 2, utility: 1 },
      { authorId: 2, helpful: 1, total: 1, utility: 1 },
    ]);
  });

  it("breaks utility and helpful ties by authorId ascending", () => {
    expect(
      computeAnswerUtility([
        { authorId: 3, helpful: true },
        { authorId: 1, helpful: true },
      ]),
    ).toEqual([
      { authorId: 1, helpful: 1, total: 1, utility: 1 },
      { authorId: 3, helpful: 1, total: 1, utility: 1 },
    ]);
  });

  it("reports zero utility when no answers were helpful", () => {
    expect(
      computeAnswerUtility([
        { authorId: 7, helpful: false },
        { authorId: 7, helpful: false },
      ]),
    ).toEqual([{ authorId: 7, helpful: 0, total: 2, utility: 0 }]);
  });

  it("handles a single author with a single answer", () => {
    expect(computeAnswerUtility([{ authorId: 9, helpful: true }])).toEqual([
      { authorId: 9, helpful: 1, total: 1, utility: 1 },
    ]);
  });

  it("is deterministic across repeated calls regardless of input order", () => {
    const input = [
      { authorId: 4, helpful: false },
      { authorId: 2, helpful: true },
      { authorId: 4, helpful: true },
      { authorId: 2, helpful: true },
      { authorId: 4, helpful: true },
    ];
    const first = computeAnswerUtility(input);
    const second = computeAnswerUtility(input);
    expect(first).toEqual(second);
    expect(first).toEqual([
      { authorId: 2, helpful: 2, total: 2, utility: 1 },
      { authorId: 4, helpful: 2, total: 3, utility: 0.67 },
    ]);
  });
});
