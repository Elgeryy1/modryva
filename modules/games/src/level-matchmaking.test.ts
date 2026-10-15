import { describe, expect, it } from "vitest";
import { matchByLevel } from "./level-matchmaking.js";

describe("matchByLevel", () => {
  it("pairs consecutive players sorted by level ascending", () => {
    expect(
      matchByLevel([
        { id: "a", level: 1 },
        { id: "b", level: 1 },
        { id: "c", level: 2 },
        { id: "d", level: 2 },
      ]),
    ).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });

  it("sorts by level regardless of input order", () => {
    expect(
      matchByLevel([
        { id: "z", level: 5 },
        { id: "y", level: 1 },
        { id: "x", level: 3 },
        { id: "w", level: 2 },
      ]),
    ).toEqual([
      ["y", "w"],
      ["x", "z"],
    ]);
  });

  it("breaks level ties by id ascending", () => {
    expect(
      matchByLevel([
        { id: "c", level: 1 },
        { id: "a", level: 1 },
        { id: "d", level: 1 },
        { id: "b", level: 1 },
      ]),
    ).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });

  it("drops the odd one out when the count is odd", () => {
    expect(
      matchByLevel([
        { id: "a", level: 1 },
        { id: "b", level: 2 },
        { id: "c", level: 3 },
      ]),
    ).toEqual([["a", "b"]]);
  });

  it("returns an empty list for no players", () => {
    expect(matchByLevel([])).toEqual([]);
  });

  it("returns an empty list for a single player", () => {
    expect(matchByLevel([{ id: "solo", level: 7 }])).toEqual([]);
  });

  it("orders a single pair by id when levels are equal", () => {
    expect(
      matchByLevel([
        { id: "b", level: 5 },
        { id: "a", level: 5 },
      ]),
    ).toEqual([["a", "b"]]);
  });

  it("compares ids lexicographically, not numerically", () => {
    expect(
      matchByLevel([
        { id: "9", level: 1 },
        { id: "10", level: 1 },
      ]),
    ).toEqual([["10", "9"]]);
  });

  it("handles negative and duplicated levels", () => {
    expect(
      matchByLevel([
        { id: "a", level: -1 },
        { id: "b", level: 0 },
        { id: "c", level: -1 },
        { id: "d", level: 0 },
        { id: "e", level: 2 },
      ]),
    ).toEqual([
      ["a", "c"],
      ["b", "d"],
    ]);
  });

  it("does not mutate the input array", () => {
    const input = [
      { id: "b", level: 2 },
      { id: "a", level: 1 },
    ];
    const snapshot = [...input];
    matchByLevel(input);
    expect(input).toEqual(snapshot);
  });

  it("is deterministic across repeated calls", () => {
    const players = [
      { id: "d", level: 3 },
      { id: "a", level: 1 },
      { id: "c", level: 3 },
      { id: "b", level: 1 },
    ];
    const first = matchByLevel(players);
    const second = matchByLevel(players);
    expect(first).toEqual(second);
    expect(first).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });
});
