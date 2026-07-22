import { describe, expect, it } from "vitest";
import {
  detectEditSpam,
  EDIT_SPAM_GROWTH_FACTOR,
  EDIT_SPAM_MIN_GROWTH_LENGTH,
  type EditSpamSnapshot,
} from "./edit-spam.js";

const snap = (overrides: Partial<EditSpamSnapshot> = {}): EditSpamSnapshot => ({
  hasUrl: false,
  hasMention: false,
  text: "",
  ...overrides,
});

/** Genera un texto de exactamente `n` caracteres. */
const filler = (n: number): string => "a".repeat(n);

describe("detectEditSpam - url", () => {
  it("flags a url that appeared after editing", () => {
    expect(
      detectEditSpam(
        snap({ text: "hola gente" }),
        snap({ hasUrl: true, text: "hola gente http://spam.co" }),
      ),
    ).toEqual({ suspicious: true, reason: "added-url" });
  });

  it("does not flag when the url was already present before", () => {
    expect(
      detectEditSpam(
        snap({ hasUrl: true, text: "mira http://ok.co" }),
        snap({ hasUrl: true, text: "mira http://ok.co ahora" }),
      ),
    ).toEqual({ suspicious: false });
  });

  it("does not flag when a url is removed by the edit", () => {
    expect(
      detectEditSpam(
        snap({ hasUrl: true, text: "http://old.co" }),
        snap({ hasUrl: false, text: "borrado" }),
      ),
    ).toEqual({ suspicious: false });
  });
});

describe("detectEditSpam - mention", () => {
  it("flags a mention that appeared after editing", () => {
    expect(
      detectEditSpam(
        snap({ text: "buenas" }),
        snap({ hasMention: true, text: "buenas @todos" }),
      ),
    ).toEqual({ suspicious: true, reason: "added-mention" });
  });

  it("does not flag when the mention was already present", () => {
    expect(
      detectEditSpam(
        snap({ hasMention: true, text: "@ana hola" }),
        snap({ hasMention: true, text: "@ana hola de nuevo" }),
      ),
    ).toEqual({ suspicious: false });
  });

  it("prioritizes url over mention when both appear", () => {
    expect(
      detectEditSpam(
        snap({ text: "limpio" }),
        snap({ hasUrl: true, hasMention: true, text: "@x http://spam.co" }),
      ),
    ).toEqual({ suspicious: true, reason: "added-url" });
  });
});

describe("detectEditSpam - text growth", () => {
  it("flags when text grows by the factor above the min length", () => {
    // 20 -> 60 chars: exactly the growth factor and well above the min length,
    // so the boundary (afterLen >= beforeLen * factor) must count as suspicious.
    const before = snap({ text: filler(20) });
    const after = snap({ text: filler(20 * EDIT_SPAM_GROWTH_FACTOR) });
    expect(detectEditSpam(before, after)).toEqual({
      suspicious: true,
      reason: "text-growth",
    });
  });

  it("does not flag growth below the min length even if it multiplies", () => {
    // 5 -> 20 chars: factor 4 but under the min length threshold.
    expect(
      detectEditSpam(snap({ text: filler(5) }), snap({ text: filler(20) })),
    ).toEqual({ suspicious: false });
  });

  it("does not flag growth that stays under the factor", () => {
    // 30 -> 50 chars: over min length but only ~1.67x.
    expect(
      detectEditSpam(snap({ text: filler(30) }), snap({ text: filler(50) })),
    ).toEqual({ suspicious: false });
  });

  it("flags going from empty text to a long message", () => {
    expect(
      detectEditSpam(
        snap({ text: "" }),
        snap({ text: filler(EDIT_SPAM_MIN_GROWTH_LENGTH) }),
      ),
    ).toEqual({ suspicious: true, reason: "text-growth" });
  });

  it("uses code point length, not UTF-16 units, for growth", () => {
    // Emoji are 2 UTF-16 units each; 10 emoji = 10 code points, under min length.
    const before = snap({ text: "hi" });
    const after = snap({ text: "😀".repeat(10) });
    expect(detectEditSpam(before, after)).toEqual({ suspicious: false });
  });

  it("does not flag identical text", () => {
    const s = snap({ text: filler(100) });
    expect(detectEditSpam(s, s)).toEqual({ suspicious: false });
  });

  it("does not flag shrinking text", () => {
    expect(
      detectEditSpam(snap({ text: filler(90) }), snap({ text: filler(10) })),
    ).toEqual({ suspicious: false });
  });

  it("does not flag empty to empty", () => {
    expect(detectEditSpam(snap({ text: "" }), snap({ text: "" }))).toEqual({
      suspicious: false,
    });
  });
});

describe("detectEditSpam - determinism and edges", () => {
  it("returns the same verdict for identical inputs", () => {
    const before = snap({ text: "hola" });
    const after = snap({ hasUrl: true, text: "hola http://x.co" });
    expect(detectEditSpam(before, after)).toEqual(
      detectEditSpam(before, after),
    );
  });

  it("does not mutate its inputs", () => {
    const before = snap({ text: "abc" });
    const after = snap({ hasMention: true, text: "abc @z" });
    const beforeCopy = { ...before };
    const afterCopy = { ...after };
    detectEditSpam(before, after);
    expect(before).toEqual(beforeCopy);
    expect(after).toEqual(afterCopy);
  });

  it("is clean when nothing changed relevantly", () => {
    expect(
      detectEditSpam(
        snap({ text: "buenos dias a todos" }),
        snap({ text: "buenas dias a todos!" }),
      ),
    ).toEqual({ suspicious: false });
  });

  it("mention appearing without url still flags as mention", () => {
    expect(
      detectEditSpam(
        snap({ hasUrl: true, text: "http://a.co" }),
        snap({ hasUrl: true, hasMention: true, text: "http://a.co @b" }),
      ),
    ).toEqual({ suspicious: true, reason: "added-mention" });
  });
});
