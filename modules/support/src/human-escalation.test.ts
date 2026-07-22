import { describe, expect, it } from "vitest";
import { decideHumanEscalation } from "./human-escalation.js";

describe("decideHumanEscalation", () => {
  it("escalates on high severity with confident bot", () => {
    expect(decideHumanEscalation({ severity: 5, botConfidence: 0.9 })).toEqual({
      escalate: true,
      reason: "⚠️ Gravedad alta: derivando a un agente humano.",
    });
  });

  it("escalates on low confidence with low severity", () => {
    expect(decideHumanEscalation({ severity: 2, botConfidence: 0.4 })).toEqual({
      escalate: true,
      reason: "⚠️ Confianza insuficiente: derivando a un agente humano.",
    });
  });

  it("escalates with combined reason when both conditions trigger", () => {
    expect(decideHumanEscalation({ severity: 5, botConfidence: 0.2 })).toEqual({
      escalate: true,
      reason: "⚠️ Gravedad alta y confianza baja: derivando a un agente humano.",
    });
  });

  it("keeps the case with the bot when within limits", () => {
    expect(decideHumanEscalation({ severity: 2, botConfidence: 0.9 })).toEqual({
      escalate: false,
      reason: "✅ El bot puede resolver este caso automáticamente.",
    });
  });

  it("does not escalate exactly at the boundaries", () => {
    expect(decideHumanEscalation({ severity: 3, botConfidence: 0.6 })).toEqual({
      escalate: false,
      reason: "✅ El bot puede resolver este caso automáticamente.",
    });
  });

  it("escalates one step above the severity boundary", () => {
    expect(decideHumanEscalation({ severity: 4, botConfidence: 0.6 })).toEqual({
      escalate: true,
      reason: "⚠️ Gravedad alta: derivando a un agente humano.",
    });
  });

  it("honours custom thresholds", () => {
    expect(
      decideHumanEscalation(
        { severity: 5, botConfidence: 0.7 },
        { maxSeverityForBot: 5, minConfidence: 0.8 },
      ),
    ).toEqual({
      escalate: true,
      reason: "⚠️ Confianza insuficiente: derivando a un agente humano.",
    });
  });

  it("treats an empty options object as defaults", () => {
    expect(
      decideHumanEscalation({ severity: 1, botConfidence: 1 }, {}),
    ).toEqual({
      escalate: false,
      reason: "✅ El bot puede resolver este caso automáticamente.",
    });
  });

  it("is deterministic for repeated identical calls", () => {
    const input = { severity: 4, botConfidence: 0.3 } as const;
    const first = decideHumanEscalation(input);
    const second = decideHumanEscalation(input);
    expect(first).toEqual(second);
    expect(first).toEqual({
      escalate: true,
      reason: "⚠️ Gravedad alta y confianza baja: derivando a un agente humano.",
    });
  });
});
