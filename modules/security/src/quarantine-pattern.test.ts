import { describe, expect, it } from "vitest";
import { decideQuarantine } from "./quarantine-pattern.js";

describe("decideQuarantine", () => {
  it("quarantines when all three signals fire", () => {
    expect(
      decideQuarantine({ hasPhoto: false, oddName: true, quickLink: true }),
    ).toEqual({
      quarantine: true,
      signals: ["noPhoto", "oddName", "quickLink"],
    });
  });

  it("quarantines at the default threshold of two signals", () => {
    expect(
      decideQuarantine({ hasPhoto: false, oddName: false, quickLink: true }),
    ).toEqual({ quarantine: true, signals: ["noPhoto", "quickLink"] });
  });

  it("does not quarantine with a single signal by default", () => {
    expect(
      decideQuarantine({ hasPhoto: true, oddName: true, quickLink: false }),
    ).toEqual({ quarantine: false, signals: ["oddName"] });
  });

  it("does not quarantine a clean profile", () => {
    expect(
      decideQuarantine({ hasPhoto: true, oddName: false, quickLink: false }),
    ).toEqual({ quarantine: false, signals: [] });
  });

  it("returns signals in noPhoto, oddName, quickLink order regardless of input", () => {
    expect(
      decideQuarantine({ hasPhoto: false, oddName: true, quickLink: false }),
    ).toEqual({ quarantine: true, signals: ["noPhoto", "oddName"] });
  });

  it("honors a stricter minSignals of three", () => {
    expect(
      decideQuarantine(
        { hasPhoto: false, oddName: false, quickLink: true },
        { minSignals: 3 },
      ),
    ).toEqual({ quarantine: false, signals: ["noPhoto", "quickLink"] });
  });

  it("honors a lenient minSignals of one", () => {
    expect(
      decideQuarantine(
        { hasPhoto: true, oddName: false, quickLink: true },
        { minSignals: 1 },
      ),
    ).toEqual({ quarantine: true, signals: ["quickLink"] });
  });

  it("quarantines a clean profile when minSignals is zero", () => {
    expect(
      decideQuarantine(
        { hasPhoto: true, oddName: false, quickLink: false },
        { minSignals: 0 },
      ),
    ).toEqual({ quarantine: true, signals: [] });
  });

  it("clamps a negative minSignals to zero", () => {
    expect(
      decideQuarantine(
        { hasPhoto: true, oddName: false, quickLink: false },
        { minSignals: -5 },
      ),
    ).toEqual({ quarantine: true, signals: [] });
  });

  it("treats an undefined minSignals option as the default", () => {
    expect(
      decideQuarantine(
        { hasPhoto: false, oddName: true, quickLink: false },
        {},
      ),
    ).toEqual({ quarantine: true, signals: ["noPhoto", "oddName"] });
  });

  it("is deterministic across repeated calls", () => {
    const input = { hasPhoto: false, oddName: true, quickLink: true } as const;
    const first = decideQuarantine(input);
    const second = decideQuarantine(input);
    expect(first).toEqual(second);
  });
});
