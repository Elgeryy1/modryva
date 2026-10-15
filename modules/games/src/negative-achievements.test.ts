import { describe, expect, it } from "vitest";
import { detectNegativeAchievements } from "./negative-achievements.js";

describe("detectNegativeAchievements", () => {
  it("flags farmer on high rapid plays", () => {
    expect(
      detectNegativeAchievements({
        rapidPlays: 100,
        identicalActions: 0,
        nightGrind: 0,
      }),
    ).toEqual(["farmer"]);
  });

  it("flags multiple negatives in curated order", () => {
    expect(
      detectNegativeAchievements({
        rapidPlays: 100,
        identicalActions: 50,
        nightGrind: 30,
      }),
    ).toEqual(["farmer", "robot", "night_grinder"]);
  });

  it("returns empty for clean stats", () => {
    expect(
      detectNegativeAchievements({
        rapidPlays: 10,
        identicalActions: 5,
        nightGrind: 2,
      }),
    ).toEqual([]);
  });

  it("flags robot on identical actions only", () => {
    expect(
      detectNegativeAchievements({
        rapidPlays: 0,
        identicalActions: 60,
        nightGrind: 0,
      }),
    ).toEqual(["robot"]);
  });

  it("is deterministic", () => {
    const stats = { rapidPlays: 200, identicalActions: 0, nightGrind: 40 };
    expect(detectNegativeAchievements(stats)).toEqual(
      detectNegativeAchievements(stats),
    );
  });
});
