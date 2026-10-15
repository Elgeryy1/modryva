import { describe, expect, it } from "vitest";
import { correlateAnnounceAbandon } from "./announce-abandon.js";

describe("correlateAnnounceAbandon", () => {
  it("correlates heavy announcing with more departures", () => {
    expect(
      correlateAnnounceAbandon([
        { announcements: 5, leaves: 10 },
        { announcements: 4, leaves: 8 },
        { announcements: 1, leaves: 1 },
        { announcements: 0, leaves: 1 },
      ]),
    ).toEqual({
      highAnnounceLeavesAvg: 9,
      lowAnnounceLeavesAvg: 1,
      correlated: true,
    });
  });

  it("does not correlate similar departures", () => {
    expect(
      correlateAnnounceAbandon([
        { announcements: 5, leaves: 2 },
        { announcements: 1, leaves: 2 },
      ]).correlated,
    ).toBe(false);
  });

  it("does not correlate without both buckets", () => {
    expect(
      correlateAnnounceAbandon([{ announcements: 5, leaves: 10 }]).correlated,
    ).toBe(false);
  });

  it("handles empty input", () => {
    expect(correlateAnnounceAbandon([])).toEqual({
      highAnnounceLeavesAvg: 0,
      lowAnnounceLeavesAvg: 0,
      correlated: false,
    });
  });
});
