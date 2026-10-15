import { describe, expect, it } from "vitest";
import {
  detectSlowFlood,
  SLOW_FLOOD_MIN_SOFT_LIMIT,
  type SlowFloodResult,
  type SlowFloodSignal,
  slowFloodEffectiveLimit,
  slowFloodSignal,
  slowFloodWindowCount,
} from "./slow-flood.js";

const SECOND = 1_000;
const MINUTE = 60 * SECOND;

// Ventana larga de 10 minutos y limite blando de 5 mensajes.
const WINDOW = 10 * MINUTE;
const LIMIT = 5;
const NOW = 1_000_000;

/** Genera `n` marcas de tiempo repartidas uniformemente dentro de la ventana. */
const spread = (n: number, windowMs: number, nowMs: number): number[] => {
  if (n <= 0) {
    return [];
  }
  const step = windowMs / n;
  const times: number[] = [];
  for (let i = 0; i < n; i += 1) {
    times.push(Math.round(nowMs - windowMs + step * i));
  }
  return times;
};

describe("slowFloodEffectiveLimit", () => {
  it("keeps positive integer limits", () => {
    expect(slowFloodEffectiveLimit(5)).toBe(5);
    expect(slowFloodEffectiveLimit(1)).toBe(1);
  });

  it("floors fractional limits", () => {
    expect(slowFloodEffectiveLimit(5.9)).toBe(5);
  });

  it("raises zero, negatives and non-finite to the minimum", () => {
    expect(slowFloodEffectiveLimit(0)).toBe(SLOW_FLOOD_MIN_SOFT_LIMIT);
    expect(slowFloodEffectiveLimit(-3)).toBe(SLOW_FLOOD_MIN_SOFT_LIMIT);
    expect(slowFloodEffectiveLimit(Number.NaN)).toBe(SLOW_FLOOD_MIN_SOFT_LIMIT);
    expect(slowFloodEffectiveLimit(Number.POSITIVE_INFINITY)).toBe(
      SLOW_FLOOD_MIN_SOFT_LIMIT,
    );
  });
});

describe("slowFloodWindowCount", () => {
  it("counts only messages inside the window (inclusive bounds)", () => {
    const times = [NOW - WINDOW, NOW - MINUTE, NOW];
    expect(slowFloodWindowCount(times, WINDOW, NOW)).toBe(3);
  });

  it("discards messages older than the window", () => {
    const times = [NOW - WINDOW - 1, NOW - 2 * MINUTE];
    expect(slowFloodWindowCount(times, WINDOW, NOW)).toBe(1);
  });

  it("discards future messages", () => {
    const times = [NOW - MINUTE, NOW + MINUTE];
    expect(slowFloodWindowCount(times, WINDOW, NOW)).toBe(1);
  });

  it("returns 0 for a non-positive window", () => {
    const times = [NOW, NOW - MINUTE];
    expect(slowFloodWindowCount(times, 0, NOW)).toBe(0);
    expect(slowFloodWindowCount(times, -WINDOW, NOW)).toBe(0);
  });

  it("returns 0 for empty input", () => {
    expect(slowFloodWindowCount([], WINDOW, NOW)).toBe(0);
  });
});

describe("detectSlowFlood", () => {
  it("flags a spread-out drip that reaches the soft limit", () => {
    const times = spread(LIMIT, WINDOW, NOW);
    const result = detectSlowFlood(times, WINDOW, LIMIT, NOW);
    expect(result.suspicious).toBe(true);
    expect(result.count).toBe(LIMIT);
    expect(result.reason).toBe("Flood lento: 5 mensajes en 600s sin pico");
  });

  it("flags when the count exceeds the soft limit", () => {
    const times = spread(LIMIT + 3, WINDOW, NOW);
    const result = detectSlowFlood(times, WINDOW, LIMIT, NOW);
    expect(result.suspicious).toBe(true);
    expect(result.count).toBe(LIMIT + 3);
  });

  it("does not flag activity below the soft limit", () => {
    const times = spread(LIMIT - 1, WINDOW, NOW);
    const result = detectSlowFlood(times, WINDOW, LIMIT, NOW);
    expect(result.suspicious).toBe(false);
    expect(result.count).toBe(LIMIT - 1);
    expect(result.reason).toBe("Actividad normal: 4/5 en 600s");
  });

  it("reports no activity for an empty window", () => {
    const result = detectSlowFlood([], WINDOW, LIMIT, NOW);
    expect(result).toEqual<SlowFloodResult>({
      suspicious: false,
      count: 0,
      reason: "Sin actividad en la ventana",
    });
  });

  it("ignores old and future messages when deciding", () => {
    const times = [
      NOW - WINDOW - 1,
      NOW - WINDOW - 2,
      NOW + MINUTE,
      NOW - MINUTE,
      NOW - 2 * MINUTE,
    ];
    const result = detectSlowFlood(times, WINDOW, 2, NOW);
    expect(result.count).toBe(2);
    expect(result.suspicious).toBe(true);
  });

  it("treats a non-positive soft limit as 1", () => {
    const times = [NOW - MINUTE];
    const result = detectSlowFlood(times, WINDOW, 0, NOW);
    expect(result.suspicious).toBe(true);
    expect(result.count).toBe(1);
  });

  it("does not flag an empty window even with a non-positive limit", () => {
    const result = detectSlowFlood([], WINDOW, 0, NOW);
    expect(result.suspicious).toBe(false);
    expect(result.count).toBe(0);
  });

  it("returns no activity when the window is non-positive", () => {
    const times = [NOW, NOW - MINUTE, NOW - 2 * MINUTE];
    const result = detectSlowFlood(times, 0, LIMIT, NOW);
    expect(result.suspicious).toBe(false);
    expect(result.count).toBe(0);
    expect(result.reason).toBe("Sin actividad en la ventana");
  });

  it("is deterministic for identical inputs", () => {
    const times = spread(LIMIT, WINDOW, NOW);
    expect(detectSlowFlood(times, WINDOW, LIMIT, NOW)).toEqual(
      detectSlowFlood(times, WINDOW, LIMIT, NOW),
    );
  });
});

describe("slowFloodSignal", () => {
  it("emits the common engine shape with detail when present", () => {
    const times = spread(LIMIT, WINDOW, NOW);
    const signal = slowFloodSignal(times, WINDOW, LIMIT, NOW);
    expect(signal.key).toBe("slow_flood");
    expect(signal.present).toBe(true);
    expect(signal.detail).toBe("Flood lento: 5 mensajes en 600s sin pico");
  });

  it("omits detail when the signal is absent", () => {
    const times = spread(LIMIT - 1, WINDOW, NOW);
    const signal = slowFloodSignal(times, WINDOW, LIMIT, NOW);
    expect(signal.present).toBe(false);
    expect(signal.detail).toBeUndefined();
    expect(Object.hasOwn(signal, "detail")).toBe(false);
  });

  it("scales weight with intensity and clamps to 1", () => {
    const light = slowFloodSignal(spread(2, WINDOW, NOW), WINDOW, LIMIT, NOW);
    const heavy = slowFloodSignal(spread(20, WINDOW, NOW), WINDOW, LIMIT, NOW);
    expect(light.weight).toBeCloseTo(0.2, 5);
    expect(heavy.weight).toBe(1);
  });

  it("keeps weight within 0..1 for empty input", () => {
    const signal: SlowFloodSignal = slowFloodSignal([], WINDOW, LIMIT, NOW);
    expect(signal.weight).toBe(0);
    expect(signal.present).toBe(false);
  });
});
