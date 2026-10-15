import { describe, expect, it } from "vitest";
import {
  describeOverUnder,
  type OverUnderPick,
  resolveOverUnder,
} from "./over-under-seven.js";

describe("resolveOverUnder", () => {
  it("bajo gana cuando la suma es 6 (< 7)", () => {
    // 2 + 4 = 6
    const res = resolveOverUnder(2, 4, "bajo");
    expect(res.detail.sum).toBe(6);
    expect(res.detail.win).toBe(true);
    // (36/15)*0.96 = 2.304 -> 2.30
    expect(res.multiplier).toBe(2.3);
  });

  it("bajo pierde cuando la suma es 7", () => {
    const res = resolveOverUnder(3, 4, "bajo");
    expect(res.detail.sum).toBe(7);
    expect(res.detail.win).toBe(false);
    expect(res.multiplier).toBe(0);
  });

  it("bajo pierde cuando la suma es 8", () => {
    const res = resolveOverUnder(2, 6, "bajo");
    expect(res.detail.sum).toBe(8);
    expect(res.detail.win).toBe(false);
    expect(res.multiplier).toBe(0);
  });

  it("siete gana cuando la suma es 7", () => {
    const res = resolveOverUnder(6, 1, "siete");
    expect(res.detail.sum).toBe(7);
    expect(res.detail.win).toBe(true);
    // (36/6)*0.96 = 5.76
    expect(res.multiplier).toBe(5.76);
  });

  it("siete pierde cuando la suma es 6", () => {
    const res = resolveOverUnder(1, 5, "siete");
    expect(res.detail.sum).toBe(6);
    expect(res.detail.win).toBe(false);
    expect(res.multiplier).toBe(0);
  });

  it("siete pierde cuando la suma es 8", () => {
    const res = resolveOverUnder(5, 3, "siete");
    expect(res.detail.sum).toBe(8);
    expect(res.detail.win).toBe(false);
    expect(res.multiplier).toBe(0);
  });

  it("alto gana cuando la suma es 8 (> 7)", () => {
    const res = resolveOverUnder(4, 4, "alto");
    expect(res.detail.sum).toBe(8);
    expect(res.detail.win).toBe(true);
    // (36/15)*0.96 = 2.304 -> 2.30
    expect(res.multiplier).toBe(2.3);
  });

  it("alto pierde cuando la suma es 7", () => {
    const res = resolveOverUnder(2, 5, "alto");
    expect(res.detail.sum).toBe(7);
    expect(res.detail.win).toBe(false);
    expect(res.multiplier).toBe(0);
  });

  it("alto pierde cuando la suma es 6", () => {
    const res = resolveOverUnder(3, 3, "alto");
    expect(res.detail.sum).toBe(6);
    expect(res.detail.win).toBe(false);
    expect(res.multiplier).toBe(0);
  });

  it("expone el detalle completo con pick y dados", () => {
    const res = resolveOverUnder(1, 2, "bajo");
    expect(res.detail).toEqual({
      d1: 1,
      d2: 2,
      sum: 3,
      pick: "bajo",
      win: true,
    });
  });

  it("cada apuesta tiene ventaja de casa positiva (RTP < 1)", () => {
    const cases: ReadonlyArray<{
      pick: OverUnderPick;
      ways: number;
      mult: number;
    }> = [
      { pick: "bajo", ways: 15, mult: 2.3 },
      { pick: "siete", ways: 6, mult: 5.76 },
      { pick: "alto", ways: 15, mult: 2.3 },
    ];
    for (const { ways, mult } of cases) {
      const rtp = (ways / 36) * mult;
      expect(rtp).toBeLessThan(1);
      expect(rtp).toBeGreaterThan(0.9);
    }
  });

  it("es determinista: misma entrada -> misma salida", () => {
    const a = resolveOverUnder(6, 5, "alto");
    const b = resolveOverUnder(6, 5, "alto");
    expect(a).toEqual(b);
  });

  it("rechaza valores de dado fuera de rango", () => {
    expect(() => resolveOverUnder(0, 3, "bajo")).toThrow(RangeError);
    expect(() => resolveOverUnder(3, 7, "alto")).toThrow(RangeError);
    expect(() => resolveOverUnder(1.5, 3, "siete")).toThrow(RangeError);
  });
});

describe("describeOverUnder", () => {
  it("renderiza una línea de victoria con emoji y multiplicador", () => {
    const { detail } = resolveOverUnder(2, 4, "bajo");
    const line = describeOverUnder(detail);
    expect(line).toBe("🎲🎲 2+4=6 · Bajo (menos de 7) ✅ ¡Ganas! ×2.3");
  });

  it("renderiza una línea de derrota", () => {
    const { detail } = resolveOverUnder(3, 4, "alto");
    const line = describeOverUnder(detail);
    expect(line).toBe("🎲🎲 3+4=7 · Alto (más de 7) ❌ Pierdes");
  });

  it("es determinista para el render", () => {
    const { detail } = resolveOverUnder(6, 1, "siete");
    expect(describeOverUnder(detail)).toBe(describeOverUnder(detail));
  });
});
