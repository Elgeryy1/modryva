import { describe, expect, it } from "vitest";
import { computeRuleImpact, type RuleImpactSample } from "./rule-impact.js";

const sample = (matchesRule: boolean): RuleImpactSample => ({ matchesRule });

describe("computeRuleImpact", () => {
  it("counts affected messages and builds a Spanish summary", () => {
    const messages = [
      ...Array.from({ length: 3 }, () => sample(true)),
      ...Array.from({ length: 7 }, () => sample(false)),
    ];
    expect(computeRuleImpact(messages)).toEqual({
      affected: 3,
      total: 10,
      ratio: 0.3,
      summary:
        "Esta regla habría afectado a 3 de 10 mensajes (30%) esta semana.",
    });
  });

  it("returns a no-data assessment for an empty sample", () => {
    expect(computeRuleImpact([])).toEqual({
      affected: 0,
      total: 0,
      ratio: 0,
      summary:
        "Sin mensajes de muestra: no se puede estimar el impacto de la regla.",
    });
  });

  it("uses the ningun-mensaje branch when nothing is affected", () => {
    const messages = Array.from({ length: 4 }, () => sample(false));
    expect(computeRuleImpact(messages)).toEqual({
      affected: 0,
      total: 4,
      ratio: 0,
      summary:
        "Esta regla no habría afectado a ningún mensaje (0 de 4) esta semana.",
    });
  });

  it("rounds the ratio to two decimals", () => {
    const messages = [sample(true), sample(false), sample(false)];
    const result = computeRuleImpact(messages);
    expect(result.ratio).toBe(0.33);
    expect(result.summary).toBe(
      "Esta regla habría afectado a 1 de 3 mensajes (33%) esta semana.",
    );
  });

  it("handles a full-impact sample at 100 percent", () => {
    const messages = [sample(true), sample(true)];
    expect(computeRuleImpact(messages)).toEqual({
      affected: 2,
      total: 2,
      ratio: 1,
      summary:
        "Esta regla habría afectado a 2 de 2 mensajes (100%) esta semana.",
    });
  });

  it("uses the singular noun for a single sampled message", () => {
    const messages = [sample(true)];
    expect(computeRuleImpact(messages)).toEqual({
      affected: 1,
      total: 1,
      ratio: 1,
      summary:
        "Esta regla habría afectado a 1 de 1 mensaje (100%) esta semana.",
    });
  });

  it("computes an exact half ratio", () => {
    const messages = [sample(true), sample(false), sample(true), sample(false)];
    const result = computeRuleImpact(messages);
    expect(result.ratio).toBe(0.5);
    expect(result.summary).toBe(
      "Esta regla habría afectado a 2 de 4 mensajes (50%) esta semana.",
    );
  });

  it("is deterministic across repeated calls with the same input", () => {
    const messages = [sample(true), sample(false), sample(true)];
    const first = computeRuleImpact(messages);
    const second = computeRuleImpact(messages);
    expect(first).toEqual(second);
  });

  it("does not mutate the input array", () => {
    const messages: readonly RuleImpactSample[] = [sample(true), sample(false)];
    const snapshot = [...messages];
    computeRuleImpact(messages);
    expect(messages).toEqual(snapshot);
  });
});
