import { describe, expect, it } from "vitest";
import { classifySeverityColor } from "./severity-color.js";

describe("classifySeverityColor", () => {
  it("maps 0 to verde with the observe action", () => {
    expect(classifySeverityColor(0)).toEqual({
      color: "verde",
      action: "Observar sin intervenir",
      label: "🟢 Riesgo bajo",
    });
  });

  it("maps a mid green score to verde", () => {
    expect(classifySeverityColor(10).color).toBe("verde");
  });

  it("keeps verde at the upper green boundary 24 and switches at 25", () => {
    expect(classifySeverityColor(24).color).toBe("verde");
    expect(classifySeverityColor(25).color).toBe("amarillo");
  });

  it("returns the full amarillo classification", () => {
    expect(classifySeverityColor(40)).toEqual({
      color: "amarillo",
      action: "Avisar al usuario",
      label: "🟡 Riesgo moderado",
    });
  });

  it("keeps amarillo at 49 and switches to naranja at 50", () => {
    expect(classifySeverityColor(49).color).toBe("amarillo");
    expect(classifySeverityColor(50)).toEqual({
      color: "naranja",
      action: "Silenciar temporalmente",
      label: "🟠 Riesgo alto",
    });
  });

  it("keeps naranja at 74 and switches to rojo at 75", () => {
    expect(classifySeverityColor(74).color).toBe("naranja");
    expect(classifySeverityColor(75)).toEqual({
      color: "rojo",
      action: "Expulsar del grupo",
      label: "🔴 Riesgo crítico",
    });
  });

  it("returns rojo at the top of the range", () => {
    expect(classifySeverityColor(100).color).toBe("rojo");
  });

  it("clamps negative scores to verde", () => {
    expect(classifySeverityColor(-50)).toEqual({
      color: "verde",
      action: "Observar sin intervenir",
      label: "🟢 Riesgo bajo",
    });
  });

  it("clamps scores above 100 to rojo", () => {
    expect(classifySeverityColor(500).color).toBe("rojo");
  });

  it("treats non-finite scores as the lowest severity", () => {
    expect(classifySeverityColor(Number.NaN).color).toBe("verde");
    expect(classifySeverityColor(Number.POSITIVE_INFINITY).color).toBe("verde");
    expect(classifySeverityColor(Number.NEGATIVE_INFINITY).color).toBe("verde");
  });

  it("handles decimals at band edges", () => {
    expect(classifySeverityColor(24.9).color).toBe("verde");
    expect(classifySeverityColor(25.1).color).toBe("amarillo");
    expect(classifySeverityColor(74.999).color).toBe("naranja");
  });

  it("is deterministic and returns independent objects", () => {
    const first = classifySeverityColor(60);
    const second = classifySeverityColor(60);
    expect(first).toEqual(second);
    expect(first).not.toBe(second);
  });
});
