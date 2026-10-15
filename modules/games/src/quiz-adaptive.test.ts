import { describe, expect, it } from "vitest";
import {
  accuracy,
  nextDifficulty,
  QUIZ_LOWER_THRESHOLD,
  QUIZ_RAISE_THRESHOLD,
  type QuizDifficulty,
  type QuizPerf,
} from "./quiz-adaptive.js";

const perf = (correct: number, total: number): QuizPerf => ({
  correct,
  total,
});

describe("accuracy", () => {
  it("returns the correct/total ratio for a normal case", () => {
    expect(accuracy(perf(8, 10))).toBeCloseTo(0.8);
  });

  it("returns 0 when total is 0", () => {
    expect(accuracy(perf(0, 0))).toBe(0);
  });

  it("returns 0 when total is 0 even with positive correct", () => {
    expect(accuracy(perf(5, 0))).toBe(0);
  });

  it("returns 0 for negative total", () => {
    expect(accuracy(perf(3, -4))).toBe(0);
  });

  it("treats negative correct as 0", () => {
    expect(accuracy(perf(-3, 10))).toBe(0);
  });

  it("caps the result at 1 when correct exceeds total", () => {
    expect(accuracy(perf(12, 10))).toBe(1);
  });

  it("returns 1 for a perfect score", () => {
    expect(accuracy(perf(10, 10))).toBe(1);
  });

  it("is deterministic for identical inputs", () => {
    expect(accuracy(perf(3, 7))).toBe(accuracy(perf(3, 7)));
  });
});

describe("nextDifficulty", () => {
  it("raises difficulty on high accuracy", () => {
    expect(nextDifficulty(2, perf(9, 10))).toBe(3);
  });

  it("lowers difficulty on low accuracy", () => {
    expect(nextDifficulty(3, perf(1, 10))).toBe(2);
  });

  it("keeps difficulty in the middle zone", () => {
    expect(nextDifficulty(3, perf(6, 10))).toBe(3);
  });

  it("raises exactly at the raise threshold", () => {
    expect(accuracy(perf(8, 10))).toBeCloseTo(QUIZ_RAISE_THRESHOLD);
    expect(nextDifficulty(2, perf(8, 10))).toBe(3);
  });

  it("does not lower exactly at the lower threshold", () => {
    expect(accuracy(perf(4, 10))).toBeCloseTo(QUIZ_LOWER_THRESHOLD);
    expect(nextDifficulty(3, perf(4, 10))).toBe(3);
  });

  it("lowers just below the lower threshold", () => {
    expect(nextDifficulty(3, perf(3, 10))).toBe(2);
  });

  it("clamps at the maximum of 5 when raising", () => {
    expect(nextDifficulty(5, perf(10, 10))).toBe(5);
  });

  it("clamps at the minimum of 1 when lowering", () => {
    expect(nextDifficulty(1, perf(0, 10))).toBe(1);
  });

  it("keeps difficulty unchanged when no questions answered", () => {
    const levels: readonly QuizDifficulty[] = [1, 2, 3, 4, 5];
    for (const level of levels) {
      expect(nextDifficulty(level, perf(0, 0))).toBe(level);
    }
  });

  it("keeps difficulty unchanged for negative total", () => {
    expect(nextDifficulty(4, perf(2, -1))).toBe(4);
  });

  it("raises from 4 to 5 on a perfect score", () => {
    expect(nextDifficulty(4, perf(5, 5))).toBe(5);
  });

  it("lowers from 2 to 1 on a total miss", () => {
    expect(nextDifficulty(2, perf(0, 5))).toBe(1);
  });

  it("treats out-of-range accuracy (correct > total) as a raise", () => {
    expect(nextDifficulty(2, perf(20, 10))).toBe(3);
  });

  it("is deterministic for identical inputs", () => {
    expect(nextDifficulty(3, perf(9, 10))).toBe(nextDifficulty(3, perf(9, 10)));
  });
});
