import { describe, expect, it } from "vitest";
import { assessProportionality } from "./proportionality.js";

describe("assessProportionality", () => {
  it("returns 'proporcional' when the applied level matches the expected level", () => {
    expect(
      assessProportionality({ sanctionLevel: 4, gravity: 3, recidivism: 1 }),
    ).toEqual({
      verdict: "proporcional",
      expectedLevel: 4,
      appliedLevel: 4,
      delta: 0,
      summary: "✅ Sanción proporcional: nivel 4 coincide con el 4 esperado.",
    });
  });

  it("returns 'excesiva' when the sanction is harsher than expected", () => {
    expect(
      assessProportionality({ sanctionLevel: 5, gravity: 2, recidivism: 0 }),
    ).toEqual({
      verdict: "excesiva",
      expectedLevel: 2,
      appliedLevel: 5,
      delta: 3,
      summary: "⚠️ Sanción excesiva: nivel 5 supera el 2 esperado.",
    });
  });

  it("returns 'blanda' when the sanction is softer than expected", () => {
    expect(
      assessProportionality({ sanctionLevel: 1, gravity: 5, recidivism: 2 }),
    ).toEqual({
      verdict: "blanda",
      expectedLevel: 5,
      appliedLevel: 1,
      delta: -4,
      summary: "🔽 Sanción blanda: nivel 1 por debajo del 5 esperado.",
    });
  });

  it("clamps the expected level to the 0..5 range for very high inputs", () => {
    const result = assessProportionality({
      sanctionLevel: 100,
      gravity: 10,
      recidivism: 10,
    });
    expect(result.expectedLevel).toBe(5);
    expect(result.appliedLevel).toBe(5);
    expect(result.delta).toBe(0);
    expect(result.verdict).toBe("proporcional");
  });

  it("treats negative inputs as the minimum level", () => {
    expect(
      assessProportionality({ sanctionLevel: -1, gravity: -3, recidivism: -2 }),
    ).toEqual({
      verdict: "proporcional",
      expectedLevel: 0,
      appliedLevel: 0,
      delta: 0,
      summary: "✅ Sanción proporcional: nivel 0 coincide con el 0 esperado.",
    });
  });

  it("treats non-finite inputs as safe defaults", () => {
    expect(
      assessProportionality({
        sanctionLevel: Number.NaN,
        gravity: Number.POSITIVE_INFINITY,
        recidivism: Number.NaN,
      }),
    ).toEqual({
      verdict: "proporcional",
      expectedLevel: 0,
      appliedLevel: 0,
      delta: 0,
      summary: "✅ Sanción proporcional: nivel 0 coincide con el 0 esperado.",
    });
  });

  it("rounds fractional inputs before comparing", () => {
    const result = assessProportionality({
      sanctionLevel: 3.5,
      gravity: 2.4,
      recidivism: 0.6,
    });
    // gravity 2.4 -> 2, recidivism 0.6 -> 1, expected 3; sanction 3.5 -> 4
    expect(result.expectedLevel).toBe(3);
    expect(result.appliedLevel).toBe(4);
    expect(result.delta).toBe(1);
    expect(result.verdict).toBe("excesiva");
    expect(result.summary).toBe(
      "⚠️ Sanción excesiva: nivel 4 supera el 3 esperado.",
    );
  });

  it("counts each prior offense as one escalation level", () => {
    const noPriors = assessProportionality({
      sanctionLevel: 2,
      gravity: 2,
      recidivism: 0,
    });
    const withPriors = assessProportionality({
      sanctionLevel: 2,
      gravity: 2,
      recidivism: 1,
    });
    expect(noPriors.expectedLevel).toBe(2);
    expect(noPriors.verdict).toBe("proporcional");
    expect(withPriors.expectedLevel).toBe(3);
    expect(withPriors.verdict).toBe("blanda");
  });

  it("uses the minimum level at the lower boundary", () => {
    expect(
      assessProportionality({ sanctionLevel: 0, gravity: 0, recidivism: 0 }),
    ).toEqual({
      verdict: "proporcional",
      expectedLevel: 0,
      appliedLevel: 0,
      delta: 0,
      summary: "✅ Sanción proporcional: nivel 0 coincide con el 0 esperado.",
    });
  });

  it("is deterministic for repeated calls with the same input", () => {
    const input = { sanctionLevel: 4, gravity: 1, recidivism: 1 } as const;
    const first = assessProportionality(input);
    const second = assessProportionality(input);
    expect(first).toEqual(second);
    expect(first).toEqual({
      verdict: "excesiva",
      expectedLevel: 2,
      appliedLevel: 4,
      delta: 2,
      summary: "⚠️ Sanción excesiva: nivel 4 supera el 2 esperado.",
    });
  });
});
