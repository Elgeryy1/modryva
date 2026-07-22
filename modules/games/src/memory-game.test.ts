import { describe, expect, it } from "vitest";
import { checkMemoryAnswer, generateMemorySequence } from "./memory-game.js";

describe("generateMemorySequence", () => {
  it("produces a sequence of the requested length", () => {
    expect(generateMemorySequence(1, 5, 9)).toHaveLength(5);
    expect(generateMemorySequence(42, 12, 3)).toHaveLength(12);
  });

  it("is deterministic for identical inputs", () => {
    expect(generateMemorySequence(123, 8, 6)).toEqual(
      generateMemorySequence(123, 8, 6),
    );
  });

  it("varies with the seed", () => {
    const a = generateMemorySequence(1, 20, 100);
    const b = generateMemorySequence(2, 20, 100);
    expect(a).not.toEqual(b);
  });

  it("keeps every value within [0, maxValue] inclusive", () => {
    const seq = generateMemorySequence(7, 50, 9);
    for (const value of seq) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(9);
      expect(Number.isInteger(value)).toBe(true);
    }
  });

  it("returns only zeros when maxValue is 0", () => {
    expect(generateMemorySequence(99, 6, 0)).toEqual([0, 0, 0, 0, 0, 0]);
  });

  it("returns an empty array for length 0", () => {
    expect(generateMemorySequence(5, 0, 9)).toEqual([]);
  });

  it("treats negative length as empty", () => {
    expect(generateMemorySequence(5, -3, 9)).toEqual([]);
  });

  it("treats negative maxValue as a zero range", () => {
    const seq = generateMemorySequence(5, 4, -10);
    expect(seq).toEqual([0, 0, 0, 0]);
  });

  it("floors non-integer length", () => {
    expect(generateMemorySequence(5, 4.9, 9)).toHaveLength(4);
  });

  it("floors non-integer maxValue when bounding values", () => {
    const seq = generateMemorySequence(11, 40, 5.9);
    for (const value of seq) {
      expect(value).toBeLessThanOrEqual(5);
    }
  });

  it("normalizes non-finite seed to a stable sequence", () => {
    expect(generateMemorySequence(Number.NaN, 5, 9)).toEqual(
      generateMemorySequence(0, 5, 9),
    );
  });

  it("normalizes non-finite length to empty", () => {
    expect(generateMemorySequence(1, Number.POSITIVE_INFINITY, 9)).toEqual([]);
  });

  it("can produce values across the full range over many draws", () => {
    const seq = generateMemorySequence(2026, 200, 4);
    const distinct = new Set(seq);
    expect(distinct.size).toBeGreaterThan(1);
  });

  it("is a plain readonly array of numbers", () => {
    const seq = generateMemorySequence(3, 3, 9);
    expect(Array.isArray(seq)).toBe(true);
    expect(seq.every((v) => typeof v === "number")).toBe(true);
  });
});

describe("checkMemoryAnswer", () => {
  it("reports fully correct when sequences are identical", () => {
    expect(checkMemoryAnswer([1, 2, 3], [1, 2, 3])).toEqual({
      correct: true,
      matched: 3,
    });
  });

  it("counts partial matches by position", () => {
    expect(checkMemoryAnswer([1, 2, 3, 4], [1, 9, 3, 9])).toEqual({
      correct: false,
      matched: 2,
    });
  });

  it("is not correct when the given answer is shorter", () => {
    expect(checkMemoryAnswer([1, 2, 3], [1, 2])).toEqual({
      correct: false,
      matched: 2,
    });
  });

  it("is not correct when the given answer is longer", () => {
    expect(checkMemoryAnswer([1, 2], [1, 2, 3])).toEqual({
      correct: false,
      matched: 2,
    });
  });

  it("counts zero matches when nothing lines up", () => {
    expect(checkMemoryAnswer([1, 2, 3], [4, 5, 6])).toEqual({
      correct: false,
      matched: 0,
    });
  });

  it("treats two empty sequences as correct with no matches", () => {
    expect(checkMemoryAnswer([], [])).toEqual({ correct: true, matched: 0 });
  });

  it("is not correct when only one sequence is empty", () => {
    expect(checkMemoryAnswer([], [1])).toEqual({ correct: false, matched: 0 });
    expect(checkMemoryAnswer([1], [])).toEqual({ correct: false, matched: 0 });
  });

  it("respects order (right numbers, wrong order)", () => {
    expect(checkMemoryAnswer([1, 2, 3], [3, 2, 1])).toEqual({
      correct: false,
      matched: 1,
    });
  });

  it("is deterministic for identical inputs", () => {
    const expectedSeq = [5, 5, 1, 0];
    const givenSeq = [5, 1, 1, 0];
    expect(checkMemoryAnswer(expectedSeq, givenSeq)).toEqual(
      checkMemoryAnswer(expectedSeq, givenSeq),
    );
  });

  it("validates a generated sequence against itself", () => {
    const seq = generateMemorySequence(555, 10, 9);
    expect(checkMemoryAnswer(seq, [...seq])).toEqual({
      correct: true,
      matched: 10,
    });
  });
});
