import { describe, expect, it } from "vitest";
import {
  CSAT_DETRACTOR_MAX,
  CSAT_MAX_SCORE,
  CSAT_MIN_SCORE,
  CSAT_PROMOTER_SCORE,
  type CsatVote,
  computeCsat,
  isValidCsatVote,
} from "./csat.js";

const vote = (score: number, ms = 1_000): CsatVote => ({ score, ms });

describe("csat constants", () => {
  it("exposes the expected score bounds", () => {
    expect(CSAT_MIN_SCORE).toBe(1);
    expect(CSAT_MAX_SCORE).toBe(5);
    expect(CSAT_DETRACTOR_MAX).toBe(3);
    expect(CSAT_PROMOTER_SCORE).toBe(5);
  });
});

describe("isValidCsatVote", () => {
  it("accepts every integer score in range", () => {
    for (let s = CSAT_MIN_SCORE; s <= CSAT_MAX_SCORE; s += 1) {
      expect(isValidCsatVote(vote(s))).toBe(true);
    }
  });

  it("rejects scores below the minimum", () => {
    expect(isValidCsatVote(vote(0))).toBe(false);
    expect(isValidCsatVote(vote(-3))).toBe(false);
  });

  it("rejects scores above the maximum", () => {
    expect(isValidCsatVote(vote(6))).toBe(false);
    expect(isValidCsatVote(vote(100))).toBe(false);
  });

  it("rejects non-integer scores", () => {
    expect(isValidCsatVote(vote(3.5))).toBe(false);
    expect(isValidCsatVote(vote(Number.NaN))).toBe(false);
    expect(isValidCsatVote(vote(Number.POSITIVE_INFINITY))).toBe(false);
  });

  it("does not care about ms", () => {
    expect(isValidCsatVote(vote(4, -9999))).toBe(true);
    expect(isValidCsatVote(vote(4, 0))).toBe(true);
  });
});

describe("computeCsat", () => {
  it("returns nulls and zeros for an empty list", () => {
    expect(computeCsat([])).toEqual({
      average: null,
      count: 0,
      promoters: 0,
      detractors: 0,
      nps: null,
    });
  });

  it("returns nulls when every vote is invalid", () => {
    expect(computeCsat([vote(0), vote(6), vote(2.5)])).toEqual({
      average: null,
      count: 0,
      promoters: 0,
      detractors: 0,
      nps: null,
    });
  });

  it("computes the average of valid scores", () => {
    const result = computeCsat([vote(4), vote(2), vote(3)]);
    expect(result.average).toBeCloseTo(3);
    expect(result.count).toBe(3);
  });

  it("counts promoters as score exactly 5", () => {
    const result = computeCsat([vote(5), vote(5), vote(4)]);
    expect(result.promoters).toBe(2);
  });

  it("counts detractors as score <= 3", () => {
    const result = computeCsat([vote(1), vote(2), vote(3), vote(4)]);
    expect(result.detractors).toBe(3);
  });

  it("treats a 4 as neither promoter nor detractor (passive)", () => {
    const result = computeCsat([vote(4)]);
    expect(result.promoters).toBe(0);
    expect(result.detractors).toBe(0);
    expect(result.nps).toBe(0);
  });

  it("computes NPS as (promoters - detractors) / count * 100", () => {
    // 2 promotores (5,5), 1 detractor (2), 1 pasivo (4) => (2-1)/4*100 = 25
    const result = computeCsat([vote(5), vote(5), vote(2), vote(4)]);
    expect(result.count).toBe(4);
    expect(result.nps).toBeCloseTo(25);
  });

  it("yields NPS 100 when all votes are promoters", () => {
    const result = computeCsat([vote(5), vote(5), vote(5)]);
    expect(result.nps).toBe(100);
    expect(result.average).toBe(5);
  });

  it("yields NPS -100 when all votes are detractors", () => {
    const result = computeCsat([vote(1), vote(3), vote(2)]);
    expect(result.nps).toBe(-100);
  });

  it("ignores invalid votes when aggregating", () => {
    const result = computeCsat([vote(5), vote(0), vote(6), vote(3), vote(2.5)]);
    expect(result.count).toBe(2);
    expect(result.promoters).toBe(1);
    expect(result.detractors).toBe(1);
    expect(result.average).toBeCloseTo(4);
    expect(result.nps).toBe(0);
  });

  it("is deterministic for identical inputs", () => {
    const votes = [vote(5), vote(3), vote(4), vote(1)];
    expect(computeCsat(votes)).toEqual(computeCsat(votes));
  });

  it("does not mutate the input array", () => {
    const votes = [vote(5), vote(2)];
    const snapshot = [...votes];
    computeCsat(votes);
    expect(votes).toEqual(snapshot);
  });

  it("handles a single valid vote", () => {
    expect(computeCsat([vote(4)])).toEqual({
      average: 4,
      count: 1,
      promoters: 0,
      detractors: 0,
      nps: 0,
    });
  });
});
