import { describe, expect, it } from "vitest";
import { awardLegendaryItems } from "./legendary-items.js";

describe("awardLegendaryItems", () => {
  it("awards every legendary item in curated order when all thresholds are met", () => {
    expect(
      awardLegendaryItems({
        raidsSurvived: 5,
        yearsActive: 1,
        topHelper: true,
      }),
    ).toEqual(["guardian", "veterano", "faro"]);
  });

  it("returns an empty array when no threshold is met", () => {
    expect(
      awardLegendaryItems({
        raidsSurvived: 4,
        yearsActive: 0,
        topHelper: false,
      }),
    ).toEqual([]);
  });

  it("awards only guardian at exactly 5 raids survived", () => {
    expect(
      awardLegendaryItems({
        raidsSurvived: 5,
        yearsActive: 0,
        topHelper: false,
      }),
    ).toEqual(["guardian"]);
  });

  it("does not award guardian just below the raid threshold", () => {
    expect(
      awardLegendaryItems({
        raidsSurvived: 4,
        yearsActive: 0,
        topHelper: false,
      }),
    ).toEqual([]);
  });

  it("awards veterano at exactly one year active", () => {
    expect(
      awardLegendaryItems({
        raidsSurvived: 0,
        yearsActive: 1,
        topHelper: false,
      }),
    ).toEqual(["veterano"]);
  });

  it("does not award veterano for a fractional year below one", () => {
    expect(
      awardLegendaryItems({
        raidsSurvived: 0,
        yearsActive: 0.9,
        topHelper: false,
      }),
    ).toEqual([]);
  });

  it("awards faro solely from the top-helper distinction", () => {
    expect(
      awardLegendaryItems({
        raidsSurvived: 0,
        yearsActive: 0,
        topHelper: true,
      }),
    ).toEqual(["faro"]);
  });

  it("keeps curated order even when only later rules apply", () => {
    expect(
      awardLegendaryItems({
        raidsSurvived: 0,
        yearsActive: 3,
        topHelper: true,
      }),
    ).toEqual(["veterano", "faro"]);
  });

  it("ignores negative stats as unearned", () => {
    expect(
      awardLegendaryItems({
        raidsSurvived: -10,
        yearsActive: -1,
        topHelper: false,
      }),
    ).toEqual([]);
  });

  it("is deterministic across repeated calls with the same stats", () => {
    const stats = {
      raidsSurvived: 7,
      yearsActive: 2,
      topHelper: false,
    } as const;
    const first = awardLegendaryItems(stats);
    const second = awardLegendaryItems(stats);
    expect(first).toEqual(["guardian", "veterano"]);
    expect(second).toEqual(first);
  });
});
