import { describe, expect, it } from "vitest";
import {
  advanceHunt,
  checkHuntClue,
  type HuntState,
  huntProgress,
} from "./scavenger-hunt.js";

const state = (stepIndex: number, total: number): HuntState => ({
  stepIndex,
  total,
});

describe("checkHuntClue", () => {
  it("matches identical answers", () => {
    expect(checkHuntClue("puerta", "puerta")).toBe(true);
  });

  it("ignores accents on both sides", () => {
    expect(checkHuntClue("arbol", "árbol")).toBe(true);
    expect(checkHuntClue("Cañón", "canon")).toBe(true);
  });

  it("ignores leading and trailing whitespace", () => {
    expect(checkHuntClue("  llave  ", "llave")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(checkHuntClue("TESORO", "tesoro")).toBe(true);
  });

  it("collapses internal whitespace", () => {
    expect(checkHuntClue("la   casa   roja", "la casa roja")).toBe(true);
  });

  it("returns false for different answers", () => {
    expect(checkHuntClue("norte", "sur")).toBe(false);
  });

  it("treats empty strings as equal to each other", () => {
    expect(checkHuntClue("", "")).toBe(true);
    expect(checkHuntClue("   ", "")).toBe(true);
  });

  it("is deterministic for identical inputs", () => {
    expect(checkHuntClue("Mégane", "megane")).toBe(
      checkHuntClue("Mégane", "megane"),
    );
  });
});

describe("advanceHunt", () => {
  it("increments the step index by one", () => {
    expect(advanceHunt(state(0, 3))).toEqual({
      state: { stepIndex: 1, total: 3 },
      finished: false,
    });
  });

  it("marks finished when reaching the last step", () => {
    expect(advanceHunt(state(2, 3))).toEqual({
      state: { stepIndex: 3, total: 3 },
      finished: true,
    });
  });

  it("saturates the index at total and stays finished", () => {
    expect(advanceHunt(state(3, 3))).toEqual({
      state: { stepIndex: 3, total: 3 },
      finished: true,
    });
  });

  it("treats a zero-total hunt as finished from the start", () => {
    expect(advanceHunt(state(0, 0))).toEqual({
      state: { stepIndex: 0, total: 0 },
      finished: true,
    });
  });

  it("clamps a negative total to zero", () => {
    expect(advanceHunt(state(0, -2))).toEqual({
      state: { stepIndex: 0, total: 0 },
      finished: true,
    });
  });

  it("clamps a negative step index to zero before advancing", () => {
    expect(advanceHunt(state(-5, 4))).toEqual({
      state: { stepIndex: 1, total: 4 },
      finished: false,
    });
  });

  it("does not mutate the input state", () => {
    const input = state(1, 5);
    advanceHunt(input);
    expect(input).toEqual({ stepIndex: 1, total: 5 });
  });

  it("is deterministic across repeated calls", () => {
    expect(advanceHunt(state(1, 4))).toEqual(advanceHunt(state(1, 4)));
  });
});

describe("huntProgress", () => {
  it("returns 0 at the start", () => {
    expect(huntProgress(state(0, 4))).toBe(0);
  });

  it("returns a fraction mid-way", () => {
    expect(huntProgress(state(2, 4))).toBe(0.5);
  });

  it("returns 1 when all steps are done", () => {
    expect(huntProgress(state(4, 4))).toBe(1);
  });

  it("saturates above 1 when overshooting", () => {
    expect(huntProgress(state(9, 4))).toBe(1);
  });

  it("returns 0 for a zero total", () => {
    expect(huntProgress(state(0, 0))).toBe(0);
  });

  it("returns 0 for a negative total", () => {
    expect(huntProgress(state(1, -3))).toBe(0);
  });

  it("treats a negative step index as zero", () => {
    expect(huntProgress(state(-2, 4))).toBe(0);
  });
});
