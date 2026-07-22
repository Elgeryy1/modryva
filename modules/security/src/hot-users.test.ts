import { describe, expect, it } from "vitest";
import { listHotUsers } from "./hot-users.js";

describe("listHotUsers", () => {
  it("aggregates the peak tension per user", () => {
    expect(
      listHotUsers([
        { userId: 1, tension: 5 },
        { userId: 1, tension: 9 },
        { userId: 1, tension: 7 },
      ]),
    ).toEqual([{ userId: 1, tension: 9 }]);
  });

  it("drops users below the default minTension of 5", () => {
    expect(
      listHotUsers([
        { userId: 1, tension: 4 },
        { userId: 2, tension: 5 },
      ]),
    ).toEqual([{ userId: 2, tension: 5 }]);
  });

  it("sorts by tension descending, breaking ties by userId ascending", () => {
    expect(
      listHotUsers([
        { userId: 3, tension: 8 },
        { userId: 1, tension: 8 },
        { userId: 2, tension: 9 },
      ]),
    ).toEqual([
      { userId: 2, tension: 9 },
      { userId: 1, tension: 8 },
      { userId: 3, tension: 8 },
    ]);
  });

  it("honours a custom minTension floor", () => {
    expect(
      listHotUsers(
        [
          { userId: 1, tension: 6 },
          { userId: 2, tension: 9 },
        ],
        { minTension: 8 },
      ),
    ).toEqual([{ userId: 2, tension: 9 }]);
  });

  it("limits the result to topN entries", () => {
    expect(
      listHotUsers(
        [
          { userId: 1, tension: 10 },
          { userId: 2, tension: 9 },
          { userId: 3, tension: 8 },
        ],
        { topN: 2 },
      ),
    ).toEqual([
      { userId: 1, tension: 10 },
      { userId: 2, tension: 9 },
    ]);
  });

  it("returns an empty list for empty input", () => {
    expect(listHotUsers([])).toEqual([]);
  });

  it("returns an empty list when topN is zero or negative", () => {
    expect(listHotUsers([{ userId: 1, tension: 9 }], { topN: 0 })).toEqual([]);
    expect(listHotUsers([{ userId: 1, tension: 9 }], { topN: -3 })).toEqual([]);
  });

  it("floors a fractional topN", () => {
    expect(
      listHotUsers(
        [
          { userId: 1, tension: 10 },
          { userId: 2, tension: 9 },
        ],
        { topN: 1.9 },
      ),
    ).toEqual([{ userId: 1, tension: 10 }]);
  });

  it("treats minTension as an inclusive boundary", () => {
    expect(
      listHotUsers([{ userId: 7, tension: 5 }], { minTension: 5 }),
    ).toEqual([{ userId: 7, tension: 5 }]);
  });

  it("is order-independent for the same readings", () => {
    const forward = listHotUsers([
      { userId: 1, tension: 6 },
      { userId: 2, tension: 9 },
      { userId: 3, tension: 6 },
    ]);
    const shuffled = listHotUsers([
      { userId: 3, tension: 6 },
      { userId: 2, tension: 9 },
      { userId: 1, tension: 6 },
    ]);
    expect(shuffled).toEqual(forward);
    expect(forward).toEqual([
      { userId: 2, tension: 9 },
      { userId: 1, tension: 6 },
      { userId: 3, tension: 6 },
    ]);
  });
});
