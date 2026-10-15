import { describe, expect, it } from "vitest";
import { checkOverConfiguration } from "./over-config-warning.js";

describe("checkOverConfiguration", () => {
  it("reports a healthy balance below the warn threshold", () => {
    expect(
      checkOverConfiguration({ activeRules: 3, memberCount: 100 }),
    ).toEqual({
      warn: false,
      ratioPer100: 3,
      advice:
        "✅ Buen equilibrio: 3 reglas para 100 miembros. Deja que la comunidad respire.",
    });
  });

  it("treats the exact warn threshold as still healthy", () => {
    expect(
      checkOverConfiguration({ activeRules: 5, memberCount: 100 }),
    ).toEqual({
      warn: false,
      ratioPer100: 5,
      advice:
        "✅ Buen equilibrio: 5 reglas para 100 miembros. Deja que la comunidad respire.",
    });
  });

  it("warns just above the warn threshold", () => {
    expect(
      checkOverConfiguration({ activeRules: 6, memberCount: 100 }),
    ).toEqual({
      warn: true,
      ratioPer100: 6,
      advice:
        "⚠️ Te estás pasando configurando: 6 reglas para 100 miembros. Demasiadas normas pueden matar la actividad.",
    });
  });

  it("still warns (not critical) exactly at the critical threshold", () => {
    expect(
      checkOverConfiguration({ activeRules: 10, memberCount: 100 }),
    ).toEqual({
      warn: true,
      ratioPer100: 10,
      advice:
        "⚠️ Te estás pasando configurando: 10 reglas para 100 miembros. Demasiadas normas pueden matar la actividad.",
    });
  });

  it("escalates to critical above the critical threshold", () => {
    expect(
      checkOverConfiguration({ activeRules: 15, memberCount: 100 }),
    ).toEqual({
      warn: true,
      ratioPer100: 15,
      advice:
        "🚨 Exceso de reglas: 15 para 100 miembros. Simplifica o la gente dejará de participar.",
    });
  });

  it("does not divide by zero when there are no members", () => {
    expect(checkOverConfiguration({ activeRules: 5, memberCount: 0 })).toEqual({
      warn: false,
      ratioPer100: 0,
      advice:
        "Aún no puedo evaluar tus reglas porque el grupo no tiene miembros. 👥",
    });
  });

  it("treats negative member counts as no members", () => {
    expect(checkOverConfiguration({ activeRules: 3, memberCount: -5 })).toEqual(
      {
        warn: false,
        ratioPer100: 0,
        advice:
          "Aún no puedo evaluar tus reglas porque el grupo no tiene miembros. 👥",
      },
    );
  });

  it("never warns when there are no active rules", () => {
    expect(checkOverConfiguration({ activeRules: 0, memberCount: 50 })).toEqual(
      {
        warn: false,
        ratioPer100: 0,
        advice:
          "No tienes reglas activas. 👍 Empieza con lo básico y añade solo lo necesario.",
      },
    );
  });

  it("rounds the ratio to two decimal places", () => {
    const result = checkOverConfiguration({ activeRules: 1, memberCount: 7 });
    expect(result.ratioPer100).toBe(14.29);
    expect(result.warn).toBe(true);
    expect(result.advice).toBe(
      "🚨 Exceso de reglas: 1 para 7 miembros. Simplifica o la gente dejará de participar.",
    );
  });

  it("is deterministic across repeated calls with the same input", () => {
    const first = checkOverConfiguration({ activeRules: 8, memberCount: 120 });
    const second = checkOverConfiguration({ activeRules: 8, memberCount: 120 });
    expect(first).toEqual(second);
    expect(first).toEqual({
      warn: true,
      ratioPer100: 6.67,
      advice:
        "⚠️ Te estás pasando configurando: 8 reglas para 120 miembros. Demasiadas normas pueden matar la actividad.",
    });
  });

  it("exposes the exact ratioPer100 for a healthy group", () => {
    expect(
      checkOverConfiguration({ activeRules: 2, memberCount: 80 }).ratioPer100,
    ).toBe(2.5);
  });
});
