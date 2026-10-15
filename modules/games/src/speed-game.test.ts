import { describe, expect, it } from "vitest";
import {
  rankSpeedAnswers,
  type SpeedAnswer,
  speedWinner,
} from "./speed-game.js";

const answer = (overrides: Partial<SpeedAnswer> = {}): SpeedAnswer => ({
  userId: "u1",
  correct: true,
  ms: 1_000,
  ...overrides,
});

describe("rankSpeedAnswers", () => {
  it("returns empty for no answers", () => {
    expect(rankSpeedAnswers([])).toEqual([]);
  });

  it("returns empty when all answers are incorrect", () => {
    const answers = [
      answer({ userId: "a", correct: false, ms: 100 }),
      answer({ userId: "b", correct: false, ms: 200 }),
    ];
    expect(rankSpeedAnswers(answers)).toEqual([]);
  });

  it("keeps only correct answers", () => {
    const answers = [
      answer({ userId: "a", correct: false, ms: 100 }),
      answer({ userId: "b", correct: true, ms: 200 }),
      answer({ userId: "c", correct: false, ms: 50 }),
    ];
    expect(rankSpeedAnswers(answers)).toEqual([{ userId: "b", ms: 200 }]);
  });

  it("sorts correct answers by ms ascending", () => {
    const answers = [
      answer({ userId: "a", ms: 300 }),
      answer({ userId: "b", ms: 100 }),
      answer({ userId: "c", ms: 200 }),
    ];
    expect(rankSpeedAnswers(answers)).toEqual([
      { userId: "b", ms: 100 },
      { userId: "c", ms: 200 },
      { userId: "a", ms: 300 },
    ]);
  });

  it("is a stable sort on ms ties (preserves input order)", () => {
    const answers = [
      answer({ userId: "a", ms: 500 }),
      answer({ userId: "b", ms: 500 }),
      answer({ userId: "c", ms: 500 }),
    ];
    expect(rankSpeedAnswers(answers)).toEqual([
      { userId: "a", ms: 500 },
      { userId: "b", ms: 500 },
      { userId: "c", ms: 500 },
    ]);
  });

  it("mixes ties and distinct values keeping stability", () => {
    const answers = [
      answer({ userId: "a", ms: 200 }),
      answer({ userId: "b", ms: 100 }),
      answer({ userId: "c", ms: 200 }),
      answer({ userId: "d", ms: 100 }),
    ];
    expect(rankSpeedAnswers(answers)).toEqual([
      { userId: "b", ms: 100 },
      { userId: "d", ms: 100 },
      { userId: "a", ms: 200 },
      { userId: "c", ms: 200 },
    ]);
  });

  it("drops incorrect answers even when they are faster", () => {
    const answers = [
      answer({ userId: "fast", correct: false, ms: 1 }),
      answer({ userId: "slow", correct: true, ms: 999 }),
    ];
    expect(rankSpeedAnswers(answers)).toEqual([{ userId: "slow", ms: 999 }]);
  });

  it("handles a single correct answer", () => {
    expect(rankSpeedAnswers([answer({ userId: "solo", ms: 42 })])).toEqual([
      { userId: "solo", ms: 42 },
    ]);
  });

  it("handles zero and negative ms values by numeric order", () => {
    const answers = [
      answer({ userId: "a", ms: 0 }),
      answer({ userId: "b", ms: -50 }),
      answer({ userId: "c", ms: 10 }),
    ];
    expect(rankSpeedAnswers(answers)).toEqual([
      { userId: "b", ms: -50 },
      { userId: "a", ms: 0 },
      { userId: "c", ms: 10 },
    ]);
  });

  it("does not mutate the input array", () => {
    const answers = [
      answer({ userId: "a", ms: 300 }),
      answer({ userId: "b", ms: 100 }),
    ];
    const snapshot = [...answers];
    rankSpeedAnswers(answers);
    expect(answers).toEqual(snapshot);
  });

  it("is deterministic for identical inputs", () => {
    const answers = [
      answer({ userId: "a", ms: 200 }),
      answer({ userId: "b", ms: 100 }),
      answer({ userId: "c", ms: 200 }),
    ];
    expect(rankSpeedAnswers(answers)).toEqual(rankSpeedAnswers(answers));
  });

  it("projects only userId and ms into the result entries", () => {
    const result = rankSpeedAnswers([answer({ userId: "x", ms: 7 })]);
    expect(result).toEqual([{ userId: "x", ms: 7 }]);
    expect(Object.keys(result[0] ?? {})).toEqual(["userId", "ms"]);
  });
});

describe("speedWinner", () => {
  it("returns null for no answers", () => {
    expect(speedWinner([])).toBeNull();
  });

  it("returns null when no answer is correct", () => {
    const answers = [
      answer({ userId: "a", correct: false, ms: 1 }),
      answer({ userId: "b", correct: false, ms: 2 }),
    ];
    expect(speedWinner(answers)).toBeNull();
  });

  it("returns the fastest correct userId", () => {
    const answers = [
      answer({ userId: "a", ms: 300 }),
      answer({ userId: "b", ms: 100 }),
      answer({ userId: "c", ms: 200 }),
    ];
    expect(speedWinner(answers)).toBe("b");
  });

  it("breaks ms ties by first appearance", () => {
    const answers = [
      answer({ userId: "first", ms: 150 }),
      answer({ userId: "second", ms: 150 }),
    ];
    expect(speedWinner(answers)).toBe("first");
  });

  it("ignores faster incorrect answers", () => {
    const answers = [
      answer({ userId: "wrong", correct: false, ms: 1 }),
      answer({ userId: "right", correct: true, ms: 500 }),
    ];
    expect(speedWinner(answers)).toBe("right");
  });

  it("agrees with the head of rankSpeedAnswers", () => {
    const answers = [
      answer({ userId: "a", ms: 200 }),
      answer({ userId: "b", ms: 100 }),
    ];
    const ranked = rankSpeedAnswers(answers);
    expect(speedWinner(answers)).toBe(ranked[0]?.userId ?? null);
  });

  it("is deterministic for identical inputs", () => {
    const answers = [answer({ userId: "a", ms: 5 })];
    expect(speedWinner(answers)).toBe(speedWinner(answers));
  });
});
