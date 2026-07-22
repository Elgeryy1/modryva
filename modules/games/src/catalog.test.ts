import { describe, expect, it } from "vitest";
import {
  GAME_IDS,
  isGameId,
  isPlausibleScore,
  scoreToPoints,
} from "./catalog.js";

describe("game catalog", () => {
  it("lists the catalog games", () => {
    expect(GAME_IDS).toEqual([
      "reflex",
      "quiz-arcade",
      "memory",
      "math-sprint",
      "tictactoe",
      "rps",
    ]);
    expect(isGameId("reflex")).toBe(true);
    expect(isGameId("memory")).toBe(true);
    expect(isGameId("tictactoe")).toBe(true);
    expect(isGameId("rps")).toBe(true);
    expect(isGameId("snake")).toBe(false);
  });

  it("rejects implausible scores", () => {
    // reflex: raw 0..100, elapsed 800..120000 ms
    expect(isPlausibleScore("reflex", 80, 5_000)).toBe(true);
    expect(isPlausibleScore("reflex", 80, 100)).toBe(false); // too fast
    expect(isPlausibleScore("reflex", 200, 5_000)).toBe(false); // over max
    expect(isPlausibleScore("reflex", -1, 5_000)).toBe(false);
    expect(isPlausibleScore("reflex", Number.NaN, 5_000)).toBe(false);
    expect(isPlausibleScore("quiz-arcade", 8, 40_000)).toBe(true);
    expect(isPlausibleScore("quiz-arcade", 8, 1_000)).toBe(false); // too fast
    // tictactoe: raw 0..3 (win 3 / draw 1 / loss 0), rps: raw 0..5 (rounds won)
    expect(isPlausibleScore("tictactoe", 3, 4_000)).toBe(true);
    expect(isPlausibleScore("tictactoe", 4, 4_000)).toBe(false); // over max
    expect(isPlausibleScore("rps", 5, 6_000)).toBe(true);
    expect(isPlausibleScore("rps", 6, 6_000)).toBe(false); // over max
    expect(isPlausibleScore("rps", 5, 100)).toBe(false); // too fast
  });

  it("normalizes raw scores to 0..3 points", () => {
    expect(scoreToPoints("quiz-arcade", 8)).toBe(3); // perfect
    expect(scoreToPoints("quiz-arcade", 0)).toBe(0);
    expect(scoreToPoints("quiz-arcade", 4)).toBe(2); // half -> ~1.5 -> 2
    expect(scoreToPoints("reflex", 100)).toBe(3);
    expect(scoreToPoints("reflex", 50)).toBe(2);
    expect(scoreToPoints("reflex", 999)).toBe(3); // clamped
    expect(scoreToPoints("tictactoe", 3)).toBe(3); // win
    expect(scoreToPoints("tictactoe", 1)).toBe(1); // draw
    expect(scoreToPoints("tictactoe", 0)).toBe(0); // loss
    expect(scoreToPoints("rps", 5)).toBe(3); // swept the set
    expect(scoreToPoints("rps", 0)).toBe(0);
  });
});
