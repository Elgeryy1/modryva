import { describe, expect, it } from "vitest";
import { rulesForDayPhase } from "./day-phase-rules.js";

describe("rulesForDayPhase", () => {
  it("classifies madrugada hours as estricto", () => {
    expect(rulesForDayPhase(0)).toEqual({
      phase: "madrugada",
      strictness: "estricto",
    });
    expect(rulesForDayPhase(5)).toEqual({
      phase: "madrugada",
      strictness: "estricto",
    });
  });

  it("classifies manana hours as suave", () => {
    expect(rulesForDayPhase(6)).toEqual({
      phase: "manana",
      strictness: "suave",
    });
    expect(rulesForDayPhase(11)).toEqual({
      phase: "manana",
      strictness: "suave",
    });
  });

  it("classifies tarde hours as normal", () => {
    expect(rulesForDayPhase(12)).toEqual({
      phase: "tarde",
      strictness: "normal",
    });
    expect(rulesForDayPhase(18)).toEqual({
      phase: "tarde",
      strictness: "normal",
    });
  });

  it("classifies noche hours as estricto", () => {
    expect(rulesForDayPhase(19)).toEqual({
      phase: "noche",
      strictness: "estricto",
    });
    expect(rulesForDayPhase(23)).toEqual({
      phase: "noche",
      strictness: "estricto",
    });
  });

  it("wraps hours outside 0..23", () => {
    expect(rulesForDayPhase(24)).toEqual(rulesForDayPhase(0));
    expect(rulesForDayPhase(-1)).toEqual(rulesForDayPhase(23));
  });
});
