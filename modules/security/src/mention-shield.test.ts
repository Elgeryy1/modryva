import { describe, expect, it } from "vitest";
import { shieldFromMentions } from "./mention-shield.js";

describe("shieldFromMentions", () => {
  it("limits when mentions exceed the default maximum", () => {
    expect(shieldFromMentions({ mentionsInWindow: 6 })).toEqual({
      limited: true,
      excess: 1,
    });
  });

  it("does not limit exactly at the default boundary", () => {
    expect(shieldFromMentions({ mentionsInWindow: 5 })).toEqual({
      limited: false,
      excess: 0,
    });
  });

  it("does not limit below the default maximum", () => {
    expect(shieldFromMentions({ mentionsInWindow: 0 })).toEqual({
      limited: false,
      excess: 0,
    });
  });

  it("honors a custom maxMentions", () => {
    expect(
      shieldFromMentions({ mentionsInWindow: 10 }, { maxMentions: 3 }),
    ).toEqual({ limited: true, excess: 7 });
  });

  it("treats the custom boundary as not limited", () => {
    expect(
      shieldFromMentions({ mentionsInWindow: 3 }, { maxMentions: 3 }),
    ).toEqual({ limited: false, excess: 0 });
  });

  it("clamps negative mention counts to zero", () => {
    expect(shieldFromMentions({ mentionsInWindow: -5 })).toEqual({
      limited: false,
      excess: 0,
    });
  });

  it("floors fractional mention counts", () => {
    expect(shieldFromMentions({ mentionsInWindow: 7.9 })).toEqual({
      limited: true,
      excess: 2,
    });
  });

  it("supports a zero maximum that shields any mention", () => {
    expect(
      shieldFromMentions({ mentionsInWindow: 1 }, { maxMentions: 0 }),
    ).toEqual({ limited: true, excess: 1 });
  });

  it("clamps a negative maximum to zero", () => {
    expect(
      shieldFromMentions({ mentionsInWindow: 2 }, { maxMentions: -4 }),
    ).toEqual({ limited: true, excess: 2 });
  });

  it("ignores non-finite mention counts", () => {
    expect(
      shieldFromMentions({ mentionsInWindow: Number.POSITIVE_INFINITY }),
    ).toEqual({ limited: false, excess: 0 });
  });

  it("is deterministic across repeated calls", () => {
    const first = shieldFromMentions(
      { mentionsInWindow: 8 },
      { maxMentions: 4 },
    );
    const second = shieldFromMentions(
      { mentionsInWindow: 8 },
      { maxMentions: 4 },
    );
    expect(first).toEqual(second);
    expect(first).toEqual({ limited: true, excess: 4 });
  });
});
