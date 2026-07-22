import { describe, expect, it } from "vitest";
import {
  buildActivityHeatmap,
  formatHeatmap,
  HEATMAP_HOURS,
  peakHour,
} from "./activity-heatmap.js";

const HOUR_MS = 60 * 60_000;
const DAY_MS = 24 * HOUR_MS;

/** Marca epoch ms para una hora UTC dada del 1970-01-01 (dia 0). */
const atUtcHour = (hour: number): number => hour * HOUR_MS;

describe("buildActivityHeatmap", () => {
  it("returns 24 zeros for empty input", () => {
    const heatmap = buildActivityHeatmap([], 0);
    expect(heatmap.length).toBe(HEATMAP_HOURS);
    expect(heatmap.every((c) => c === 0)).toBe(true);
  });

  it("buckets a single message at UTC with zero offset", () => {
    const heatmap = buildActivityHeatmap([atUtcHour(9)], 0);
    expect(heatmap[9]).toBe(1);
    const total = heatmap.reduce((a, b) => a + b, 0);
    expect(total).toBe(1);
  });

  it("counts multiple messages in the same hour", () => {
    const times = [
      atUtcHour(14),
      atUtcHour(14) + 1_000,
      atUtcHour(14) + 59_000,
    ];
    const heatmap = buildActivityHeatmap(times, 0);
    expect(heatmap[14]).toBe(3);
  });

  it("applies a positive tz offset shifting local hour forward", () => {
    // 22:00 UTC + 120min = 00:00 local next day -> hour 0
    const heatmap = buildActivityHeatmap([atUtcHour(22)], 120);
    expect(heatmap[0]).toBe(1);
    expect(heatmap[22]).toBe(0);
  });

  it("applies a negative tz offset wrapping backward across midnight", () => {
    // 01:00 UTC - 120min = 23:00 previous day -> hour 23
    const heatmap = buildActivityHeatmap([atUtcHour(1)], -120);
    expect(heatmap[23]).toBe(1);
    expect(heatmap[1]).toBe(0);
  });

  it("wraps correctly across multiple days (uses local time of day only)", () => {
    const day3At7 = 3 * DAY_MS + atUtcHour(7);
    const heatmap = buildActivityHeatmap([atUtcHour(7), day3At7], 0);
    expect(heatmap[7]).toBe(2);
  });

  it("handles negative epoch timestamps (before 1970)", () => {
    // -1 hour -> 23:00 of the previous day
    const heatmap = buildActivityHeatmap([-HOUR_MS], 0);
    expect(heatmap[23]).toBe(1);
  });

  it("ignores non-finite timestamps", () => {
    const times = [atUtcHour(5), Number.NaN, Number.POSITIVE_INFINITY];
    const heatmap = buildActivityHeatmap(times, 0);
    expect(heatmap[5]).toBe(1);
    const total = heatmap.reduce((a, b) => a + b, 0);
    expect(total).toBe(1);
  });

  it("treats a non-finite offset as zero", () => {
    const heatmap = buildActivityHeatmap([atUtcHour(8)], Number.NaN);
    expect(heatmap[8]).toBe(1);
  });

  it("handles fractional tz offsets (e.g. +30 min)", () => {
    // 09:45 UTC + 30min = 10:15 local -> hour 10
    const heatmap = buildActivityHeatmap([atUtcHour(9) + 45 * 60_000], 30);
    expect(heatmap[10]).toBe(1);
  });

  it("is deterministic for identical inputs", () => {
    const times = [atUtcHour(3), atUtcHour(3), atUtcHour(18)];
    expect(buildActivityHeatmap(times, 60)).toEqual(
      buildActivityHeatmap(times, 60),
    );
  });

  it("distributes messages across distinct hours", () => {
    const heatmap = buildActivityHeatmap(
      [atUtcHour(0), atUtcHour(12), atUtcHour(23)],
      0,
    );
    expect(heatmap[0]).toBe(1);
    expect(heatmap[12]).toBe(1);
    expect(heatmap[23]).toBe(1);
  });
});

describe("peakHour", () => {
  it("returns 0 for an empty heatmap", () => {
    expect(peakHour([])).toBe(0);
  });

  it("returns 0 for an all-zero heatmap", () => {
    expect(peakHour(new Array<number>(24).fill(0))).toBe(0);
  });

  it("finds the single busiest hour", () => {
    const heatmap = buildActivityHeatmap(
      [atUtcHour(20), atUtcHour(20), atUtcHour(3)],
      0,
    );
    expect(peakHour(heatmap)).toBe(20);
  });

  it("returns the earliest hour on a tie", () => {
    const heatmap = new Array<number>(24).fill(0);
    heatmap[5] = 4;
    heatmap[17] = 4;
    expect(peakHour(heatmap)).toBe(5);
  });

  it("handles a peak at hour 23", () => {
    const heatmap = new Array<number>(24).fill(1);
    heatmap[23] = 9;
    expect(peakHour(heatmap)).toBe(23);
  });

  it("is deterministic for identical inputs", () => {
    const heatmap = buildActivityHeatmap([atUtcHour(11), atUtcHour(11)], 0);
    expect(peakHour(heatmap)).toBe(peakHour(heatmap));
  });
});

describe("formatHeatmap", () => {
  it("renders exactly 24 glyphs", () => {
    const heatmap = buildActivityHeatmap([atUtcHour(9)], 0);
    expect([...formatHeatmap(heatmap)].length).toBe(HEATMAP_HOURS);
  });

  it("renders all empty glyphs for an empty heatmap", () => {
    expect(formatHeatmap([])).toBe(" ".repeat(24));
  });

  it("renders all empty glyphs for an all-zero heatmap", () => {
    expect(formatHeatmap(new Array<number>(24).fill(0))).toBe(" ".repeat(24));
  });

  it("uses the tallest glyph for the peak hour", () => {
    const heatmap = new Array<number>(24).fill(0);
    heatmap[10] = 5;
    const rendered = formatHeatmap(heatmap);
    expect([...rendered][10]).toBe("█");
  });

  it("renders at least the lowest bar for any positive count", () => {
    const heatmap = new Array<number>(24).fill(0);
    heatmap[0] = 1;
    heatmap[1] = 100;
    const glyphs = [...formatHeatmap(heatmap)];
    expect(glyphs[0]).not.toBe(" ");
    expect(glyphs[1]).toBe("█");
  });

  it("keeps zero hours empty even alongside busy hours", () => {
    const heatmap = new Array<number>(24).fill(0);
    heatmap[6] = 8;
    const glyphs = [...formatHeatmap(heatmap)];
    expect(glyphs[5]).toBe(" ");
    expect(glyphs[7]).toBe(" ");
  });

  it("pads missing hours as empty when the heatmap is short", () => {
    expect(formatHeatmap([3, 0, 1])).toHaveLength(24);
  });

  it("is deterministic for identical inputs", () => {
    const heatmap = buildActivityHeatmap([atUtcHour(2), atUtcHour(22)], 0);
    expect(formatHeatmap(heatmap)).toBe(formatHeatmap(heatmap));
  });
});
