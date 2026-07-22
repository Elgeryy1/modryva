import { describe, expect, it } from "vitest";
import { accumulateHiddenRep } from "./hidden-rep.js";

describe("accumulateHiddenRep", () => {
  it("sums points per user and sorts by points desc", () => {
    expect(
      accumulateHiddenRep([
        { userId: 1, points: 3 },
        { userId: 2, points: 5 },
        { userId: 1, points: 4 },
      ]),
    ).toEqual([
      { userId: 1, points: 7 },
      { userId: 2, points: 5 },
    ]);
  });

  it("breaks ties by userId ascending", () => {
    expect(
      accumulateHiddenRep([
        { userId: 30, points: 10 },
        { userId: 10, points: 10 },
        { userId: 20, points: 10 },
      ]),
    ).toEqual([
      { userId: 10, points: 10 },
      { userId: 20, points: 10 },
      { userId: 30, points: 10 },
    ]);
  });

  it("ignores zero-point events", () => {
    expect(
      accumulateHiddenRep([
        { userId: 1, points: 0 },
        { userId: 1, points: 2 },
      ]),
    ).toEqual([{ userId: 1, points: 2 }]);
  });

  it("ignores negative-point events", () => {
    expect(
      accumulateHiddenRep([
        { userId: 1, points: -5 },
        { userId: 2, points: 3 },
      ]),
    ).toEqual([{ userId: 2, points: 3 }]);
  });

  it("drops a user whose only events are non-positive", () => {
    expect(
      accumulateHiddenRep([
        { userId: 1, points: -5 },
        { userId: 1, points: 0 },
      ]),
    ).toEqual([]);
  });

  it("returns an empty array for no events", () => {
    expect(accumulateHiddenRep([])).toEqual([]);
  });

  it("returns a single standing for one user across events", () => {
    expect(
      accumulateHiddenRep([
        { userId: 7, points: 1 },
        { userId: 7, points: 1 },
        { userId: 7, points: 1 },
      ]),
    ).toEqual([{ userId: 7, points: 3 }]);
  });

  it("mixes positive and non-positive for the same user", () => {
    expect(
      accumulateHiddenRep([
        { userId: 4, points: 6 },
        { userId: 4, points: -2 },
        { userId: 4, points: 3 },
      ]),
    ).toEqual([{ userId: 4, points: 9 }]);
  });

  it("produces the same order regardless of input order", () => {
    const a = accumulateHiddenRep([
      { userId: 1, points: 2 },
      { userId: 2, points: 8 },
      { userId: 3, points: 8 },
    ]);
    const b = accumulateHiddenRep([
      { userId: 3, points: 8 },
      { userId: 1, points: 2 },
      { userId: 2, points: 8 },
    ]);
    expect(a).toEqual(b);
    expect(a).toEqual([
      { userId: 2, points: 8 },
      { userId: 3, points: 8 },
      { userId: 1, points: 2 },
    ]);
  });

  it("does not mutate the input array", () => {
    const input: readonly HiddenRepEventLike[] = [
      { userId: 2, points: 1 },
      { userId: 1, points: 1 },
    ];
    const snapshot = [...input];
    accumulateHiddenRep(input);
    expect(input).toEqual(snapshot);
  });
});

interface HiddenRepEventLike {
  readonly userId: number;
  readonly points: number;
}
