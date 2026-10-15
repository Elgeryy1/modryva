import { describe, expect, it } from "vitest";
import {
  classifyDailyTrend,
  type DailyActivity,
  humanizeDailyStats,
} from "./humanized-stats.js";

const TENSO = "Hoy el grupo estuvo más tenso que ayer. 😬";
const TRANQUILO = "Hoy el grupo estuvo más tranquilo que ayer. 😌";
const MOVIDO = "Hoy el grupo estuvo más movido que ayer. 🔥";
const IGUAL = "Hoy el grupo estuvo igual que ayer. 😐";

describe("classifyDailyTrend", () => {
  it("prioritizes rising conflicts even when messages drop", () => {
    const today: DailyActivity = { messages: 5, conflicts: 3 };
    const yesterday: DailyActivity = { messages: 40, conflicts: 1 };
    expect(classifyDailyTrend(today, yesterday)).toBe("tenso");
  });

  it("prioritizes falling conflicts even when messages spike", () => {
    const today: DailyActivity = { messages: 100, conflicts: 0 };
    const yesterday: DailyActivity = { messages: 10, conflicts: 5 };
    expect(classifyDailyTrend(today, yesterday)).toBe("tranquilo");
  });

  it("uses messages as tie-breaker when conflicts are equal and higher volume", () => {
    const today: DailyActivity = { messages: 50, conflicts: 2 };
    const yesterday: DailyActivity = { messages: 30, conflicts: 2 };
    expect(classifyDailyTrend(today, yesterday)).toBe("movido");
  });

  it("reads fewer messages with equal conflicts as calmer", () => {
    const today: DailyActivity = { messages: 10, conflicts: 2 };
    const yesterday: DailyActivity = { messages: 40, conflicts: 2 };
    expect(classifyDailyTrend(today, yesterday)).toBe("tranquilo");
  });

  it("returns igual when conflicts and messages are identical", () => {
    const today: DailyActivity = { messages: 20, conflicts: 3 };
    const yesterday: DailyActivity = { messages: 20, conflicts: 3 };
    expect(classifyDailyTrend(today, yesterday)).toBe("igual");
  });

  it("treats two empty days as igual", () => {
    const empty: DailyActivity = { messages: 0, conflicts: 0 };
    expect(classifyDailyTrend(empty, empty)).toBe("igual");
  });

  it("flags a single extra conflict at the boundary as tenso", () => {
    const today: DailyActivity = { messages: 15, conflicts: 2 };
    const yesterday: DailyActivity = { messages: 15, conflicts: 1 };
    expect(classifyDailyTrend(today, yesterday)).toBe("tenso");
  });
});

describe("humanizeDailyStats", () => {
  it("renders the accented Spanish sentence for each trend", () => {
    expect(
      humanizeDailyStats(
        { messages: 5, conflicts: 3 },
        { messages: 40, conflicts: 1 },
      ),
    ).toBe(TENSO);
    expect(
      humanizeDailyStats(
        { messages: 100, conflicts: 0 },
        { messages: 10, conflicts: 5 },
      ),
    ).toBe(TRANQUILO);
    expect(
      humanizeDailyStats(
        { messages: 50, conflicts: 2 },
        { messages: 30, conflicts: 2 },
      ),
    ).toBe(MOVIDO);
    expect(
      humanizeDailyStats(
        { messages: 20, conflicts: 3 },
        { messages: 20, conflicts: 3 },
      ),
    ).toBe(IGUAL);
  });

  it("is deterministic across repeated calls with the same inputs", () => {
    const today: DailyActivity = { messages: 12, conflicts: 4 };
    const yesterday: DailyActivity = { messages: 9, conflicts: 2 };
    const first = humanizeDailyStats(today, yesterday);
    const second = humanizeDailyStats(today, yesterday);
    expect(first).toBe(second);
    expect(first).toBe(TENSO);
  });

  it("is asymmetric: swapping the two days flips tenso into tranquilo", () => {
    const busy: DailyActivity = { messages: 30, conflicts: 6 };
    const calm: DailyActivity = { messages: 30, conflicts: 2 };
    expect(humanizeDailyStats(busy, calm)).toBe(TENSO);
    expect(humanizeDailyStats(calm, busy)).toBe(TRANQUILO);
  });
});
