import { describe, expect, it } from "vitest";
import { shouldActivateVolumeProtection } from "./volume-trigger.js";

describe("shouldActivateVolumeProtection", () => {
  it("activates on a 300% surge by default", () => {
    expect(
      shouldActivateVolumeProtection({ baseline: 10, current: 30 }),
    ).toEqual({ activate: true, ratio: 3 });
  });

  it("does not activate below the spike ratio", () => {
    expect(
      shouldActivateVolumeProtection({ baseline: 10, current: 20 }),
    ).toEqual({ activate: false, ratio: 2 });
  });

  it("rounds the ratio to 2 decimals", () => {
    expect(
      shouldActivateVolumeProtection({ baseline: 3, current: 10 }).ratio,
    ).toBe(3.33);
  });

  it("guards a zero baseline", () => {
    expect(
      shouldActivateVolumeProtection({ baseline: 0, current: 50 }),
    ).toEqual({
      activate: false,
      ratio: 0,
    });
  });

  it("honors a custom spike ratio", () => {
    expect(
      shouldActivateVolumeProtection(
        { baseline: 10, current: 20 },
        {
          spikeRatio: 2,
        },
      ).activate,
    ).toBe(true);
  });
});
