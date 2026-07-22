import { describe, expect, it } from "vitest";
import { detectSignatureSpam } from "./signature-spam.js";

describe("detectSignatureSpam", () => {
  it("flags a repeated promotional signature at the threshold", () => {
    const messages = [
      "Hola gente\n@promo",
      "Otra cosa\n@promo",
      "Mira esto\n@promo",
    ];
    expect(detectSignatureSpam(messages)).toEqual({
      matched: true,
      signature: "@promo",
      occurrences: 3,
    });
  });

  it("does not flag when the signature repeats below the threshold", () => {
    const messages = ["a\n@promo", "b\n@promo", "c"];
    expect(detectSignatureSpam(messages)).toEqual({
      matched: false,
      signature: undefined,
      occurrences: 0,
    });
  });

  it("does not flag a frequent line without a promotional hint", () => {
    const messages = ["hola\nsaludos", "que tal\nsaludos", "adios\nsaludos"];
    expect(detectSignatureSpam(messages)).toEqual({
      matched: false,
      signature: undefined,
      occurrences: 0,
    });
  });

  it("handles an empty list", () => {
    expect(detectSignatureSpam([])).toEqual({
      matched: false,
      signature: undefined,
      occurrences: 0,
    });
  });

  it("ignores empty and whitespace-only messages", () => {
    expect(detectSignatureSpam(["", "   ", "\n\n"])).toEqual({
      matched: false,
      signature: undefined,
      occurrences: 0,
    });
  });

  it("normalizes casing and collapses whitespace before counting", () => {
    const messages = [
      "hey\nUnete a  T.ME/Canal",
      "yo\nunete a t.me/canal",
      "sup\nUNETE A   T.ME/CANAL",
    ];
    expect(detectSignatureSpam(messages)).toEqual({
      matched: true,
      signature: "unete a t.me/canal",
      occurrences: 3,
    });
  });

  it("respects a custom minOccurrences threshold", () => {
    const messages = ["a\n@x", "b\n@x"];
    expect(detectSignatureSpam(messages, { minOccurrences: 2 })).toEqual({
      matched: true,
      signature: "@x",
      occurrences: 2,
    });
  });

  it("breaks frequency ties by first appearance", () => {
    const messages = [
      "1\nhttp://a.com",
      "2\nhttp://b.com",
      "3\nhttp://a.com",
      "4\nhttp://b.com",
      "5\nhttp://a.com",
      "6\nhttp://b.com",
    ];
    expect(detectSignatureSpam(messages)).toEqual({
      matched: true,
      signature: "http://a.com",
      occurrences: 3,
    });
  });

  it("uses the last non-empty line, ignoring trailing blanks", () => {
    const messages = ["texto\n@promo\n\n  ", "otro\n@promo\n", "mas\n\n@promo"];
    expect(detectSignatureSpam(messages)).toEqual({
      matched: true,
      signature: "@promo",
      occurrences: 3,
    });
  });

  it("returns the same result across repeated calls", () => {
    const messages = ["1\n@ref", "2\n@ref", "3\n@ref"];
    const first = detectSignatureSpam(messages);
    const second = detectSignatureSpam(messages);
    expect(first).toEqual(second);
    expect(first).toEqual({ matched: true, signature: "@ref", occurrences: 3 });
  });

  it('recognizes the word "canal" as a promotional hint', () => {
    const messages = [
      "x\nUnete al canal exclusivo",
      "y\nunete al canal exclusivo",
      "z\nUNETE AL CANAL EXCLUSIVO",
    ];
    expect(detectSignatureSpam(messages)).toEqual({
      matched: true,
      signature: "unete al canal exclusivo",
      occurrences: 3,
    });
  });
});
