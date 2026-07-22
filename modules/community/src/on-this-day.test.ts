import { describe, expect, it } from "vitest";
import {
  findOnThisDay,
  formatNostalgia,
  type HistoryEvent,
} from "./on-this-day.js";

const ev = (ms: number, summary: string): HistoryEvent => ({ ms, summary });

// July 8 2026, 12:00 UTC (month index 6).
const NOW = Date.UTC(2026, 6, 8, 12, 0, 0);

describe("findOnThisDay", () => {
  it("keeps events from previous years on the same day and month", () => {
    const events = [
      ev(Date.UTC(2025, 6, 8, 10, 0, 0), "hace un anio"),
      ev(Date.UTC(2024, 6, 8, 23, 59, 0), "hace dos anios"),
    ];
    expect(findOnThisDay(events, NOW, 0)).toEqual(events);
  });

  it("excludes events from a different month", () => {
    const events = [ev(Date.UTC(2025, 5, 8, 12, 0, 0), "junio 8")];
    expect(findOnThisDay(events, NOW, 0)).toEqual([]);
  });

  it("excludes events from a different day of the same month", () => {
    const events = [ev(Date.UTC(2025, 6, 9, 12, 0, 0), "julio 9")];
    expect(findOnThisDay(events, NOW, 0)).toEqual([]);
  });

  it("excludes events from the current year (only anios anteriores)", () => {
    const events = [ev(Date.UTC(2026, 6, 8, 1, 0, 0), "esta maniana")];
    expect(findOnThisDay(events, NOW, 0)).toEqual([]);
  });

  it("excludes future events", () => {
    const events = [ev(Date.UTC(2027, 6, 8, 1, 0, 0), "el anio que viene")];
    expect(findOnThisDay(events, NOW, 0)).toEqual([]);
  });

  it("preserves the order of the input events", () => {
    const older = ev(Date.UTC(2020, 6, 8, 6, 0, 0), "viejo");
    const newer = ev(Date.UTC(2025, 6, 8, 6, 0, 0), "reciente");
    expect(findOnThisDay([newer, older], NOW, 0)).toEqual([newer, older]);
  });

  it("returns an empty array for no events", () => {
    expect(findOnThisDay([], NOW, 0)).toEqual([]);
  });

  it("shifts the calendar day west with a negative offset", () => {
    // July 9 00:30 UTC is July 8 23:30 in UTC-1, so it matches today.
    const nearMidnight = ev(Date.UTC(2025, 6, 9, 0, 30, 0), "casi medianoche");
    expect(findOnThisDay([nearMidnight], NOW, -60)).toEqual([nearMidnight]);
    expect(findOnThisDay([nearMidnight], NOW, -60 * 1)).toEqual([nearMidnight]);
    // With the same offset applied to now (July 8 11:00 local) it counts.
    expect(findOnThisDay([nearMidnight], NOW, -60).length).toBe(1);
  });

  it("matches across midnight when both now and event share the local offset", () => {
    const now = Date.UTC(2026, 6, 9, 0, 30, 0); // July 9 00:30 UTC -> July 8 local
    const event = ev(Date.UTC(2025, 6, 8, 20, 0, 0), "el anio pasado");
    expect(findOnThisDay([event], now, -60)).toEqual([event]);
    expect(findOnThisDay([event], now, 0)).toEqual([]);
  });

  it("shifts the calendar day east with a positive offset", () => {
    // July 7 23:30 UTC is July 8 00:30 in UTC+1, matching today.
    const event = ev(Date.UTC(2025, 6, 7, 23, 30, 0), "empujado al 8");
    expect(findOnThisDay([event], NOW, 60)).toEqual([event]);
    expect(findOnThisDay([event], NOW, 0)).toEqual([]);
  });

  it("matches a Feb 29 anniversary on a leap day", () => {
    const leapNow = Date.UTC(2028, 1, 29, 12, 0, 0); // Feb 29 2028
    const event = ev(Date.UTC(2024, 1, 29, 8, 0, 0), "bisiesto");
    expect(findOnThisDay([event], leapNow, 0)).toEqual([event]);
  });

  it("is deterministic for identical inputs", () => {
    const events = [ev(Date.UTC(2025, 6, 8, 9, 0, 0), "x")];
    expect(findOnThisDay(events, NOW, 120)).toEqual(
      findOnThisDay(events, NOW, 120),
    );
  });
});

describe("formatNostalgia", () => {
  it("returns the empty-state notice when there are no events", () => {
    expect(formatNostalgia([], NOW)).toBe(
      "🕰️ Un día como hoy... pero todavía no hay recuerdos que rememorar.",
    );
  });

  it("uses the singular label for exactly one year ago", () => {
    const events = [ev(Date.UTC(2025, 6, 8, 10, 0, 0), "primer post")];
    expect(formatNostalgia(events, NOW)).toBe(
      "🕰️ Un día como hoy en este grupo...\n• hace 1 año: primer post",
    );
  });

  it("uses the plural label for several years ago", () => {
    const events = [ev(Date.UTC(2023, 6, 8, 10, 0, 0), "epoca dorada")];
    expect(formatNostalgia(events, NOW)).toBe(
      "🕰️ Un día como hoy en este grupo...\n• hace 3 años: epoca dorada",
    );
  });

  it("lists every event in order, one per line", () => {
    const events = [
      ev(Date.UTC(2025, 6, 8, 10, 0, 0), "uno"),
      ev(Date.UTC(2024, 6, 8, 10, 0, 0), "dos"),
    ];
    expect(formatNostalgia(events, NOW)).toBe(
      "🕰️ Un día como hoy en este grupo...\n• hace 1 año: uno\n• hace 2 años: dos",
    );
  });

  it("preserves the summary text verbatim", () => {
    const events = [ev(Date.UTC(2024, 6, 8, 10, 0, 0), "@ana: hola, mundo!")];
    expect(formatNostalgia(events, NOW)).toContain(": @ana: hola, mundo!");
  });

  it("is deterministic for identical inputs", () => {
    const events = [ev(Date.UTC(2022, 6, 8, 10, 0, 0), "recuerdo")];
    expect(formatNostalgia(events, NOW)).toBe(formatNostalgia(events, NOW));
  });
});
