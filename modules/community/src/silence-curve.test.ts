import { describe, expect, it } from "vitest";
import { computeSilenceCurve, type SilenceMember } from "./silence-curve.js";

describe("computeSilenceCurve", () => {
  it("returns all-zero metrics for an empty list", () => {
    expect(computeSilenceCurve([])).toEqual({
      participatedCount: 0,
      neverSpokeCount: 0,
      medianDelayMs: 0,
      participationRatio: 0,
    });
  });

  it("counts members with an undefined first message as never spoke", () => {
    const members: readonly SilenceMember[] = [
      { joinMs: 100, firstMessageMs: undefined },
      { joinMs: 200, firstMessageMs: undefined },
    ];
    expect(computeSilenceCurve(members)).toEqual({
      participatedCount: 0,
      neverSpokeCount: 2,
      medianDelayMs: 0,
      participationRatio: 0,
    });
  });

  it("takes the middle delay as median for an odd count", () => {
    const members: readonly SilenceMember[] = [
      { joinMs: 0, firstMessageMs: 10 },
      { joinMs: 100, firstMessageMs: 130 },
      { joinMs: 50, firstMessageMs: 70 },
      { joinMs: 5, firstMessageMs: undefined },
    ];
    expect(computeSilenceCurve(members)).toEqual({
      participatedCount: 3,
      neverSpokeCount: 1,
      medianDelayMs: 20,
      participationRatio: 0.75,
    });
  });

  it("averages the two central delays as median for an even count", () => {
    const members: readonly SilenceMember[] = [
      { joinMs: 0, firstMessageMs: 10 },
      { joinMs: 0, firstMessageMs: 30 },
    ];
    expect(computeSilenceCurve(members)).toEqual({
      participatedCount: 2,
      neverSpokeCount: 0,
      medianDelayMs: 20,
      participationRatio: 1,
    });
  });

  it("treats a first message before joining as invalid (never spoke)", () => {
    const members: readonly SilenceMember[] = [
      { joinMs: 100, firstMessageMs: 50 },
      { joinMs: 0, firstMessageMs: 40 },
    ];
    expect(computeSilenceCurve(members)).toEqual({
      participatedCount: 1,
      neverSpokeCount: 1,
      medianDelayMs: 40,
      participationRatio: 0.5,
    });
  });

  it("counts a first message exactly at join time as a zero-delay participation", () => {
    const members: readonly SilenceMember[] = [
      { joinMs: 100, firstMessageMs: 100 },
    ];
    expect(computeSilenceCurve(members)).toEqual({
      participatedCount: 1,
      neverSpokeCount: 0,
      medianDelayMs: 0,
      participationRatio: 1,
    });
  });

  it("rounds participationRatio down to 2 decimals (1 of 3)", () => {
    const members: readonly SilenceMember[] = [
      { joinMs: 0, firstMessageMs: 100 },
      { joinMs: 0, firstMessageMs: undefined },
      { joinMs: 0, firstMessageMs: undefined },
    ];
    expect(computeSilenceCurve(members)).toEqual({
      participatedCount: 1,
      neverSpokeCount: 2,
      medianDelayMs: 100,
      participationRatio: 0.33,
    });
  });

  it("rounds participationRatio up to 2 decimals (2 of 3)", () => {
    const members: readonly SilenceMember[] = [
      { joinMs: 0, firstMessageMs: 100 },
      { joinMs: 0, firstMessageMs: 200 },
      { joinMs: 0, firstMessageMs: undefined },
    ];
    expect(computeSilenceCurve(members)).toEqual({
      participatedCount: 2,
      neverSpokeCount: 1,
      medianDelayMs: 150,
      participationRatio: 0.67,
    });
  });

  it("is order-independent: shuffled input yields the same curve", () => {
    const ordered: readonly SilenceMember[] = [
      { joinMs: 0, firstMessageMs: 10 },
      { joinMs: 0, firstMessageMs: 30 },
      { joinMs: 0, firstMessageMs: 50 },
    ];
    const shuffled: readonly SilenceMember[] = [
      { joinMs: 0, firstMessageMs: 50 },
      { joinMs: 0, firstMessageMs: 10 },
      { joinMs: 0, firstMessageMs: 30 },
    ];
    expect(computeSilenceCurve(shuffled)).toEqual(computeSilenceCurve(ordered));
    expect(computeSilenceCurve(ordered)).toEqual({
      participatedCount: 3,
      neverSpokeCount: 0,
      medianDelayMs: 30,
      participationRatio: 1,
    });
  });

  it("does not mutate the input array", () => {
    const members: readonly SilenceMember[] = [
      { joinMs: 0, firstMessageMs: 30 },
      { joinMs: 0, firstMessageMs: 10 },
    ];
    computeSilenceCurve(members);
    expect(members).toEqual([
      { joinMs: 0, firstMessageMs: 30 },
      { joinMs: 0, firstMessageMs: 10 },
    ]);
  });
});
