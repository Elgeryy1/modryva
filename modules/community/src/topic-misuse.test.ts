import { describe, expect, it } from "vitest";
import { detectTopicMisuse } from "./topic-misuse.js";

const base = {
  topicKeywords: ["soporte", "error", "bug"],
  offTopicKeywords: ["meme", "broma", "futbol"],
};

describe("detectTopicMisuse", () => {
  it("flags an off-topic message with no topic keyword", () => {
    expect(
      detectTopicMisuse({ ...base, text: "miren este meme buenisimo" }),
    ).toEqual({ misused: true, hits: ["meme"] });
  });

  it("does not flag when a topic keyword is present", () => {
    expect(
      detectTopicMisuse({ ...base, text: "meme sobre un bug de soporte" }),
    ).toEqual({ misused: false, hits: ["meme"] });
  });

  it("returns no hits for a clean on-topic message", () => {
    expect(
      detectTopicMisuse({ ...base, text: "tengo un error grave" }),
    ).toEqual({ misused: false, hits: [] });
  });

  it("is accent and case insensitive", () => {
    expect(detectTopicMisuse({ ...base, text: "puro FUTBOL hoy" })).toEqual({
      misused: true,
      hits: ["futbol"],
    });
  });

  it("deduplicates and preserves offTopicKeywords order", () => {
    expect(
      detectTopicMisuse({ ...base, text: "meme meme y broma" }).hits,
    ).toEqual(["meme", "broma"]);
  });

  it("handles empty text", () => {
    expect(detectTopicMisuse({ ...base, text: "" })).toEqual({
      misused: false,
      hits: [],
    });
  });
});
