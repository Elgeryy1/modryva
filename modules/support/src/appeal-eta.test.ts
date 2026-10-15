import { describe, expect, it } from "vitest";
import { estimateAppealEta, humanizeEtaEs } from "./appeal-eta.js";

describe("estimateAppealEta", () => {
  it("multiplies queue length by average review time and humanizes the wait", () => {
    expect(estimateAppealEta({ queueLength: 3, avgReviewMs: 60_000 })).toEqual({
      etaMs: 180_000,
      label: "en alrededor de 3 minutos",
    });
  });

  it("reports immediate review for an empty queue", () => {
    expect(estimateAppealEta({ queueLength: 0, avgReviewMs: 60_000 })).toEqual({
      etaMs: 0,
      label: "de inmediato",
    });
  });

  it("labels an exact one-hour wait in the singular", () => {
    expect(
      estimateAppealEta({ queueLength: 1, avgReviewMs: 3_600_000 }),
    ).toEqual({
      etaMs: 3_600_000,
      label: "en alrededor de una hora",
    });
  });

  it("labels multi-day waits with the accented plural", () => {
    expect(
      estimateAppealEta({ queueLength: 2, avgReviewMs: 86_400_000 }),
    ).toEqual({
      etaMs: 172_800_000,
      label: "en alrededor de 2 días",
    });
  });

  it("floors a fractional queue length to a whole count", () => {
    expect(estimateAppealEta({ queueLength: 2.9, avgReviewMs: 1_000 })).toEqual(
      {
        etaMs: 2_000,
        label: "en menos de un minuto",
      },
    );
  });

  it("clamps a negative average review time to zero", () => {
    expect(estimateAppealEta({ queueLength: 5, avgReviewMs: -100 })).toEqual({
      etaMs: 0,
      label: "de inmediato",
    });
  });

  it("clamps non-finite inputs to zero", () => {
    expect(
      estimateAppealEta({
        queueLength: Number.POSITIVE_INFINITY,
        avgReviewMs: 1_000,
      }),
    ).toEqual({
      etaMs: 0,
      label: "de inmediato",
    });
    expect(
      estimateAppealEta({ queueLength: 4, avgReviewMs: Number.NaN }),
    ).toEqual({
      etaMs: 0,
      label: "de inmediato",
    });
  });

  it("is deterministic across repeated calls with the same input", () => {
    const input = { queueLength: 7, avgReviewMs: 90_000 };
    const first = estimateAppealEta(input);
    const second = estimateAppealEta(input);
    expect(first).toEqual(second);
    expect(first).toEqual({
      etaMs: 630_000,
      label: "en alrededor de 11 minutos",
    });
  });
});

describe("humanizeEtaEs", () => {
  it("returns immediate for non-positive and non-finite durations", () => {
    expect(humanizeEtaEs(0)).toBe("de inmediato");
    expect(humanizeEtaEs(-5)).toBe("de inmediato");
    expect(humanizeEtaEs(Number.NaN)).toBe("de inmediato");
    expect(humanizeEtaEs(Number.POSITIVE_INFINITY)).toBe("de inmediato");
  });

  it("returns less-than-a-minute just below one minute", () => {
    expect(humanizeEtaEs(30_000)).toBe("en menos de un minuto");
    expect(humanizeEtaEs(59_999)).toBe("en menos de un minuto");
  });

  it("uses the singular at exactly one minute, hour and day", () => {
    expect(humanizeEtaEs(60_000)).toBe("en alrededor de un minuto");
    expect(humanizeEtaEs(3_600_000)).toBe("en alrededor de una hora");
    expect(humanizeEtaEs(86_400_000)).toBe("en alrededor de un día");
  });

  it("uses accented plurals for minutes, hours and days", () => {
    expect(humanizeEtaEs(120_000)).toBe("en alrededor de 2 minutos");
    expect(humanizeEtaEs(7_200_000)).toBe("en alrededor de 2 horas");
    expect(humanizeEtaEs(259_200_000)).toBe("en alrededor de 3 días");
  });
});
