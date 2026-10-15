import { describe, expect, it } from "vitest";
import { detectOffTopicStudy } from "./off-topic-study.js";

describe("detectOffTopicStudy", () => {
  it("flags off-topic keywords during study hours", () => {
    expect(
      detectOffTopicStudy({ hourOfDay: 10, text: "un meme rapido" }),
    ).toEqual({ flagged: true, hits: ["meme"] });
  });

  it("does not flag outside study hours", () => {
    expect(detectOffTopicStudy({ hourOfDay: 22, text: "un meme" })).toEqual({
      flagged: false,
      hits: ["meme"],
    });
  });

  it("does not flag clean messages during study hours", () => {
    expect(
      detectOffTopicStudy({ hourOfDay: 10, text: "duda de mate" }),
    ).toEqual({
      flagged: false,
      hits: [],
    });
  });

  it("is accent insensitive", () => {
    expect(
      detectOffTopicStudy(
        { hourOfDay: 10, text: "una canción" },
        { offTopicKeywords: ["cancion"] },
      ).hits,
    ).toEqual(["cancion"]);
  });

  it("honors custom study hours", () => {
    expect(
      detectOffTopicStudy(
        { hourOfDay: 20, text: "meme" },
        { studyStart: 19, studyEnd: 23 },
      ).flagged,
    ).toBe(true);
  });

  it("treats studyEnd as exclusive", () => {
    expect(detectOffTopicStudy({ hourOfDay: 18, text: "meme" }).flagged).toBe(
      false,
    );
  });
});
