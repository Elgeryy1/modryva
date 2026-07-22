import { describe, expect, it } from "vitest";
import {
  APPEAL_HONESTY_ABUSE_PENALTY,
  APPEAL_HONESTY_ACCEPT_BONUS,
  APPEAL_HONESTY_LOW_MAX,
  APPEAL_HONESTY_MEDIUM_MAX,
  APPEAL_HONESTY_START,
  type AppealHonestyEntry,
  appealHonestyTrust,
  scoreAppealHonesty,
} from "./appeal-honesty.js";

const entry = (accepted: boolean, wasAbusive: boolean): AppealHonestyEntry => ({
  accepted,
  wasAbusive,
});

const repeat = (
  count: number,
  accepted: boolean,
  wasAbusive: boolean,
): AppealHonestyEntry[] =>
  Array.from({ length: count }, () => entry(accepted, wasAbusive));

describe("scoreAppealHonesty", () => {
  it("returns the neutral start for an empty history", () => {
    expect(scoreAppealHonesty([])).toEqual({
      score: APPEAL_HONESTY_START,
      trust: "medio",
    });
  });

  it("adds the accept bonus for a single accepted appeal", () => {
    expect(scoreAppealHonesty([entry(true, false)]).score).toBe(
      APPEAL_HONESTY_START + APPEAL_HONESTY_ACCEPT_BONUS,
    );
  });

  it("subtracts the abuse penalty for a single abusive appeal", () => {
    expect(scoreAppealHonesty([entry(false, true)]).score).toBe(
      APPEAL_HONESTY_START - APPEAL_HONESTY_ABUSE_PENALTY,
    );
  });

  it("applies both effects when an entry is accepted and abusive", () => {
    expect(scoreAppealHonesty([entry(true, true)]).score).toBe(
      APPEAL_HONESTY_START +
        APPEAL_HONESTY_ACCEPT_BONUS -
        APPEAL_HONESTY_ABUSE_PENALTY,
    );
  });

  it("does not move the score for a rejected non-abusive appeal", () => {
    expect(scoreAppealHonesty([entry(false, false)]).score).toBe(
      APPEAL_HONESTY_START,
    );
  });

  it("accumulates across many entries", () => {
    const history = [
      entry(true, false),
      entry(true, false),
      entry(false, true),
    ];
    expect(scoreAppealHonesty(history).score).toBe(
      APPEAL_HONESTY_START +
        2 * APPEAL_HONESTY_ACCEPT_BONUS -
        APPEAL_HONESTY_ABUSE_PENALTY,
    );
  });

  it("never falls below 0 no matter how many abusive appeals", () => {
    const result = scoreAppealHonesty(repeat(20, false, true));
    expect(result.score).toBe(0);
    expect(result.trust).toBe("bajo");
  });

  it("never rises above 100 no matter how many accepted appeals", () => {
    const result = scoreAppealHonesty(repeat(20, true, false));
    expect(result.score).toBe(100);
    expect(result.trust).toBe("alto");
  });

  it("labels a heavily abusive history as bajo", () => {
    expect(scoreAppealHonesty(repeat(3, false, true)).trust).toBe("bajo");
  });

  it("labels a clean cooperative history as alto", () => {
    expect(scoreAppealHonesty(repeat(3, true, false)).trust).toBe("alto");
  });

  it("keeps the neutral start in the medio band", () => {
    expect(scoreAppealHonesty([]).trust).toBe("medio");
  });

  it("is deterministic for identical inputs", () => {
    const history = [entry(true, false), entry(false, true), entry(true, true)];
    expect(scoreAppealHonesty(history)).toEqual(scoreAppealHonesty(history));
  });

  it("does not mutate the input history", () => {
    const history = [entry(true, false), entry(false, true)];
    const snapshot = history.map((h) => ({ ...h }));
    scoreAppealHonesty(history);
    expect(history).toEqual(snapshot);
  });

  it("keeps the score within 0..100 for a mixed history", () => {
    const { score } = scoreAppealHonesty([
      entry(true, true),
      entry(false, true),
      entry(true, false),
      entry(false, false),
    ]);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});

describe("appealHonestyTrust", () => {
  it("returns bajo below the low threshold", () => {
    expect(appealHonestyTrust(APPEAL_HONESTY_LOW_MAX - 1)).toBe("bajo");
    expect(appealHonestyTrust(0)).toBe("bajo");
  });

  it("returns medio at the low threshold and below the medium threshold", () => {
    expect(appealHonestyTrust(APPEAL_HONESTY_LOW_MAX)).toBe("medio");
    expect(appealHonestyTrust(APPEAL_HONESTY_MEDIUM_MAX - 1)).toBe("medio");
  });

  it("returns alto at and above the medium threshold", () => {
    expect(appealHonestyTrust(APPEAL_HONESTY_MEDIUM_MAX)).toBe("alto");
    expect(appealHonestyTrust(100)).toBe("alto");
  });
});
