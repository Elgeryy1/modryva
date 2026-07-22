import { describe, expect, it } from "vitest";
import { resolveDebateDuel } from "./debate-duel.js";

describe("resolveDebateDuel", () => {
  it("declares side a the winner when it has more votes", () => {
    expect(resolveDebateDuel({ votesA: 10, votesB: 4 })).toEqual({
      winner: "a",
      margin: 6,
      disqualified: [],
    });
  });

  it("declares side b the winner when it has more votes", () => {
    expect(resolveDebateDuel({ votesA: 3, votesB: 9 })).toEqual({
      winner: "b",
      margin: 6,
      disqualified: [],
    });
  });

  it("returns empate on a vote tie", () => {
    expect(resolveDebateDuel({ votesA: 5, votesB: 5 })).toEqual({
      winner: "empate",
      margin: 0,
      disqualified: [],
    });
  });

  it("returns empate with zero votes on both sides", () => {
    expect(resolveDebateDuel({ votesA: 0, votesB: 0 })).toEqual({
      winner: "empate",
      margin: 0,
      disqualified: [],
    });
  });

  it("disqualifies side a for insults, handing the win to b", () => {
    expect(
      resolveDebateDuel({ votesA: 10, votesB: 4, aInsulted: true }),
    ).toEqual({
      winner: "b",
      margin: 6,
      disqualified: ["a"],
    });
  });

  it("disqualifies side b for insults, handing the win to a", () => {
    expect(
      resolveDebateDuel({ votesA: 3, votesB: 9, bInsulted: true }),
    ).toEqual({
      winner: "a",
      margin: 6,
      disqualified: ["b"],
    });
  });

  it("returns empate when both sides are disqualified, in a,b order", () => {
    expect(
      resolveDebateDuel({
        votesA: 8,
        votesB: 3,
        aInsulted: true,
        bInsulted: true,
      }),
    ).toEqual({
      winner: "empate",
      margin: 5,
      disqualified: ["a", "b"],
    });
  });

  it("clamps negative votes to zero before deciding", () => {
    expect(resolveDebateDuel({ votesA: -5, votesB: 3 })).toEqual({
      winner: "b",
      margin: 3,
      disqualified: [],
    });
  });

  it("treats non-finite votes as zero", () => {
    expect(resolveDebateDuel({ votesA: Number.NaN, votesB: 2 })).toEqual({
      winner: "b",
      margin: 2,
      disqualified: [],
    });
  });

  it("floors fractional votes to whole counts", () => {
    expect(resolveDebateDuel({ votesA: 5.9, votesB: 2.1 })).toEqual({
      winner: "a",
      margin: 3,
      disqualified: [],
    });
  });

  it("is deterministic for repeated identical inputs", () => {
    const input = { votesA: 7, votesB: 4, aInsulted: true } as const;
    const first = resolveDebateDuel(input);
    const second = resolveDebateDuel(input);
    expect(first).toEqual(second);
  });
});
