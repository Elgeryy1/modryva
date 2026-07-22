import { describe, expect, it } from "vitest";
import {
  formatReminderTime,
  parseNaturalReminder,
} from "./natural-reminder.js";

// A fixed "now": 2026-07-03 (Fri) 12:00 UTC.
const NOW = Date.parse("2026-07-03T12:00:00Z");

describe("parseNaturalReminder", () => {
  it("parses relative durations", () => {
    expect(parseNaturalReminder("en 30 min llamar", NOW)).toEqual({
      runAtMs: NOW + 30 * 60_000,
      message: "llamar",
    });
    expect(parseNaturalReminder("en 2 horas reunion", NOW)?.runAtMs).toBe(
      NOW + 2 * 3_600_000,
    );
    expect(parseNaturalReminder("en 1 dia pagar", NOW)?.runAtMs).toBe(
      NOW + 86_400_000,
    );
  });

  it("parses 'a las HH:MM' today and rolls past times to tomorrow", () => {
    // 17:00 today is in the future relative to 12:00.
    const future = parseNaturalReminder("a las 17:00 cena", NOW);
    expect(future?.message).toBe("cena");
    expect(future?.runAtMs).toBe(Date.parse("2026-07-03T17:00:00Z"));

    // 09:00 already passed -> tomorrow.
    const past = parseNaturalReminder("a las 9 gym", NOW);
    expect(past?.runAtMs).toBe(Date.parse("2026-07-04T09:00:00Z"));
  });

  it("parses 'manana a las HH'", () => {
    const r = parseNaturalReminder("manana a las 8:30 desayuno", NOW);
    expect(r?.runAtMs).toBe(Date.parse("2026-07-04T08:30:00Z"));
    expect(r?.message).toBe("desayuno");
  });

  it("applies a timezone offset", () => {
    // +120 min zone: "a las 17:00" local == 15:00 UTC.
    const r = parseNaturalReminder("a las 17:00 x", NOW, 120);
    expect(r?.runAtMs).toBe(Date.parse("2026-07-03T15:00:00Z"));
  });

  it("returns null when nothing matches", () => {
    expect(parseNaturalReminder("hola que tal", NOW)).toBeNull();
    expect(parseNaturalReminder("a las 99 x", NOW)).toBeNull();
  });
});

describe("formatReminderTime", () => {
  it("formats an absolute time in Spanish", () => {
    const s = formatReminderTime(Date.parse("2026-07-03T17:05:00Z"));
    expect(s).toContain("3 jul");
    expect(s).toContain("17:05");
    expect(s).toContain("vie");
  });
});
