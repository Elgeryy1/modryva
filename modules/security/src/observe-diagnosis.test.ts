import { describe, expect, it } from "vitest";
import { buildObservationDiagnosis } from "./observe-diagnosis.js";

describe("buildObservationDiagnosis", () => {
  it("returns tranquilo when conflict and spam ratios are low", () => {
    expect(
      buildObservationDiagnosis({ messages: 100, conflicts: 1, spam: 0 }),
    ).toEqual({
      verdict: "tranquilo",
      summary:
        "🟢 Todo tranquilo: observe 100 mensajes, 1 conflictos y 0 de spam. No hace falta intervenir por ahora.",
    });
  });

  it("returns vigilar when the conflict ratio crosses the watch threshold", () => {
    expect(
      buildObservationDiagnosis({ messages: 100, conflicts: 15, spam: 2 }),
    ).toEqual({
      verdict: "vigilar",
      summary:
        "🟡 Conviene vigilar: observe 100 mensajes, 15 conflictos y 2 de spam. Sigo observando sin intervenir, atento a que empeore.",
    });
  });

  it("returns intervenir when the conflict ratio crosses the act threshold", () => {
    expect(
      buildObservationDiagnosis({ messages: 100, conflicts: 30, spam: 5 }),
    ).toEqual({
      verdict: "intervenir",
      summary:
        "🔴 Recomiendo intervenir: observe 100 mensajes, 30 conflictos y 5 de spam. Los niveles superan el umbral seguro y conviene actuar.",
    });
  });

  it("uses spam alone to escalate to intervenir", () => {
    expect(
      buildObservationDiagnosis({ messages: 20, conflicts: 0, spam: 10 })
        .verdict,
    ).toBe("intervenir");
  });

  it("treats the watch ratio as inclusive at exactly 0.1", () => {
    expect(
      buildObservationDiagnosis({ messages: 100, conflicts: 10, spam: 0 })
        .verdict,
    ).toBe("vigilar");
  });

  it("treats the intervene ratio as inclusive at exactly 0.25", () => {
    expect(
      buildObservationDiagnosis({ messages: 100, conflicts: 25, spam: 0 })
        .verdict,
    ).toBe("intervenir");
  });

  it("returns tranquilo for an empty observation window", () => {
    expect(
      buildObservationDiagnosis({ messages: 0, conflicts: 0, spam: 0 }),
    ).toEqual({
      verdict: "tranquilo",
      summary:
        "🟢 Todo tranquilo: observe 0 mensajes, 0 conflictos y 0 de spam. No hace falta intervenir por ahora.",
    });
  });

  it("clamps negative counts to zero", () => {
    expect(
      buildObservationDiagnosis({ messages: 50, conflicts: -5, spam: -1 }),
    ).toEqual({
      verdict: "tranquilo",
      summary:
        "🟢 Todo tranquilo: observe 50 mensajes, 0 conflictos y 0 de spam. No hace falta intervenir por ahora.",
    });
  });

  it("floors fractional counts before reporting them", () => {
    expect(
      buildObservationDiagnosis({ messages: 30.9, conflicts: 12.7, spam: 0 }),
    ).toEqual({
      verdict: "intervenir",
      summary:
        "🔴 Recomiendo intervenir: observe 30 mensajes, 12 conflictos y 0 de spam. Los niveles superan el umbral seguro y conviene actuar.",
    });
  });

  it("is deterministic across repeated calls", () => {
    const input = { messages: 100, conflicts: 15, spam: 2 } as const;
    expect(buildObservationDiagnosis(input)).toEqual(
      buildObservationDiagnosis(input),
    );
  });
});
