import { describe, expect, it } from "vitest";
import { decideCelebrationMode } from "./silent-celebration.js";

describe("decideCelebrationMode", () => {
  it("celebrates publicly in a calm group", () => {
    expect(
      decideCelebrationMode({ milestone: true, recentConflicts: 1 }).mode,
    ).toBe("publica");
  });

  it("celebrates silently in a tense group", () => {
    expect(
      decideCelebrationMode({ milestone: true, recentConflicts: 5 }).mode,
    ).toBe("silenciosa");
  });

  it("does not celebrate without a milestone", () => {
    expect(
      decideCelebrationMode({ milestone: false, recentConflicts: 0 }).mode,
    ).toBe("ninguna");
  });

  it("honors a custom conflict threshold", () => {
    expect(
      decideCelebrationMode(
        { milestone: true, recentConflicts: 2 },
        {
          maxConflicts: 1,
        },
      ).mode,
    ).toBe("silenciosa");
  });

  it("always returns a message", () => {
    expect(
      decideCelebrationMode({ milestone: true, recentConflicts: 0 }).message
        .length,
    ).toBeGreaterThan(0);
  });
});
