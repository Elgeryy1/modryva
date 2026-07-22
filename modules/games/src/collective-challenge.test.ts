import { describe, expect, it } from "vitest";
import { scoreCollectiveChallenge } from "./collective-challenge.js";

describe("scoreCollectiveChallenge", () => {
  it("scores a winning group with default pass ratio", () => {
    const answers = [
      { correct: true },
      { correct: true },
      { correct: true },
      { correct: false },
    ];
    expect(scoreCollectiveChallenge(answers)).toEqual({
      correct: 3,
      total: 4,
      ratio: 0.75,
      won: true,
    });
  });

  it("scores a losing group below the default pass ratio", () => {
    const answers = [
      { correct: true },
      { correct: false },
      { correct: false },
      { correct: false },
    ];
    expect(scoreCollectiveChallenge(answers)).toEqual({
      correct: 1,
      total: 4,
      ratio: 0.25,
      won: false,
    });
  });

  it("treats the pass ratio boundary as a win", () => {
    const answers = [
      { correct: true },
      { correct: true },
      { correct: true },
      { correct: false },
      { correct: false },
    ];
    expect(scoreCollectiveChallenge(answers)).toEqual({
      correct: 3,
      total: 5,
      ratio: 0.6,
      won: true,
    });
  });

  it("rounds the ratio to two decimals", () => {
    const answers = [{ correct: true }, { correct: true }, { correct: false }];
    expect(scoreCollectiveChallenge(answers)).toEqual({
      correct: 2,
      total: 3,
      ratio: 0.67,
      won: true,
    });
  });

  it("honors a custom pass ratio that turns a win into a loss", () => {
    const answers = [{ correct: true }, { correct: true }, { correct: false }];
    expect(scoreCollectiveChallenge(answers, { passRatio: 0.7 })).toEqual({
      correct: 2,
      total: 3,
      ratio: 0.67,
      won: false,
    });
  });

  it("returns zeroed loss for an empty group", () => {
    expect(scoreCollectiveChallenge([])).toEqual({
      correct: 0,
      total: 0,
      ratio: 0,
      won: false,
    });
  });

  it("stays a loss on empty input even with a zero pass ratio", () => {
    expect(scoreCollectiveChallenge([], { passRatio: 0 })).toEqual({
      correct: 0,
      total: 0,
      ratio: 0,
      won: false,
    });
  });

  it("handles a perfect score", () => {
    const answers = [{ correct: true }, { correct: true }];
    expect(scoreCollectiveChallenge(answers)).toEqual({
      correct: 2,
      total: 2,
      ratio: 1,
      won: true,
    });
  });

  it("handles a single wrong answer", () => {
    expect(scoreCollectiveChallenge([{ correct: false }])).toEqual({
      correct: 0,
      total: 1,
      ratio: 0,
      won: false,
    });
  });

  it("is deterministic across repeated calls", () => {
    const answers = [{ correct: true }, { correct: false }, { correct: true }];
    const first = scoreCollectiveChallenge(answers);
    const second = scoreCollectiveChallenge(answers);
    expect(first).toEqual(second);
  });
});
