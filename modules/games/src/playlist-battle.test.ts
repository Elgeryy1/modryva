import { describe, expect, it } from "vitest";
import { resolvePlaylistBattle } from "./playlist-battle.js";

describe("resolvePlaylistBattle", () => {
  it("ranks songs by votes descending", () => {
    expect(
      resolvePlaylistBattle([
        { songId: "a", votes: 3 },
        { songId: "b", votes: 9 },
        { songId: "c", votes: 5 },
      ]),
    ).toEqual([
      { songId: "b", votes: 9, rank: 1 },
      { songId: "c", votes: 5, rank: 2 },
      { songId: "a", votes: 3, rank: 3 },
    ]);
  });

  it("breaks vote ties by songId ascending", () => {
    expect(
      resolvePlaylistBattle([
        { songId: "z", votes: 4 },
        { songId: "a", votes: 4 },
      ]).map((song) => song.songId),
    ).toEqual(["a", "z"]);
  });

  it("returns empty for no songs", () => {
    expect(resolvePlaylistBattle([])).toEqual([]);
  });

  it("does not mutate the input", () => {
    const input = [
      { songId: "a", votes: 1 },
      { songId: "b", votes: 2 },
    ];
    const snapshot = JSON.parse(JSON.stringify(input));
    resolvePlaylistBattle(input);
    expect(input).toEqual(snapshot);
  });
});
