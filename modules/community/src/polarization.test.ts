import { describe, expect, it } from "vitest";
import {
  computePolarization,
  detectManipulation,
  type PolarizationStance,
} from "./polarization.js";

const repeat = (stance: PolarizationStance, n: number): PolarizationStance[] =>
  Array.from({ length: n }, () => stance);

describe("computePolarization", () => {
  it("returns bajo with 0 for an empty list", () => {
    expect(computePolarization([])).toEqual({ level: "bajo", splitRatio: 0 });
  });

  it("returns bajo with 0 when everyone is neutral", () => {
    expect(computePolarization(repeat("neutral", 5))).toEqual({
      level: "bajo",
      splitRatio: 0,
    });
  });

  it("returns bajo with 0 when a single bando exists", () => {
    expect(computePolarization(["a", "a", "a"])).toEqual({
      level: "bajo",
      splitRatio: 0,
    });
  });

  it("scores alto for a balanced split with no neutrals", () => {
    const result = computePolarization(["a", "a", "b", "b"]);
    expect(result.splitRatio).toBe(1);
    expect(result.level).toBe("alto");
  });

  it("perfect 50/50 always yields splitRatio 1", () => {
    expect(computePolarization(["a", "b"]).splitRatio).toBe(1);
    expect(
      computePolarization(repeat("a", 10).concat(repeat("b", 10))).splitRatio,
    ).toBe(1);
  });

  it("lowers the ratio as one bando dominates", () => {
    // a=3, b=1 => balance 1/3, engagement 1 => 0.3333
    const result = computePolarization(["a", "a", "a", "b"]);
    expect(result.splitRatio).toBe(0.3333);
    expect(result.level).toBe("medio");
  });

  it("lowers the ratio as neutrals dilute engagement", () => {
    // a=1, b=1, neutral=2 => balance 1, engagement 0.5 => 0.5
    const result = computePolarization(["a", "b", "neutral", "neutral"]);
    expect(result.splitRatio).toBe(0.5);
    expect(result.level).toBe("medio");
  });

  it("drops to bajo when engagement and balance are both low", () => {
    // a=3, b=1, neutral=6 => balance 1/3, engagement 0.4 => 0.1333
    const result = computePolarization(
      (["a", "a", "a", "b"] as PolarizationStance[]).concat(
        repeat("neutral", 6),
      ),
    );
    expect(result.splitRatio).toBe(0.1333);
    expect(result.level).toBe("bajo");
  });

  it("is symmetric between bando a and bando b", () => {
    const ab = computePolarization(["a", "a", "a", "b"]);
    const ba = computePolarization(["b", "b", "b", "a"]);
    expect(ab).toEqual(ba);
  });

  it("is order-independent", () => {
    const grouped = computePolarization(["a", "a", "b", "neutral"]);
    const shuffled = computePolarization(["neutral", "b", "a", "a"]);
    expect(grouped).toEqual(shuffled);
  });

  it("is deterministic for identical inputs", () => {
    const input: PolarizationStance[] = ["a", "b", "b", "neutral", "a"];
    expect(computePolarization(input)).toEqual(computePolarization(input));
  });
});

describe("detectManipulation", () => {
  it("flags false-consensus phrasing", () => {
    expect(
      detectManipulation("Aqui todos pensamos igual, no hay debate"),
    ).toEqual({
      manipulative: true,
      reason: "Apela a un consenso inexistente para presionar.",
    });
  });

  it("flags forced-obviousness phrasing", () => {
    expect(detectManipulation("Cualquiera sabe que eso es asi")).toEqual({
      manipulative: true,
      reason: "Presenta una opinión como obviedad indiscutible.",
    });
  });

  it("flags group ultimatum phrasing", () => {
    expect(detectManipulation("O estas con nosotros o te vas")).toEqual({
      manipulative: true,
      reason: "Fuerza a tomar bando con un ultimátum de grupo.",
    });
  });

  it("flags disqualification of dissenters", () => {
    expect(detectManipulation("Solo un tonto opinaria distinto")).toEqual({
      manipulative: true,
      reason: "Descalifica a quien disiente para silenciarlo.",
    });
  });

  it("ignores accents and casing when matching", () => {
    expect(detectManipulation("TODO EL MUNDO SÁBE que es cierto")).toEqual({
      manipulative: true,
      reason: "Apela a un consenso inexistente para presionar.",
    });
  });

  it("normalizes irregular whitespace between words", () => {
    expect(detectManipulation("es   obvio\tque\nnadie lo discute")).toEqual({
      manipulative: true,
      reason: "Presenta una opinión como obviedad indiscutible.",
    });
  });

  it("returns manipulative false without reason for neutral text", () => {
    const result = detectManipulation("Creo que quiza deberiamos revisarlo");
    expect(result).toEqual({ manipulative: false });
    expect(result.reason).toBeUndefined();
  });

  it("returns manipulative false for empty or blank text", () => {
    expect(detectManipulation("")).toEqual({ manipulative: false });
    expect(detectManipulation("   ")).toEqual({ manipulative: false });
  });

  it("prioritizes ultimatum over consensus when both appear", () => {
    expect(
      detectManipulation("Todos sabemos esto, o estas con nosotros o nada"),
    ).toEqual({
      manipulative: true,
      reason: "Fuerza a tomar bando con un ultimátum de grupo.",
    });
  });

  it("is deterministic for identical inputs", () => {
    const text = "es evidente que nadie puede negar esto";
    expect(detectManipulation(text)).toEqual(detectManipulation(text));
  });
});
