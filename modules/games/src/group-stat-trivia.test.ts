import { describe, expect, it } from "vitest";
import { scoreStatGuess } from "./group-stat-trivia.js";

describe("scoreStatGuess", () => {
  it("scores an exact guess with full points", () => {
    expect(scoreStatGuess({ guess: 100, actual: 100 })).toEqual({
      correct: true,
      offBy: 0,
      points: 10,
    });
  });

  it("accepts a guess within tolerance", () => {
    expect(scoreStatGuess({ guess: 105, actual: 100 })).toEqual({
      correct: true,
      offBy: 5,
      points: 5,
    });
  });

  it("rejects a guess outside tolerance", () => {
    expect(scoreStatGuess({ guess: 130, actual: 100 })).toEqual({
      correct: false,
      offBy: 30,
      points: 0,
    });
  });

  it("awards at least one point for a correct guess at the edge", () => {
    expect(
      scoreStatGuess({ guess: 110, actual: 100 }).points,
    ).toBeGreaterThanOrEqual(1);
  });

  it("guards a zero actual", () => {
    expect(scoreStatGuess({ guess: 0, actual: 0 })).toEqual({
      correct: true,
      offBy: 0,
      points: 10,
    });
    expect(scoreStatGuess({ guess: 3, actual: 0 })).toEqual({
      correct: false,
      offBy: 3,
      points: 0,
    });
  });

  it("honors a custom tolerance", () => {
    expect(
      scoreStatGuess({ guess: 120, actual: 100 }, { tolerancePct: 25 }).correct,
    ).toBe(true);
  });
});
