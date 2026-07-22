import { describe, expect, it } from "vitest";
import { scoreDecisionConfidence } from "./decision-confidence.js";

describe("scoreDecisionConfidence", () => {
  it("returns full confidence when evidence, precedent and staff all max out", () => {
    expect(
      scoreDecisionConfidence({
        evidenceCount: 5,
        precedentMatch: true,
        staffAgreement: 1,
      }),
    ).toEqual({ score: 100, band: "alta" });
  });

  it("returns zero confidence with no support at all", () => {
    expect(
      scoreDecisionConfidence({
        evidenceCount: 0,
        precedentMatch: false,
        staffAgreement: 0,
      }),
    ).toEqual({ score: 0, band: "baja" });
  });

  it("rounds the weighted sum to the nearest integer", () => {
    expect(
      scoreDecisionConfidence({
        evidenceCount: 3,
        precedentMatch: false,
        staffAgreement: 0.5,
      }),
    ).toEqual({ score: 42, band: "media" });
  });

  it("credits a precedent match even without full evidence", () => {
    expect(
      scoreDecisionConfidence({
        evidenceCount: 2,
        precedentMatch: true,
        staffAgreement: 0,
      }),
    ).toEqual({ score: 41, band: "media" });
  });

  it("classifies scores at or above 70 as alta", () => {
    expect(
      scoreDecisionConfidence({
        evidenceCount: 5,
        precedentMatch: true,
        staffAgreement: 0.2,
      }),
    ).toEqual({ score: 72, band: "alta" });
  });

  it("classifies scores just below 70 as media", () => {
    expect(
      scoreDecisionConfidence({
        evidenceCount: 5,
        precedentMatch: false,
        staffAgreement: 0.8,
      }),
    ).toEqual({ score: 68, band: "media" });
  });

  it("treats exactly 40 as media and just under as baja", () => {
    expect(
      scoreDecisionConfidence({
        evidenceCount: 5,
        precedentMatch: false,
        staffAgreement: 0,
      }),
    ).toEqual({ score: 40, band: "media" });
    expect(
      scoreDecisionConfidence({
        evidenceCount: 4,
        precedentMatch: false,
        staffAgreement: 0,
      }),
    ).toEqual({ score: 32, band: "baja" });
  });

  it("clamps evidence above saturation and agreement above 1", () => {
    expect(
      scoreDecisionConfidence({
        evidenceCount: 100,
        precedentMatch: false,
        staffAgreement: 2,
      }),
    ).toEqual({ score: 75, band: "alta" });
  });

  it("clamps negative inputs to zero", () => {
    expect(
      scoreDecisionConfidence({
        evidenceCount: -5,
        precedentMatch: false,
        staffAgreement: -1,
      }),
    ).toEqual({ score: 0, band: "baja" });
  });

  it("guards against non-finite inputs by treating them as zero", () => {
    expect(
      scoreDecisionConfidence({
        evidenceCount: Number.NaN,
        precedentMatch: true,
        staffAgreement: Number.NaN,
      }),
    ).toEqual({ score: 25, band: "baja" });
  });

  it("is deterministic for repeated calls with the same input", () => {
    const input = {
      evidenceCount: 3,
      precedentMatch: true,
      staffAgreement: 0.6,
    } as const;
    const first = scoreDecisionConfidence(input);
    const second = scoreDecisionConfidence(input);
    expect(first).toEqual(second);
    expect(first).toEqual({ score: 70, band: "alta" });
  });

  it("never decreases the score as evidence increases", () => {
    const scores = [0, 1, 2, 3, 4, 5].map(
      (evidenceCount) =>
        scoreDecisionConfidence({
          evidenceCount,
          precedentMatch: false,
          staffAgreement: 0,
        }).score,
    );
    expect(scores).toEqual([0, 8, 16, 24, 32, 40]);
    const sorted = [...scores].sort((a, b) => a - b);
    expect(scores).toEqual(sorted);
  });
});
