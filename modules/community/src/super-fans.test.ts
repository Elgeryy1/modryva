import { describe, expect, it } from "vitest";
import { detectSuperFans } from "./super-fans.js";

describe("detectSuperFans", () => {
  it("scores messages plus half the reactions and applies the default threshold", () => {
    expect(
      detectSuperFans([
        { userId: 1, messages: 30, reactions: 10 },
        { userId: 2, messages: 10, reactions: 10 },
      ]),
    ).toEqual([{ userId: 1, score: 35 }]);
  });

  it("weights reactions at 0.5 so they can push a member over the threshold", () => {
    expect(
      detectSuperFans([{ userId: 7, messages: 10, reactions: 20 }]),
    ).toEqual([{ userId: 7, score: 20 }]);
  });

  it("includes members exactly at minScore (inclusive boundary)", () => {
    expect(
      detectSuperFans([{ userId: 3, messages: 20, reactions: 0 }]),
    ).toEqual([{ userId: 3, score: 20 }]);
  });

  it("sorts by score descending and breaks ties by userId ascending", () => {
    expect(
      detectSuperFans([
        { userId: 4, messages: 20, reactions: 0 },
        { userId: 3, messages: 20, reactions: 0 },
        { userId: 1, messages: 30, reactions: 10 },
      ]),
    ).toEqual([
      { userId: 1, score: 35 },
      { userId: 3, score: 20 },
      { userId: 4, score: 20 },
    ]);
  });

  it("truncates to topN", () => {
    expect(
      detectSuperFans(
        [
          { userId: 1, messages: 30, reactions: 10 },
          { userId: 3, messages: 20, reactions: 0 },
          { userId: 4, messages: 22, reactions: 0 },
        ],
        { topN: 2 },
      ),
    ).toEqual([
      { userId: 1, score: 35 },
      { userId: 4, score: 22 },
    ]);
  });

  it("honors a custom minScore and excludes members below it", () => {
    expect(
      detectSuperFans(
        [
          { userId: 1, messages: 30, reactions: 10 },
          { userId: 2, messages: 40, reactions: 0 },
        ],
        { minScore: 36 },
      ),
    ).toEqual([{ userId: 2, score: 40 }]);
  });

  it("returns an empty list for no members", () => {
    expect(detectSuperFans([])).toEqual([]);
  });

  it("returns an empty list for a non-positive topN", () => {
    expect(
      detectSuperFans([{ userId: 1, messages: 100, reactions: 0 }], {
        topN: 0,
      }),
    ).toEqual([]);
  });

  it("is deterministic across repeated calls with the same input", () => {
    const members = [
      { userId: 5, messages: 25, reactions: 4 },
      { userId: 2, messages: 30, reactions: 0 },
      { userId: 9, messages: 10, reactions: 4 },
    ] as const;
    const first = detectSuperFans(members);
    const second = detectSuperFans(members);
    expect(first).toEqual(second);
    expect(first).toEqual([
      { userId: 2, score: 30 },
      { userId: 5, score: 27 },
    ]);
  });
});
