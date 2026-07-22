import { describe, expect, it } from "vitest";
import { computeCleanStreak, type DaySummary } from "./clean-group-streak.js";

const clean: DaySummary = { hadIncident: false };
const dirty: DaySummary = { hadIncident: true };

describe("computeCleanStreak", () => {
  it("returns an empty-state message for no days", () => {
    expect(computeCleanStreak([])).toEqual({
      streak: 0,
      clean: false,
      message: "📊 Aún no hay días registrados para evaluar al grupo.",
    });
  });

  it("counts trailing incident-free days below the threshold", () => {
    expect(computeCleanStreak([clean, clean, clean], 7)).toEqual({
      streak: 3,
      clean: false,
      message:
        "✨ 3 días sin incidentes. Faltan 4 días para el modo grupo limpio.",
    });
  });

  it("flags a fresh incident on the most recent day", () => {
    expect(computeCleanStreak([clean, clean, dirty], 7)).toEqual({
      streak: 0,
      clean: false,
      message:
        "⚠️ Hubo un incidente reciente; el contador de días limpios vuelve a cero.",
    });
  });

  it("only counts trailing days, ignoring older incidents", () => {
    expect(computeCleanStreak([dirty, clean, clean], 7)).toEqual({
      streak: 2,
      clean: false,
      message:
        "✨ 2 días sin incidentes. Faltan 5 días para el modo grupo limpio.",
    });
  });

  it("marks the group clean when the streak reaches the threshold exactly", () => {
    const week: readonly DaySummary[] = [
      clean,
      clean,
      clean,
      clean,
      clean,
      clean,
      clean,
    ];
    expect(computeCleanStreak(week, 7)).toEqual({
      streak: 7,
      clean: true,
      message: "🎉 ¡Grupo limpio! 7 días sin conflictos ni spam.",
    });
  });

  it("uses singular wording for a one-day clean streak", () => {
    expect(computeCleanStreak([clean], 1)).toEqual({
      streak: 1,
      clean: true,
      message: "🎉 ¡Grupo limpio! 1 día sin conflictos ni spam.",
    });
  });

  it("uses singular 'Falta' and 'día' when exactly one day remains", () => {
    expect(computeCleanStreak([clean, clean, clean], 4)).toEqual({
      streak: 3,
      clean: false,
      message:
        "✨ 3 días sin incidentes. Falta 1 día para el modo grupo limpio.",
    });
  });

  it("defaults the threshold to 7 days", () => {
    const ten: readonly DaySummary[] = Array.from({ length: 10 }, () => clean);
    expect(computeCleanStreak(ten)).toEqual({
      streak: 10,
      clean: true,
      message: "🎉 ¡Grupo limpio! 10 días sin conflictos ni spam.",
    });
  });

  it("clamps a non-positive threshold to 1 day", () => {
    expect(computeCleanStreak([clean], 0)).toEqual({
      streak: 1,
      clean: true,
      message: "🎉 ¡Grupo limpio! 1 día sin conflictos ni spam.",
    });
  });

  it("is deterministic across repeated calls with the same input", () => {
    const input: readonly DaySummary[] = [dirty, clean, clean, clean];
    const first = computeCleanStreak(input, 5);
    const second = computeCleanStreak(input, 5);
    expect(first).toEqual(second);
    expect(first).toEqual({
      streak: 3,
      clean: false,
      message:
        "✨ 3 días sin incidentes. Faltan 2 días para el modo grupo limpio.",
    });
  });
});
