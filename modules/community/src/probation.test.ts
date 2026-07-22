import { describe, expect, it } from "vitest";
import {
  computeProbation,
  isOnProbation,
  probationRemainingMs,
} from "./probation.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

describe("computeProbation", () => {
  it("uses the default 7-day span when no options are given", () => {
    expect(computeProbation(0)).toEqual({ startMs: 0, untilMs: WEEK_MS });
  });
  it("honours a custom probationMs span", () => {
    expect(computeProbation(1000, { probationMs: 5000 })).toEqual({
      startMs: 1000,
      untilMs: 6000,
    });
  });
  it("falls back to default for a negative span", () => {
    expect(computeProbation(10, { probationMs: -1 })).toEqual({
      startMs: 10,
      untilMs: 10 + WEEK_MS,
    });
  });
  it("falls back to default for a non-finite span", () => {
    expect(
      computeProbation(0, { probationMs: Number.POSITIVE_INFINITY }),
    ).toEqual({
      startMs: 0,
      untilMs: WEEK_MS,
    });
  });
});

describe("isOnProbation", () => {
  it("is true at the inclusive start", () => {
    expect(isOnProbation(1000, 1000, { probationMs: 5000 })).toBe(true);
  });
  it("is true strictly inside the window", () => {
    expect(isOnProbation(1000, 3000, { probationMs: 5000 })).toBe(true);
  });
  it("is false at the exclusive end", () => {
    expect(isOnProbation(1000, 6000, { probationMs: 5000 })).toBe(false);
  });
  it("is false before the appeal was accepted", () => {
    expect(isOnProbation(1000, 500, { probationMs: 5000 })).toBe(false);
  });
});

describe("probationRemainingMs", () => {
  it("returns the remaining span inside the window", () => {
    expect(probationRemainingMs(1000, 3000, { probationMs: 5000 })).toBe(3000);
  });
  it("clamps to zero once elapsed", () => {
    expect(probationRemainingMs(1000, 7000, { probationMs: 5000 })).toBe(0);
  });
  it("clamps to the full span before the window starts", () => {
    expect(probationRemainingMs(1000, 0, { probationMs: 5000 })).toBe(5000);
  });
  it("is deterministic across repeated calls", () => {
    const first = probationRemainingMs(1000, 2500, { probationMs: 5000 });
    const second = probationRemainingMs(1000, 2500, { probationMs: 5000 });
    expect(first).toBe(second);
    expect(first).toBe(3500);
  });
});
