import { describe, expect, it } from "vitest";
import { rankVotedIdeas, type VotedIdea } from "./idea-voting.js";

describe("rankVotedIdeas", () => {
  it("sorts by votes descending and assigns 1-based ranks", () => {
    const ideas: readonly VotedIdea[] = [
      { id: "a", title: "Antispam", votes: 3 },
      { id: "b", title: "Bienvenida", votes: 10 },
      { id: "c", title: "Captcha", votes: 7 },
    ];
    expect(rankVotedIdeas(ideas)).toEqual([
      { id: "b", title: "Bienvenida", votes: 10, rank: 1 },
      { id: "c", title: "Captcha", votes: 7, rank: 2 },
      { id: "a", title: "Antispam", votes: 3, rank: 3 },
    ]);
  });

  it("breaks vote ties by title ascending", () => {
    const ideas: readonly VotedIdea[] = [
      { id: "z", title: "Zeta", votes: 5 },
      { id: "a", title: "Alfa", votes: 5 },
      { id: "m", title: "Media", votes: 5 },
    ];
    expect(rankVotedIdeas(ideas).map((i) => i.id)).toEqual(["a", "m", "z"]);
  });

  it("compares titles case-insensitively for the tiebreak", () => {
    const ideas: readonly VotedIdea[] = [
      { id: "1", title: "banano", votes: 2 },
      { id: "2", title: "Apple", votes: 2 },
    ];
    expect(rankVotedIdeas(ideas).map((i) => i.title)).toEqual([
      "Apple",
      "banano",
    ]);
  });

  it("uses case-sensitive title as final stable tiebreak", () => {
    const ideas: readonly VotedIdea[] = [
      { id: "lower", title: "juegos", votes: 4 },
      { id: "upper", title: "Juegos", votes: 4 },
    ];
    expect(rankVotedIdeas(ideas).map((i) => i.id)).toEqual(["upper", "lower"]);
  });

  it("returns an empty array for empty input", () => {
    expect(rankVotedIdeas([])).toEqual([]);
  });

  it("handles a single idea", () => {
    expect(rankVotedIdeas([{ id: "solo", title: "Solo", votes: 0 }])).toEqual([
      { id: "solo", title: "Solo", votes: 0, rank: 1 },
    ]);
  });

  it("handles zero and negative votes as valid counts", () => {
    const ideas: readonly VotedIdea[] = [
      { id: "neg", title: "Negativa", votes: -2 },
      { id: "zero", title: "Cero", votes: 0 },
      { id: "pos", title: "Positiva", votes: 1 },
    ];
    expect(rankVotedIdeas(ideas).map((i) => i.id)).toEqual([
      "pos",
      "zero",
      "neg",
    ]);
  });

  it("preserves Spanish titles with accents unchanged", () => {
    const ideas: readonly VotedIdea[] = [
      { id: "mod", title: "Moderación", votes: 8 },
    ];
    const ranked = rankVotedIdeas(ideas);
    expect(ranked[0]?.title).toBe("Moderación");
  });

  it("does not mutate the input array", () => {
    const ideas: readonly VotedIdea[] = [
      { id: "a", title: "Alfa", votes: 1 },
      { id: "b", title: "Beta", votes: 9 },
    ];
    const snapshot = [...ideas];
    rankVotedIdeas(ideas);
    expect(ideas).toEqual(snapshot);
  });

  it("is deterministic across repeated calls", () => {
    const ideas: readonly VotedIdea[] = [
      { id: "a", title: "Alfa", votes: 5 },
      { id: "b", title: "Beta", votes: 5 },
      { id: "c", title: "Gamma", votes: 6 },
    ];
    expect(rankVotedIdeas(ideas)).toEqual(rankVotedIdeas(ideas));
  });

  it("assigns consecutive ranks even when all votes are equal", () => {
    const ideas: readonly VotedIdea[] = [
      { id: "b", title: "Beta", votes: 3 },
      { id: "a", title: "Alfa", votes: 3 },
      { id: "c", title: "Gamma", votes: 3 },
    ];
    expect(rankVotedIdeas(ideas).map((i) => i.rank)).toEqual([1, 2, 3]);
  });
});
