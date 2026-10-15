import { describe, expect, it } from "vitest";
import { detectGreetingSpam } from "./greeting-spam.js";

describe("detectGreetingSpam", () => {
  it("flags a bare greeting followed by a link", () => {
    expect(
      detectGreetingSpam([
        { text: "hola", hasLink: false },
        { text: "mira esto https://x.co", hasLink: true },
      ]),
    ).toEqual({ matched: true, greetingIndex: 0 });
  });

  it("returns the earliest greeting that has a later link", () => {
    expect(
      detectGreetingSpam([
        { text: "buenas", hasLink: false },
        { text: "hola", hasLink: false },
        { text: "click aqui", hasLink: true },
      ]),
    ).toEqual({ matched: true, greetingIndex: 0 });
  });

  it("ignores case, punctuation and trailing emojis in the greeting", () => {
    expect(
      detectGreetingSpam([
        { text: "  HOLA!! \u{1F44B}", hasLink: false },
        { text: "promo", hasLink: true },
      ]),
    ).toEqual({ matched: true, greetingIndex: 0 });
  });

  it("does not match a greeting with no later link", () => {
    expect(detectGreetingSpam([{ text: "hola", hasLink: false }])).toEqual({
      matched: false,
      greetingIndex: -1,
    });
  });

  it("does not match when the link comes before the greeting", () => {
    expect(
      detectGreetingSpam([
        { text: "https://x.co", hasLink: true },
        { text: "hola", hasLink: false },
      ]),
    ).toEqual({ matched: false, greetingIndex: -1 });
  });

  it("does not treat a greeting that itself carries a link as bait", () => {
    expect(
      detectGreetingSpam([
        { text: "hola", hasLink: true },
        { text: "otra cosa", hasLink: true },
      ]),
    ).toEqual({ matched: false, greetingIndex: -1 });
  });

  it("does not match a non-bare greeting like 'hola amigos'", () => {
    expect(
      detectGreetingSpam([
        { text: "hola amigos", hasLink: false },
        { text: "link", hasLink: true },
      ]),
    ).toEqual({ matched: false, greetingIndex: -1 });
  });

  it("handles an empty message list", () => {
    expect(detectGreetingSpam([])).toEqual({
      matched: false,
      greetingIndex: -1,
    });
  });

  it("ignores empty-text messages", () => {
    expect(
      detectGreetingSpam([
        { text: "", hasLink: false },
        { text: "link", hasLink: true },
      ]),
    ).toEqual({ matched: false, greetingIndex: -1 });
  });

  it("skips a linkless greeting and matches a later valid one", () => {
    expect(
      detectGreetingSpam([
        { text: "hi", hasLink: false },
        { text: "charla normal", hasLink: false },
        { text: "hey", hasLink: false },
        { text: "unete https://y.co", hasLink: true },
      ]),
    ).toEqual({ matched: true, greetingIndex: 0 });
  });

  it("is deterministic across repeated calls", () => {
    const input = [
      { text: "buenas", hasLink: false },
      { text: "oferta https://z.co", hasLink: true },
    ] as const;
    const first = detectGreetingSpam(input);
    const second = detectGreetingSpam(input);
    expect(first).toEqual(second);
    expect(first).toEqual({ matched: true, greetingIndex: 0 });
  });
});
