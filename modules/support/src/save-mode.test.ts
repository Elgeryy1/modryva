import { describe, expect, it } from "vitest";
import { decideSaveMode } from "./save-mode.js";

describe("decideSaveMode", () => {
  it("stays in normal mode when usage is low", () => {
    expect(decideSaveMode({ aiCallsToday: 50, budget: 100 })).toEqual({
      saveMode: false,
      usedRatio: 0.5,
      advice: "🟢 Consumo de IA bajo control. Modo normal activo.",
    });
  });

  it("enters save mode when usage reaches the warn ratio", () => {
    expect(decideSaveMode({ aiCallsToday: 90, budget: 100 })).toEqual({
      saveMode: true,
      usedRatio: 0.9,
      advice:
        "🟠 Consumo de IA alto. Modo ahorro activado para reducir llamadas y trabajos no críticos.",
    });
  });

  it("flags budget exhausted when the ratio reaches 1", () => {
    expect(decideSaveMode({ aiCallsToday: 100, budget: 100 })).toEqual({
      saveMode: true,
      usedRatio: 1,
      advice:
        "🔴 Presupuesto de IA agotado. Modo ahorro activado: se pausan las tareas no críticas.",
    });
  });

  it("treats a non-positive budget as no budget configured", () => {
    expect(decideSaveMode({ aiCallsToday: 5, budget: 0 })).toEqual({
      saveMode: true,
      usedRatio: 0,
      advice:
        "⚠️ Sin presupuesto de IA configurado. Modo ahorro activado por precaución.",
    });
  });

  it("handles a negative budget as no budget configured", () => {
    expect(decideSaveMode({ aiCallsToday: 3, budget: -10 }).saveMode).toBe(
      true,
    );
    expect(decideSaveMode({ aiCallsToday: 3, budget: -10 }).usedRatio).toBe(0);
  });

  it("clamps negative call counts to zero", () => {
    expect(decideSaveMode({ aiCallsToday: -5, budget: 100 })).toEqual({
      saveMode: false,
      usedRatio: 0,
      advice: "🟢 Consumo de IA bajo control. Modo normal activo.",
    });
  });

  it("rounds usedRatio to 2 decimals", () => {
    expect(decideSaveMode({ aiCallsToday: 1, budget: 3 }).usedRatio).toBe(0.33);
  });

  it("respects a custom warnRatio", () => {
    const result = decideSaveMode(
      { aiCallsToday: 50, budget: 100 },
      { warnRatio: 0.5 },
    );
    expect(result.saveMode).toBe(true);
    expect(result.usedRatio).toBe(0.5);
    expect(result.advice).toBe(
      "🟠 Consumo de IA alto. Modo ahorro activado para reducir llamadas y trabajos no críticos.",
    );
  });

  it("turns on save mode exactly at the default boundary", () => {
    expect(decideSaveMode({ aiCallsToday: 80, budget: 100 }).saveMode).toBe(
      true,
    );
  });

  it("stays normal just below the default boundary", () => {
    expect(decideSaveMode({ aiCallsToday: 79, budget: 100 }).saveMode).toBe(
      false,
    );
  });

  it("is deterministic across repeated calls", () => {
    const first = decideSaveMode({ aiCallsToday: 42, budget: 60 });
    const second = decideSaveMode({ aiCallsToday: 42, budget: 60 });
    expect(first).toEqual(second);
  });
});
