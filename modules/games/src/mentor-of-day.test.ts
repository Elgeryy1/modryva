import { describe, expect, it } from "vitest";
import { pickMentorOfDay } from "./mentor-of-day.js";

describe("pickMentorOfDay", () => {
  it("picks the candidate with the most helps", () => {
    expect(
      pickMentorOfDay([
        { userId: 1, helps: 3 },
        { userId: 2, helps: 8 },
        { userId: 3, helps: 5 },
      ]),
    ).toEqual({ mentorId: 2, helps: 8 });
  });

  it("breaks ties by lowest userId", () => {
    expect(
      pickMentorOfDay([
        { userId: 5, helps: 4 },
        { userId: 2, helps: 4 },
      ]),
    ).toEqual({ mentorId: 2, helps: 4 });
  });

  it("ignores candidates with no helps", () => {
    expect(pickMentorOfDay([{ userId: 1, helps: 0 }])).toEqual({
      mentorId: undefined,
      helps: 0,
    });
  });

  it("returns undefined for no candidates", () => {
    expect(pickMentorOfDay([])).toEqual({ mentorId: undefined, helps: 0 });
  });
});
