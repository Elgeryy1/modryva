import { describe, expect, it } from "vitest";
import {
  isGoodPostTime,
  POST_TIMING_HOURS,
  suggestPostHour,
} from "./post-timing.js";

/** Construye un heatmap de 24 con actividad `value` en `hour` y 0 en el resto. */
const spikeAt = (hour: number, value = 10): number[] => {
  const heatmap = new Array<number>(POST_TIMING_HOURS).fill(0);
  const current = heatmap[hour] ?? 0;
  heatmap[hour] = current + value;
  return heatmap;
};

/** Heatmap completamente plano con el mismo `value` en las 24 horas. */
const flat = (value: number): number[] =>
  new Array<number>(POST_TIMING_HOURS).fill(value);

describe("suggestPostHour", () => {
  it("returns hour 0 with confidence 0 for an empty heatmap", () => {
    expect(suggestPostHour([])).toEqual({ hour: 0, confidence: 0 });
  });

  it("returns hour 0 with confidence 0 for an all-zero heatmap", () => {
    expect(suggestPostHour(flat(0))).toEqual({ hour: 0, confidence: 0 });
  });

  it("returns confidence 0 for a flat non-zero heatmap", () => {
    const result = suggestPostHour(flat(5));
    expect(result.confidence).toBe(0);
  });

  it("finds the single busiest hour", () => {
    expect(suggestPostHour(spikeAt(14)).hour).toBe(14);
  });

  it("gives confidence 1 when all activity is in one hour", () => {
    expect(suggestPostHour(spikeAt(9, 100))).toEqual({
      hour: 9,
      confidence: 1,
    });
  });

  it("breaks ties toward the earliest hour", () => {
    const heatmap = flat(0);
    heatmap[3] = 7;
    heatmap[18] = 7;
    expect(suggestPostHour(heatmap).hour).toBe(3);
  });

  it("keeps confidence within 0..1 for a mixed heatmap", () => {
    const heatmap = flat(1);
    heatmap[20] = 50;
    const { hour, confidence } = suggestPostHour(heatmap);
    expect(hour).toBe(20);
    expect(confidence).toBeGreaterThan(0);
    expect(confidence).toBeLessThanOrEqual(1);
  });

  it("treats negative, NaN and infinite buckets as zero activity", () => {
    const heatmap = flat(0);
    heatmap[1] = -100;
    heatmap[2] = Number.NaN;
    heatmap[3] = Number.POSITIVE_INFINITY;
    heatmap[8] = 4;
    expect(suggestPostHour(heatmap).hour).toBe(8);
  });

  it("ignores heatmap entries beyond the 24th hour", () => {
    const heatmap = spikeAt(5);
    heatmap[30] = 999;
    expect(suggestPostHour(heatmap).hour).toBe(5);
  });

  it("handles a short heatmap by padding missing hours with zero", () => {
    expect(suggestPostHour([0, 0, 3])).toEqual({ hour: 2, confidence: 1 });
  });

  it("is deterministic for identical inputs", () => {
    const heatmap = spikeAt(11, 42);
    expect(suggestPostHour(heatmap)).toEqual(suggestPostHour(heatmap));
  });
});

describe("isGoodPostTime", () => {
  it("returns false for an empty heatmap", () => {
    expect(isGoodPostTime([], 12)).toBe(false);
  });

  it("returns false for an all-zero heatmap", () => {
    expect(isGoodPostTime(flat(0), 12)).toBe(false);
  });

  it("returns false for a flat non-zero heatmap", () => {
    expect(isGoodPostTime(flat(5), 0)).toBe(false);
    expect(isGoodPostTime(flat(5), 23)).toBe(false);
  });

  it("returns true at the busiest hour", () => {
    expect(isGoodPostTime(spikeAt(16), 16)).toBe(true);
  });

  it("returns false at a quiet hour below the mean", () => {
    const heatmap = flat(1);
    heatmap[16] = 100;
    expect(isGoodPostTime(heatmap, 5)).toBe(false);
  });

  it("returns true at an above-average hour", () => {
    const heatmap = flat(1);
    heatmap[9] = 10;
    heatmap[10] = 10;
    expect(isGoodPostTime(heatmap, 9)).toBe(true);
  });

  it("returns false for hours out of range", () => {
    const heatmap = spikeAt(8);
    expect(isGoodPostTime(heatmap, -1)).toBe(false);
    expect(isGoodPostTime(heatmap, 24)).toBe(false);
  });

  it("returns false for non-integer hours", () => {
    expect(isGoodPostTime(spikeAt(8), 8.5)).toBe(false);
    expect(isGoodPostTime(spikeAt(8), Number.NaN)).toBe(false);
  });

  it("treats negative and non-finite buckets as zero", () => {
    const heatmap = flat(0);
    heatmap[4] = -50;
    heatmap[5] = Number.NaN;
    heatmap[6] = 8;
    expect(isGoodPostTime(heatmap, 4)).toBe(false);
    expect(isGoodPostTime(heatmap, 6)).toBe(true);
  });

  it("is deterministic for identical inputs", () => {
    const heatmap = spikeAt(21, 30);
    expect(isGoodPostTime(heatmap, 21)).toBe(isGoodPostTime(heatmap, 21));
  });
});
