import { describe, expect, it } from "vitest";
import { classifyCaseSensitivity } from "./case-sensitivity.js";

describe("classifyCaseSensitivity", () => {
  it("returns normal when no risk factors are present", () => {
    expect(
      classifyCaseSensitivity({
        hasPersonalData: false,
        involvesMinor: false,
        legalThreat: false,
      }),
    ).toEqual({
      level: "normal",
      reason: "Caso normal: sin factores de sensibilidad. ✅",
    });
  });

  it("returns privado when only personal data is present", () => {
    expect(
      classifyCaseSensitivity({
        hasPersonalData: true,
        involvesMinor: false,
        legalThreat: false,
      }),
    ).toEqual({
      level: "privado",
      reason: "Caso privado: contiene datos personales del usuario. 🔒",
    });
  });

  it("returns delicado when only a minor is involved", () => {
    expect(
      classifyCaseSensitivity({
        hasPersonalData: false,
        involvesMinor: true,
        legalThreat: false,
      }),
    ).toEqual({
      level: "delicado",
      reason: "Caso delicado: involucra a un menor de edad. 🚸",
    });
  });

  it("returns legal when only a legal threat is present", () => {
    expect(
      classifyCaseSensitivity({
        hasPersonalData: false,
        involvesMinor: false,
        legalThreat: true,
      }),
    ).toEqual({
      level: "legal",
      reason:
        "Caso legal: hay una amenaza legal que requiere revisión jurídica. ⚖️",
    });
  });

  it("prioritizes legal over delicado when a minor and a legal threat coincide", () => {
    expect(
      classifyCaseSensitivity({
        hasPersonalData: false,
        involvesMinor: true,
        legalThreat: true,
      }).level,
    ).toBe("legal");
  });

  it("prioritizes delicado over privado when a minor and personal data coincide", () => {
    expect(
      classifyCaseSensitivity({
        hasPersonalData: true,
        involvesMinor: true,
        legalThreat: false,
      }).level,
    ).toBe("delicado");
  });

  it("prioritizes legal over every other factor when all are present", () => {
    expect(
      classifyCaseSensitivity({
        hasPersonalData: true,
        involvesMinor: true,
        legalThreat: true,
      }),
    ).toEqual({
      level: "legal",
      reason:
        "Caso legal: hay una amenaza legal que requiere revisión jurídica. ⚖️",
    });
  });

  it("prioritizes privado over normal when personal data and a legal threat are absent but data present", () => {
    expect(
      classifyCaseSensitivity({
        hasPersonalData: true,
        involvesMinor: false,
        legalThreat: false,
      }).level,
    ).toBe("privado");
  });

  it("is deterministic for identical inputs across repeated calls", () => {
    const input = {
      hasPersonalData: true,
      involvesMinor: true,
      legalThreat: false,
    };
    const first = classifyCaseSensitivity(input);
    const second = classifyCaseSensitivity(input);
    expect(first).toEqual(second);
    expect(first).toEqual({
      level: "delicado",
      reason: "Caso delicado: involucra a un menor de edad. 🚸",
    });
  });

  it("always returns one of the four known levels", () => {
    const levels = new Set<string>();
    for (const legalThreat of [false, true]) {
      for (const involvesMinor of [false, true]) {
        for (const hasPersonalData of [false, true]) {
          levels.add(
            classifyCaseSensitivity({
              hasPersonalData,
              involvesMinor,
              legalThreat,
            }).level,
          );
        }
      }
    }
    expect(levels).toEqual(new Set(["normal", "privado", "delicado", "legal"]));
  });
});
