import { describe, expect, it } from "vitest";
import {
  DIAGNOSIS_STEPS,
  type DiagnosisStepId,
  isDiagnosisComplete,
  missingDiagnosisFields,
  nextDiagnosisStep,
} from "./ticket-diagnosis.js";

const allFalse: Record<DiagnosisStepId, boolean> = {
  sistema: false,
  version: false,
  error: false,
  captura: false,
};

const allTrue: Record<DiagnosisStepId, boolean> = {
  sistema: true,
  version: true,
  error: true,
  captura: true,
};

describe("DIAGNOSIS_STEPS", () => {
  it("has exactly the four expected steps in order", () => {
    expect(DIAGNOSIS_STEPS.map((step) => step.id)).toEqual([
      "sistema",
      "version",
      "error",
      "captura",
    ]);
  });

  it("gives every step a non-empty user-facing question", () => {
    for (const step of DIAGNOSIS_STEPS) {
      expect(step.question.length).toBeGreaterThan(0);
    }
  });

  it("has no duplicate ids", () => {
    const ids = DIAGNOSIS_STEPS.map((step) => step.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("nextDiagnosisStep", () => {
  it("returns the following step for each non-final step", () => {
    expect(nextDiagnosisStep("sistema")).toBe("version");
    expect(nextDiagnosisStep("version")).toBe("error");
    expect(nextDiagnosisStep("error")).toBe("captura");
  });

  it("returns null for the last step", () => {
    expect(nextDiagnosisStep("captura")).toBeNull();
  });

  it("returns null for an unknown step id", () => {
    expect(nextDiagnosisStep("nope")).toBeNull();
    expect(nextDiagnosisStep("")).toBeNull();
  });

  it("chains through the whole checklist ending in null", () => {
    const visited: string[] = [];
    let current: DiagnosisStepId | null = "sistema";
    while (current !== null) {
      visited.push(current);
      current = nextDiagnosisStep(current);
    }
    expect(visited).toEqual(["sistema", "version", "error", "captura"]);
  });
});

describe("missingDiagnosisFields", () => {
  it("returns every field when nothing is provided", () => {
    expect(missingDiagnosisFields({})).toEqual([
      "sistema",
      "version",
      "error",
      "captura",
    ]);
  });

  it("returns every field when all entries are false", () => {
    expect(missingDiagnosisFields(allFalse)).toEqual([
      "sistema",
      "version",
      "error",
      "captura",
    ]);
  });

  it("returns an empty array when everything is provided", () => {
    expect(missingDiagnosisFields(allTrue)).toEqual([]);
  });

  it("preserves checklist order for a partial set", () => {
    expect(missingDiagnosisFields({ version: true, captura: true })).toEqual([
      "sistema",
      "error",
    ]);
  });

  it("only counts strictly-true entries as provided", () => {
    const provided = { sistema: true, version: false } as Record<
      string,
      boolean
    >;
    expect(missingDiagnosisFields(provided)).toEqual([
      "version",
      "error",
      "captura",
    ]);
  });

  it("ignores unrelated keys", () => {
    const provided = { sistema: true, extra: true } as Record<string, boolean>;
    expect(missingDiagnosisFields(provided)).toEqual([
      "version",
      "error",
      "captura",
    ]);
  });

  it("is deterministic for identical inputs", () => {
    expect(missingDiagnosisFields(allFalse)).toEqual(
      missingDiagnosisFields(allFalse),
    );
  });
});

describe("isDiagnosisComplete", () => {
  it("is false when nothing is provided", () => {
    expect(isDiagnosisComplete({})).toBe(false);
  });

  it("is false when only some fields are provided", () => {
    expect(
      isDiagnosisComplete({ sistema: true, version: true, error: true }),
    ).toBe(false);
  });

  it("is true only when every field is provided", () => {
    expect(isDiagnosisComplete(allTrue)).toBe(true);
  });

  it("agrees with missingDiagnosisFields being empty", () => {
    expect(isDiagnosisComplete(allTrue)).toBe(
      missingDiagnosisFields(allTrue).length === 0,
    );
    expect(isDiagnosisComplete(allFalse)).toBe(
      missingDiagnosisFields(allFalse).length === 0,
    );
  });
});
