import { describe, expect, it } from "vitest";
import { isWithinSupportHours, supportHoursStatus } from "./support-hours.js";

describe("supportHoursStatus", () => {
  it("is open at the default opening boundary (9)", () => {
    expect(supportHoursStatus(9)).toEqual({
      open: true,
      message:
        "🟢 Estamos disponibles (horario 9:00-21:00). ¿En qué podemos ayudarte?",
    });
  });

  it("is open during the default working day", () => {
    expect(supportHoursStatus(14)).toEqual({
      open: true,
      message:
        "🟢 Estamos disponibles (horario 9:00-21:00). ¿En qué podemos ayudarte?",
    });
  });

  it("is closed at the closing boundary (21, exclusive) and collects data", () => {
    expect(supportHoursStatus(21)).toEqual({
      open: false,
      message:
        "🌙 Estamos fuera de horario (9:00-21:00). Déjanos tu consulta y tus datos de contacto y la revisaremos en cuanto volvamos. 🙏",
    });
  });

  it("is closed before opening", () => {
    expect(supportHoursStatus(8).open).toBe(false);
  });

  it("is closed at midnight", () => {
    expect(supportHoursStatus(0).open).toBe(false);
  });

  it("honors custom opening and closing hours", () => {
    const options = { openHour: 10, closeHour: 18 };
    expect(supportHoursStatus(9, options).open).toBe(false);
    expect(supportHoursStatus(10, options).open).toBe(true);
    expect(supportHoursStatus(18, options).open).toBe(false);
  });

  it("embeds the custom window in the message", () => {
    expect(supportHoursStatus(12, { openHour: 8, closeHour: 20 })).toEqual({
      open: true,
      message:
        "🟢 Estamos disponibles (horario 8:00-20:00). ¿En qué podemos ayudarte?",
    });
  });

  it("normalizes out-of-range hours using modulo 24", () => {
    // 33 -> 9 (inside the 9-21 window), 25 -> 1 (outside it)
    expect(supportHoursStatus(33).open).toBe(true);
    expect(supportHoursStatus(25).open).toBe(false);
  });

  it("is deterministic for repeated calls", () => {
    expect(supportHoursStatus(15)).toEqual(supportHoursStatus(15));
  });
});

describe("isWithinSupportHours", () => {
  it("handles overnight windows that wrap past midnight", () => {
    expect(isWithinSupportHours(23, 22, 6)).toBe(true);
    expect(isWithinSupportHours(2, 22, 6)).toBe(true);
    expect(isWithinSupportHours(6, 22, 6)).toBe(false);
    expect(isWithinSupportHours(12, 22, 6)).toBe(false);
  });

  it("treats an equal open and close hour as always closed", () => {
    expect(isWithinSupportHours(10, 9, 9)).toBe(false);
    expect(isWithinSupportHours(9, 9, 9)).toBe(false);
  });
});
