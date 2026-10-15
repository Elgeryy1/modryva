import { describe, expect, it } from "vitest";
import { assessDataQuality } from "./data-quality.js";

describe("assessDataQuality", () => {
  it("marks abundant data as reliable with no reasons", () => {
    expect(assessDataQuality({ sampleSize: 100, daysCovered: 30 })).toEqual({
      reliable: true,
      reasons: [],
    });
  });

  it("flags an insufficient sample size", () => {
    expect(assessDataQuality({ sampleSize: 10, daysCovered: 30 })).toEqual({
      reliable: false,
      reasons: ["⚠️ Muestra insuficiente: 10 registros (mínimo 30)."],
    });
  });

  it("flags insufficient day coverage", () => {
    expect(assessDataQuality({ sampleSize: 100, daysCovered: 3 })).toEqual({
      reliable: false,
      reasons: ["⚠️ Período insuficiente: 3 días (mínimo 7)."],
    });
  });

  it("lists sample reason before days reason when both fail", () => {
    expect(assessDataQuality({ sampleSize: 5, daysCovered: 2 })).toEqual({
      reliable: false,
      reasons: [
        "⚠️ Muestra insuficiente: 5 registros (mínimo 30).",
        "⚠️ Período insuficiente: 2 días (mínimo 7).",
      ],
    });
  });

  it("treats values exactly at the threshold as sufficient", () => {
    expect(assessDataQuality({ sampleSize: 30, daysCovered: 7 })).toEqual({
      reliable: true,
      reasons: [],
    });
  });

  it("flags values one below the threshold", () => {
    expect(assessDataQuality({ sampleSize: 29, daysCovered: 6 })).toEqual({
      reliable: false,
      reasons: [
        "⚠️ Muestra insuficiente: 29 registros (mínimo 30).",
        "⚠️ Período insuficiente: 6 días (mínimo 7).",
      ],
    });
  });

  it("uses singular nouns for a count of one", () => {
    expect(assessDataQuality({ sampleSize: 1, daysCovered: 1 })).toEqual({
      reliable: false,
      reasons: [
        "⚠️ Muestra insuficiente: 1 registro (mínimo 30).",
        "⚠️ Período insuficiente: 1 día (mínimo 7).",
      ],
    });
  });

  it("honors custom thresholds", () => {
    expect(
      assessDataQuality(
        { sampleSize: 50, daysCovered: 10 },
        { minSample: 100, minDays: 14 },
      ),
    ).toEqual({
      reliable: false,
      reasons: [
        "⚠️ Muestra insuficiente: 50 registros (mínimo 100).",
        "⚠️ Período insuficiente: 10 días (mínimo 14).",
      ],
    });
  });

  it("applies each custom threshold independently", () => {
    expect(
      assessDataQuality({ sampleSize: 50, daysCovered: 10 }, { minSample: 40 }),
    ).toEqual({ reliable: true, reasons: [] });
  });

  it("treats zero and negative counts as insufficient", () => {
    expect(assessDataQuality({ sampleSize: 0, daysCovered: -1 })).toEqual({
      reliable: false,
      reasons: [
        "⚠️ Muestra insuficiente: 0 registros (mínimo 30).",
        "⚠️ Período insuficiente: -1 días (mínimo 7).",
      ],
    });
  });

  it("is deterministic across repeated calls with the same input", () => {
    const input = { sampleSize: 12, daysCovered: 4 } as const;
    const first = assessDataQuality(input);
    const second = assessDataQuality(input);
    expect(first).toEqual(second);
    expect(first.reasons).toEqual([
      "⚠️ Muestra insuficiente: 12 registros (mínimo 30).",
      "⚠️ Período insuficiente: 4 días (mínimo 7).",
    ]);
  });
});
