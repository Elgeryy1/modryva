import { describe, expect, it } from "vitest";
import {
  filterVisibleBadges,
  type ProfileBadge,
  summarizeBadgePrivacy,
} from "./profile-privacy.js";

describe("filterVisibleBadges", () => {
  it("returns ids of non-hidden badges preserving input order", () => {
    const badges: readonly ProfileBadge[] = [
      { id: "veteran", hidden: false },
      { id: "whale", hidden: true },
      { id: "founder", hidden: false },
    ];
    expect(filterVisibleBadges(badges)).toEqual(["veteran", "founder"]);
  });

  it("returns an empty list for an empty profile", () => {
    expect(filterVisibleBadges([])).toEqual([]);
  });

  it("returns an empty list when every badge is hidden", () => {
    const badges: readonly ProfileBadge[] = [
      { id: "a", hidden: true },
      { id: "b", hidden: true },
    ];
    expect(filterVisibleBadges(badges)).toEqual([]);
  });

  it("returns every id when nothing is hidden", () => {
    const badges: readonly ProfileBadge[] = [
      { id: "x", hidden: false },
      { id: "y", hidden: false },
    ];
    expect(filterVisibleBadges(badges)).toEqual(["x", "y"]);
  });

  it("preserves duplicate visible ids", () => {
    const badges: readonly ProfileBadge[] = [
      { id: "dup", hidden: false },
      { id: "dup", hidden: false },
    ];
    expect(filterVisibleBadges(badges)).toEqual(["dup", "dup"]);
  });

  it("is order-stable and deterministic across repeated calls", () => {
    const badges: readonly ProfileBadge[] = [
      { id: "one", hidden: false },
      { id: "two", hidden: true },
      { id: "three", hidden: false },
      { id: "four", hidden: false },
    ];
    const first = filterVisibleBadges(badges);
    const second = filterVisibleBadges(badges);
    expect(first).toEqual(["one", "three", "four"]);
    expect(second).toEqual(first);
  });
});

describe("summarizeBadgePrivacy", () => {
  it("counts total, visible and hidden badges", () => {
    const badges: readonly ProfileBadge[] = [
      { id: "a", hidden: false },
      { id: "b", hidden: true },
      { id: "c", hidden: false },
    ];
    expect(summarizeBadgePrivacy(badges)).toEqual({
      total: 3,
      visible: 2,
      hiddenCount: 1,
      allHidden: false,
    });
  });

  it("reports allHidden true when every badge is private", () => {
    const badges: readonly ProfileBadge[] = [
      { id: "a", hidden: true },
      { id: "b", hidden: true },
    ];
    expect(summarizeBadgePrivacy(badges)).toEqual({
      total: 2,
      visible: 0,
      hiddenCount: 2,
      allHidden: true,
    });
  });

  it("reports allHidden false for an empty profile", () => {
    expect(summarizeBadgePrivacy([])).toEqual({
      total: 0,
      visible: 0,
      hiddenCount: 0,
      allHidden: false,
    });
  });
});
