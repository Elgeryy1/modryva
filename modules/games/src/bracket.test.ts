import { describe, expect, it } from "vitest";
import {
  advanceBracket,
  BRACKET_BYE,
  type BracketMatch,
  buildBracketRound,
} from "./bracket.js";

describe("buildBracketRound", () => {
  it("returns an empty round for zero entrants", () => {
    expect(buildBracketRound([])).toEqual([]);
  });

  it("gives a lone entrant a bye", () => {
    expect(buildBracketRound(["ana"])).toEqual([{ a: "ana", b: BRACKET_BYE }]);
  });

  it("pairs two entrants into a single match", () => {
    expect(buildBracketRound(["ana", "bob"])).toEqual([{ a: "ana", b: "bob" }]);
  });

  it("pairs consecutive entrants in received order", () => {
    expect(buildBracketRound(["a", "b", "c", "d"])).toEqual([
      { a: "a", b: "b" },
      { a: "c", b: "d" },
    ]);
  });

  it("gives the last entrant a bye when the count is odd", () => {
    expect(buildBracketRound(["a", "b", "c"])).toEqual([
      { a: "a", b: "b" },
      { a: "c", b: BRACKET_BYE },
    ]);
  });

  it("handles a larger odd field with one trailing bye", () => {
    const round = buildBracketRound(["a", "b", "c", "d", "e"]);
    expect(round).toEqual([
      { a: "a", b: "b" },
      { a: "c", b: "d" },
      { a: "e", b: BRACKET_BYE },
    ]);
  });

  it("produces floor(n/2) plus one bye matches for odd n", () => {
    expect(buildBracketRound(["a", "b", "c", "d", "e", "f", "g"])).toHaveLength(
      4,
    );
  });

  it("produces exactly n/2 matches for even n", () => {
    expect(buildBracketRound(["a", "b", "c", "d", "e", "f"])).toHaveLength(3);
  });

  it("marks a bye only via BRACKET_BYE on the b side", () => {
    const round = buildBracketRound(["solo"]);
    const first = round[0];
    expect(first).toBeDefined();
    if (first !== undefined) {
      expect(first.a).toBe("solo");
      expect(first.b).toBe(BRACKET_BYE);
    }
  });

  it("preserves duplicate names as distinct slots", () => {
    expect(buildBracketRound(["x", "x", "x"])).toEqual([
      { a: "x", b: "x" },
      { a: "x", b: BRACKET_BYE },
    ]);
  });

  it("is deterministic across repeated calls", () => {
    const entrants = ["a", "b", "c", "d", "e"];
    expect(buildBracketRound(entrants)).toEqual(buildBracketRound(entrants));
  });

  it("does not mutate the input array", () => {
    const entrants = ["a", "b", "c"];
    buildBracketRound(entrants);
    expect(entrants).toEqual(["a", "b", "c"]);
  });
});

describe("advanceBracket", () => {
  it("returns an empty round with no winners", () => {
    expect(advanceBracket([])).toEqual([]);
  });

  it("returns an empty round when a champion remains", () => {
    expect(advanceBracket(["champ"])).toEqual([]);
  });

  it("pairs two winners into the final match", () => {
    expect(advanceBracket(["ana", "bob"])).toEqual([{ a: "ana", b: "bob" }]);
  });

  it("gives the last winner a bye when the count is odd", () => {
    expect(advanceBracket(["a", "b", "c"])).toEqual([
      { a: "a", b: "b" },
      { a: "c", b: BRACKET_BYE },
    ]);
  });

  it("matches buildBracketRound for two or more winners", () => {
    const winners = ["a", "b", "c", "d", "e"];
    expect(advanceBracket(winners)).toEqual(buildBracketRound(winners));
  });

  it("drives a full four-entrant tournament to a champion", () => {
    const round1 = buildBracketRound(["a", "b", "c", "d"]);
    expect(round1).toHaveLength(2);
    const round2 = advanceBracket(["a", "c"]);
    expect(round2).toEqual([{ a: "a", b: "c" }]);
    const done = advanceBracket(["a"]);
    expect(done).toEqual([]);
  });

  it("propagates a bye winner into the next round", () => {
    const round1 = buildBracketRound(["a", "b", "c"]);
    const winners: readonly string[] = [round1[0]?.a ?? "", "c"];
    expect(advanceBracket(winners)).toEqual([{ a: "a", b: "c" }]);
  });

  it("is deterministic across repeated calls", () => {
    const winners = ["a", "b", "c"];
    expect(advanceBracket(winners)).toEqual(advanceBracket(winners));
  });
});

describe("BracketMatch shape", () => {
  it("always carries both string sides", () => {
    const round = buildBracketRound(["a", "b", "c"]);
    for (const match of round) {
      const m: BracketMatch = match;
      expect(typeof m.a).toBe("string");
      expect(typeof m.b).toBe("string");
    }
  });
});
