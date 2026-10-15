import { describe, expect, it } from "vitest";
import {
  type CreativityChallengeEntry,
  resolveCreativityChallenge,
} from "./creativity-challenge.js";

describe("resolveCreativityChallenge", () => {
  it("ranks by votes descending and picks the winner", () => {
    const result = resolveCreativityChallenge([
      { id: "b", votes: 3 },
      { id: "a", votes: 5 },
      { id: "c", votes: 1 },
    ]);
    expect(result).toEqual({
      winnerId: "a",
      ranking: [
        { id: "a", votes: 5 },
        { id: "b", votes: 3 },
        { id: "c", votes: 1 },
      ],
    });
  });

  it("breaks vote ties by id ascending", () => {
    const result = resolveCreativityChallenge([
      { id: "c", votes: 5 },
      { id: "a", votes: 5 },
      { id: "b", votes: 5 },
    ]);
    expect(result.winnerId).toBe("a");
    expect(result.ranking.map((e) => e.id)).toEqual(["a", "b", "c"]);
  });

  it("returns undefined winner and empty ranking for no entries", () => {
    expect(resolveCreativityChallenge([])).toEqual({
      winnerId: undefined,
      ranking: [],
    });
  });

  it("handles a single entry", () => {
    expect(resolveCreativityChallenge([{ id: "x", votes: 0 }])).toEqual({
      winnerId: "x",
      ranking: [{ id: "x", votes: 0 }],
    });
  });

  it("supports negative and zero vote counts", () => {
    const result = resolveCreativityChallenge([
      { id: "loser", votes: -4 },
      { id: "meh", votes: 0 },
      { id: "hero", votes: 7 },
    ]);
    expect(result.winnerId).toBe("hero");
    expect(result.ranking.map((e) => e.id)).toEqual(["hero", "meh", "loser"]);
  });

  it("orders zero-vote entries purely by id", () => {
    const result = resolveCreativityChallenge([
      { id: "z", votes: 0 },
      { id: "m", votes: 0 },
      { id: "a", votes: 0 },
    ]);
    expect(result.ranking.map((e) => e.id)).toEqual(["a", "m", "z"]);
    expect(result.winnerId).toBe("a");
  });

  it("does not mutate the input array", () => {
    const input: readonly CreativityChallengeEntry[] = [
      { id: "b", votes: 1 },
      { id: "a", votes: 2 },
    ];
    const snapshot = input.map((e) => e.id);
    resolveCreativityChallenge(input);
    expect(input.map((e) => e.id)).toEqual(snapshot);
  });

  it("is deterministic across repeated calls", () => {
    const input: readonly CreativityChallengeEntry[] = [
      { id: "d", votes: 2 },
      { id: "a", votes: 2 },
      { id: "c", votes: 9 },
      { id: "b", votes: 2 },
    ];
    const first = resolveCreativityChallenge(input);
    const second = resolveCreativityChallenge(input);
    expect(first).toEqual(second);
    expect(first.ranking.map((e) => e.id)).toEqual(["c", "a", "b", "d"]);
  });
});
