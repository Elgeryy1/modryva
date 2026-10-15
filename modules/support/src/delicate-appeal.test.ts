import { describe, expect, it } from "vitest";
import { markDelicateAppeal } from "./delicate-appeal.js";

describe("markDelicateAppeal", () => {
  it("is not delicate when no flags are set", () => {
    expect(
      markDelicateAppeal({
        mentionsMinor: false,
        mentionsLegal: false,
        mentionsSelfHarm: false,
      }),
    ).toEqual({ delicate: false, reasons: [] });
  });

  it("flags a minor mention", () => {
    expect(
      markDelicateAppeal({
        mentionsMinor: true,
        mentionsLegal: false,
        mentionsSelfHarm: false,
      }),
    ).toEqual({
      delicate: true,
      reasons: ["Menciona a una persona menor de edad 🚸"],
    });
  });

  it("flags a legal mention", () => {
    expect(
      markDelicateAppeal({
        mentionsMinor: false,
        mentionsLegal: true,
        mentionsSelfHarm: false,
      }),
    ).toEqual({ delicate: true, reasons: ["Plantea una cuestion legal ⚖️"] });
  });

  it("flags a self-harm mention", () => {
    expect(
      markDelicateAppeal({
        mentionsMinor: false,
        mentionsLegal: false,
        mentionsSelfHarm: true,
      }),
    ).toEqual({ delicate: true, reasons: ["Indica riesgo de autolesion ❤️"] });
  });

  it("collects all reasons in fixed order when every flag is set", () => {
    expect(
      markDelicateAppeal({
        mentionsMinor: true,
        mentionsLegal: true,
        mentionsSelfHarm: true,
      }),
    ).toEqual({
      delicate: true,
      reasons: [
        "Menciona a una persona menor de edad 🚸",
        "Plantea una cuestion legal ⚖️",
        "Indica riesgo de autolesion ❤️",
      ],
    });
  });

  it("keeps reason order stable regardless of which flags combine", () => {
    const a = markDelicateAppeal({
      mentionsMinor: true,
      mentionsLegal: false,
      mentionsSelfHarm: true,
    });
    expect(a.reasons).toEqual([
      "Menciona a una persona menor de edad 🚸",
      "Indica riesgo de autolesion ❤️",
    ]);
  });

  it("marks delicate when only the legal-and-self-harm pair is set", () => {
    expect(
      markDelicateAppeal({
        mentionsMinor: false,
        mentionsLegal: true,
        mentionsSelfHarm: true,
      }),
    ).toEqual({
      delicate: true,
      reasons: [
        "Plantea una cuestion legal ⚖️",
        "Indica riesgo de autolesion ❤️",
      ],
    });
  });

  it("is deterministic for repeated identical inputs", () => {
    const input = {
      mentionsMinor: true,
      mentionsLegal: true,
      mentionsSelfHarm: false,
    } as const;
    expect(markDelicateAppeal(input)).toEqual(markDelicateAppeal(input));
  });
});
