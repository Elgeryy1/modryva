import { describe, expect, it } from "vitest";
import { canUnlockLinks } from "./link-unlock.js";

describe("canUnlockLinks", () => {
  it("unlocks a trusted, tenured member", () => {
    expect(canUnlockLinks({ tenureDays: 10, trustScore: 60 }).unlocked).toBe(
      true,
    );
  });

  it("keeps links locked without enough tenure", () => {
    expect(canUnlockLinks({ tenureDays: 3, trustScore: 90 }).unlocked).toBe(
      false,
    );
  });

  it("keeps links locked without enough trust", () => {
    expect(canUnlockLinks({ tenureDays: 30, trustScore: 20 }).unlocked).toBe(
      false,
    );
  });

  it("treats the thresholds as inclusive", () => {
    expect(canUnlockLinks({ tenureDays: 7, trustScore: 50 }).unlocked).toBe(
      true,
    );
  });

  it("honors custom thresholds", () => {
    expect(
      canUnlockLinks(
        { tenureDays: 2, trustScore: 10 },
        {
          minTenureDays: 1,
          minTrustScore: 5,
        },
      ).unlocked,
    ).toBe(true);
  });
});
