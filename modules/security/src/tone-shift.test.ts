import { describe, expect, it } from "vitest";
import { detectToneShift } from "./tone-shift.js";

const calm = { aggressive: false } as const;
const rage = { aggressive: true } as const;

describe("detectToneShift", () => {
  it("flags a shift when default 3 calm messages precede an aggressive one", () => {
    expect(detectToneShift([calm, calm, calm, rage])).toEqual({
      shifted: true,
      calmBefore: 3,
    });
  });

  it("does not flag when the calm streak is shorter than the window", () => {
    expect(detectToneShift([calm, calm, rage])).toEqual({
      shifted: false,
      calmBefore: 2,
    });
  });

  it("does not flag when the last message is calm but still reports the streak", () => {
    expect(detectToneShift([calm, calm, calm])).toEqual({
      shifted: false,
      calmBefore: 2,
    });
  });

  it("does not flag when the author was already aggressive", () => {
    expect(detectToneShift([rage, rage])).toEqual({
      shifted: false,
      calmBefore: 0,
    });
  });

  it("counts only the trailing calm streak, stopping at an earlier aggressive message", () => {
    expect(detectToneShift([rage, calm, calm, calm, calm, rage])).toEqual({
      shifted: true,
      calmBefore: 4,
    });
  });

  it("respects a custom calmWindow", () => {
    expect(detectToneShift([calm, calm, rage], { calmWindow: 2 })).toEqual({
      shifted: true,
      calmBefore: 2,
    });
  });

  it("treats a calmWindow of 0 as flagging any lone aggressive message", () => {
    expect(detectToneShift([rage], { calmWindow: 0 })).toEqual({
      shifted: true,
      calmBefore: 0,
    });
  });

  it("clamps a negative calmWindow to zero", () => {
    expect(detectToneShift([rage], { calmWindow: -5 })).toEqual({
      shifted: true,
      calmBefore: 0,
    });
  });

  it("does not flag a single aggressive message under the default window", () => {
    expect(detectToneShift([rage])).toEqual({ shifted: false, calmBefore: 0 });
  });

  it("returns a neutral result for empty history", () => {
    expect(detectToneShift([])).toEqual({ shifted: false, calmBefore: 0 });
  });

  it("is deterministic across repeated calls with the same input", () => {
    const history = [calm, calm, calm, calm, rage] as const;
    const first = detectToneShift(history);
    const second = detectToneShift(history);
    expect(first).toEqual(second);
    expect(first).toEqual({ shifted: true, calmBefore: 4 });
  });
});
