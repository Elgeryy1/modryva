import { describe, expect, it } from "vitest";
import {
  DAILY_TRIVIA_MS_PER_DAY,
  DAILY_TRIVIA_MS_PER_HOUR,
  DAILY_TRIVIA_MS_PER_MINUTE,
  dailyTriviaHash,
  dayKeyFromMs,
  hourKeyFromMs,
  pickDailyIndex,
} from "./daily-trivia.js";

const DAY = DAILY_TRIVIA_MS_PER_DAY;
const HOUR = DAILY_TRIVIA_MS_PER_HOUR;
const MINUTE = DAILY_TRIVIA_MS_PER_MINUTE;

describe("dailyTriviaHash", () => {
  it("is deterministic for the same input", () => {
    expect(dailyTriviaHash("123")).toBe(dailyTriviaHash("123"));
  });

  it("returns an unsigned 32-bit integer", () => {
    const h = dailyTriviaHash("some-day-key-9999");
    expect(Number.isInteger(h)).toBe(true);
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThan(2 ** 32);
  });

  it("produces the canonical FNV-1a offset basis for the empty string", () => {
    expect(dailyTriviaHash("")).toBe(0x811c9dc5);
  });

  it("differs for different inputs", () => {
    expect(dailyTriviaHash("100")).not.toBe(dailyTriviaHash("101"));
  });
});

describe("pickDailyIndex", () => {
  it("returns an index within [0, poolSize)", () => {
    for (let dayKey = 0; dayKey < 50; dayKey += 1) {
      const idx = pickDailyIndex(dayKey, 7);
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(7);
    }
  });

  it("is deterministic: same day maps to the same question", () => {
    expect(pickDailyIndex(20_275, 42)).toBe(pickDailyIndex(20_275, 42));
  });

  it("matches the FNV-1a hash modulo poolSize", () => {
    const dayKey = 20_275;
    const expected = dailyTriviaHash(String(dayKey)) % 42;
    expect(pickDailyIndex(dayKey, 42)).toBe(expected);
  });

  it("always returns 0 for a pool of size 1", () => {
    expect(pickDailyIndex(1, 1)).toBe(0);
    expect(pickDailyIndex(99_999, 1)).toBe(0);
  });

  it("returns 0 for a non-positive pool size", () => {
    expect(pickDailyIndex(5, 0)).toBe(0);
    expect(pickDailyIndex(5, -3)).toBe(0);
  });

  it("returns 0 for a non-finite pool size", () => {
    expect(pickDailyIndex(5, Number.NaN)).toBe(0);
    expect(pickDailyIndex(5, Number.POSITIVE_INFINITY)).toBe(0);
  });

  it("floors a fractional pool size before taking the modulo", () => {
    const dayKey = 12_345;
    const expected = dailyTriviaHash(String(dayKey)) % 10;
    expect(pickDailyIndex(dayKey, 10.9)).toBe(expected);
  });

  it("truncates a fractional day key to an integer key", () => {
    expect(pickDailyIndex(20_275.7, 42)).toBe(pickDailyIndex(20_275, 42));
  });

  it("treats a non-finite day key as 0", () => {
    const expected = pickDailyIndex(0, 42);
    expect(pickDailyIndex(Number.NaN, 42)).toBe(expected);
    expect(pickDailyIndex(Number.POSITIVE_INFINITY, 42)).toBe(expected);
  });

  it("spreads consecutive days across the pool (not a constant)", () => {
    const indices = new Set<number>();
    for (let dayKey = 1000; dayKey < 1030; dayKey += 1) {
      indices.add(pickDailyIndex(dayKey, 12));
    }
    expect(indices.size).toBeGreaterThan(1);
  });
});

describe("dayKeyFromMs", () => {
  it("buckets every instant of the same UTC day into the same key", () => {
    const start = 100 * DAY;
    const endOfDay = start + DAY - 1;
    expect(dayKeyFromMs(start, 0)).toBe(100);
    expect(dayKeyFromMs(endOfDay, 0)).toBe(100);
    expect(dayKeyFromMs(start + DAY, 0)).toBe(101);
  });

  it("is deterministic for identical inputs", () => {
    expect(dayKeyFromMs(123_456_789, 60)).toBe(dayKeyFromMs(123_456_789, 60));
  });

  it("shifts the day boundary forward for a positive tz offset", () => {
    // Justo antes de medianoche UTC del dia 10, con UTC+2, ya es dia 10 local.
    const justBeforeUtcMidnight = 10 * DAY - MINUTE;
    expect(dayKeyFromMs(justBeforeUtcMidnight, 0)).toBe(9);
    expect(dayKeyFromMs(justBeforeUtcMidnight, 120)).toBe(10);
  });

  it("shifts the day boundary backward for a negative tz offset", () => {
    // Justo despues de medianoche UTC del dia 10, con UTC-5, aun es dia 9 local.
    const justAfterUtcMidnight = 10 * DAY + MINUTE;
    expect(dayKeyFromMs(justAfterUtcMidnight, 0)).toBe(10);
    expect(dayKeyFromMs(justAfterUtcMidnight, -300)).toBe(9);
  });

  it("handles the epoch and pre-epoch instants", () => {
    expect(dayKeyFromMs(0, 0)).toBe(0);
    expect(dayKeyFromMs(-1, 0)).toBe(-1);
  });

  it("treats non-finite inputs as 0", () => {
    expect(dayKeyFromMs(Number.NaN, 0)).toBe(0);
    expect(dayKeyFromMs(0, Number.NaN)).toBe(0);
    expect(dayKeyFromMs(Number.POSITIVE_INFINITY, 0)).toBe(0);
  });

  it("feeds a stable key into pickDailyIndex for the same local day", () => {
    const morning = 200 * DAY + 8 * 60 * MINUTE;
    const evening = 200 * DAY + 22 * 60 * MINUTE;
    const idxMorning = pickDailyIndex(dayKeyFromMs(morning, 0), 20);
    const idxEvening = pickDailyIndex(dayKeyFromMs(evening, 0), 20);
    expect(idxMorning).toBe(idxEvening);
  });
});

describe("hourKeyFromMs", () => {
  it("buckets every instant of the same UTC hour into the same key", () => {
    const start = 1000 * HOUR;
    expect(hourKeyFromMs(start, 0)).toBe(1000);
    expect(hourKeyFromMs(start + HOUR - 1, 0)).toBe(1000);
    expect(hourKeyFromMs(start + HOUR, 0)).toBe(1001);
  });

  it("opens a fresh window every hour on the dot", () => {
    const base = 500 * HOUR;
    const keys = new Set<number>();
    for (let h = 0; h < 6; h += 1) {
      keys.add(hourKeyFromMs(base + h * HOUR, 0));
    }
    expect(keys.size).toBe(6);
  });

  it("never collides with day keys for present-day timestamps", () => {
    // Any real 2020s timestamp: the hour bucket is always far larger than the
    // day bucket, so a group can switch cadence without mixing markers.
    const now = 1_760_000_000_000; // ~2025
    expect(hourKeyFromMs(now, 0)).toBeGreaterThan(dayKeyFromMs(now, 0));
  });

  it("treats non-finite inputs as 0", () => {
    expect(hourKeyFromMs(Number.NaN, 0)).toBe(0);
    expect(hourKeyFromMs(0, Number.NaN)).toBe(0);
  });
});
