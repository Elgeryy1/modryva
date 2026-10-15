import { describe, expect, it } from "vitest";
import {
  decayWarnCount,
  msUntilNextReputationDecay,
  REPUTATION_DECAY_HALF_LIFE_MS,
  reputationDecaySteps,
} from "./reputation-decay.js";

const HALF = 100_000;

describe("REPUTATION_DECAY_HALF_LIFE_MS", () => {
  it("equals seven days in milliseconds", () => {
    expect(REPUTATION_DECAY_HALF_LIFE_MS).toBe(7 * 24 * 60 * 60 * 1000);
    expect(REPUTATION_DECAY_HALF_LIFE_MS).toBe(604_800_000);
  });
});

describe("decayWarnCount", () => {
  it("keeps the count unchanged when no time has elapsed", () => {
    expect(decayWarnCount(3, 0, 0, HALF)).toBe(3);
  });

  it("keeps the count unchanged below one half-life", () => {
    expect(decayWarnCount(3, 0, HALF - 1, HALF)).toBe(3);
  });

  it("drops one warn after exactly one half-life", () => {
    expect(decayWarnCount(3, 0, HALF, HALF)).toBe(2);
  });

  it("drops one warn per half-life elapsed", () => {
    expect(decayWarnCount(3, 0, 2 * HALF, HALF)).toBe(1);
  });

  it("clamps to zero when more half-lives pass than warns held", () => {
    expect(decayWarnCount(3, 0, 10 * HALF, HALF)).toBe(0);
  });

  it("never returns a negative count", () => {
    expect(decayWarnCount(1, 0, 5 * HALF, HALF)).toBe(0);
  });

  it("returns zero for a non-positive initial count", () => {
    expect(decayWarnCount(0, 0, HALF, HALF)).toBe(0);
    expect(decayWarnCount(-2, 0, 0, HALF)).toBe(0);
  });

  it("does not decay when now is before the last offense", () => {
    expect(decayWarnCount(2, 500, 0, HALF)).toBe(2);
  });

  it("does not decay when the half-life is zero", () => {
    expect(decayWarnCount(4, 0, 10 * HALF, 0)).toBe(4);
    expect(decayWarnCount(-1, 0, 10 * HALF, 0)).toBe(0);
  });

  it("does not decay when the half-life is negative", () => {
    expect(decayWarnCount(4, 0, 10 * HALF, -HALF)).toBe(4);
  });

  it("is deterministic for identical inputs", () => {
    expect(decayWarnCount(5, 1_000, 5_000, HALF)).toBe(
      decayWarnCount(5, 1_000, 5_000, HALF),
    );
  });

  it("works with the default half-life constant", () => {
    expect(
      decayWarnCount(
        3,
        0,
        REPUTATION_DECAY_HALF_LIFE_MS,
        REPUTATION_DECAY_HALF_LIFE_MS,
      ),
    ).toBe(2);
    expect(
      decayWarnCount(
        3,
        0,
        3 * REPUTATION_DECAY_HALF_LIFE_MS,
        REPUTATION_DECAY_HALF_LIFE_MS,
      ),
    ).toBe(0);
  });
});

describe("reputationDecaySteps", () => {
  it("returns zero below a full half-life", () => {
    expect(reputationDecaySteps(0, HALF - 1, HALF)).toBe(0);
  });

  it("counts full half-lives with floor semantics", () => {
    expect(reputationDecaySteps(0, 2 * HALF + 5, HALF)).toBe(2);
  });

  it("returns zero when now is before the last offense", () => {
    expect(reputationDecaySteps(HALF, 0, HALF)).toBe(0);
  });

  it("returns zero for a non-positive half-life", () => {
    expect(reputationDecaySteps(0, 10 * HALF, 0)).toBe(0);
    expect(reputationDecaySteps(0, 10 * HALF, -1)).toBe(0);
  });
});

describe("msUntilNextReputationDecay", () => {
  it("reports the wait until the first warn is forgiven", () => {
    expect(msUntilNextReputationDecay(2, 0, 30_000, HALF)).toBe(70_000);
  });

  it("reports the wait until the next boundary after some decay", () => {
    expect(msUntilNextReputationDecay(5, 0, 2 * HALF + 50_000, HALF)).toBe(
      50_000,
    );
  });

  it("returns null when nothing is left to forgive", () => {
    expect(msUntilNextReputationDecay(1, 0, HALF, HALF)).toBeNull();
    expect(msUntilNextReputationDecay(0, 0, 0, HALF)).toBeNull();
  });

  it("returns null for a non-positive half-life", () => {
    expect(msUntilNextReputationDecay(3, 0, 0, 0)).toBeNull();
  });

  it("stays positive when now is before the last offense", () => {
    expect(msUntilNextReputationDecay(2, 1_000, 0, HALF)).toBe(1_000 + HALF);
  });
});
