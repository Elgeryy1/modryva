import { describe, expect, it } from "vitest";
import {
  type AnnouncementConflictDay,
  correlateAnnouncementsConflicts,
} from "./announce-conflict-correlation.js";

describe("correlateAnnouncementsConflicts", () => {
  it("flags a correlation when announcement days average far more conflicts", () => {
    const days: readonly AnnouncementConflictDay[] = [
      { announcements: 2, conflicts: 10 },
      { announcements: 0, conflicts: 2 },
      { announcements: 1, conflicts: 8 },
      { announcements: 0, conflicts: 4 },
    ];
    expect(correlateAnnouncementsConflicts(days)).toEqual({
      withAnnouncementAvg: 9,
      withoutAnnouncementAvg: 3,
      correlated: true,
    });
  });

  it("does not flag when the difference is under the 1.5x threshold", () => {
    const days: readonly AnnouncementConflictDay[] = [
      { announcements: 1, conflicts: 5 },
      { announcements: 0, conflicts: 4 },
    ];
    expect(correlateAnnouncementsConflicts(days)).toEqual({
      withAnnouncementAvg: 5,
      withoutAnnouncementAvg: 4,
      correlated: false,
    });
  });

  it("returns all zeros and no correlation for an empty window", () => {
    expect(correlateAnnouncementsConflicts([])).toEqual({
      withAnnouncementAvg: 0,
      withoutAnnouncementAvg: 0,
      correlated: false,
    });
  });

  it("treats every day as an announcement day when none are clean", () => {
    const days: readonly AnnouncementConflictDay[] = [
      { announcements: 1, conflicts: 6 },
      { announcements: 2, conflicts: 8 },
    ];
    expect(correlateAnnouncementsConflicts(days)).toEqual({
      withAnnouncementAvg: 7,
      withoutAnnouncementAvg: 0,
      correlated: true,
    });
  });

  it("does not correlate when only clean days exist", () => {
    const days: readonly AnnouncementConflictDay[] = [
      { announcements: 0, conflicts: 3 },
      { announcements: 0, conflicts: 5 },
    ];
    expect(correlateAnnouncementsConflicts(days)).toEqual({
      withAnnouncementAvg: 0,
      withoutAnnouncementAvg: 4,
      correlated: false,
    });
  });

  it("rounds averages to 2 decimals", () => {
    const days: readonly AnnouncementConflictDay[] = [
      { announcements: 1, conflicts: 1 },
      { announcements: 1, conflicts: 1 },
      { announcements: 1, conflicts: 2 },
      { announcements: 0, conflicts: 0 },
    ];
    expect(correlateAnnouncementsConflicts(days)).toEqual({
      withAnnouncementAvg: 1.33,
      withoutAnnouncementAvg: 0,
      correlated: true,
    });
  });

  it("handles a single announcement-only day", () => {
    const days: readonly AnnouncementConflictDay[] = [
      { announcements: 3, conflicts: 7 },
    ];
    expect(correlateAnnouncementsConflicts(days)).toEqual({
      withAnnouncementAvg: 7,
      withoutAnnouncementAvg: 0,
      correlated: true,
    });
  });

  it("is deterministic for the same input", () => {
    const days: readonly AnnouncementConflictDay[] = [
      { announcements: 1, conflicts: 9 },
      { announcements: 0, conflicts: 2 },
    ];
    const first = correlateAnnouncementsConflicts(days);
    const second = correlateAnnouncementsConflicts(days);
    expect(first).toEqual(second);
  });
});
