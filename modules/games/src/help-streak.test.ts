import { describe, expect, it } from "vitest";
import { computeHelpStreak, describeHelpStreak } from "./help-streak.js";

describe("computeHelpStreak", () => {
  it("returns zeros for an empty history", () => {
    expect(computeHelpStreak([])).toEqual({ streak: 0, best: 0 });
  });

  it("counts a single helping day", () => {
    expect(computeHelpStreak([{ helped: true }])).toEqual({
      streak: 1,
      best: 1,
    });
  });

  it("counts trailing streak and best run separately", () => {
    expect(
      computeHelpStreak([
        { helped: true },
        { helped: false },
        { helped: true },
        { helped: true },
      ]),
    ).toEqual({ streak: 2, best: 2 });
  });

  it("reports a broken current streak while keeping the best run", () => {
    expect(
      computeHelpStreak([
        { helped: true },
        { helped: true },
        { helped: false },
      ]),
    ).toEqual({ streak: 0, best: 2 });
  });

  it("finds the best run in the middle of the history", () => {
    expect(
      computeHelpStreak([
        { helped: true },
        { helped: true },
        { helped: true },
        { helped: false },
        { helped: true },
      ]),
    ).toEqual({ streak: 1, best: 3 });
  });

  it("ignores spam days so they break the streak", () => {
    expect(
      computeHelpStreak([
        { helped: true },
        { helped: true, spam: true },
        { helped: true },
      ]),
    ).toEqual({ streak: 1, best: 1 });
  });

  it("treats explicit spam:false as a normal helping day", () => {
    expect(
      computeHelpStreak([
        { helped: true, spam: false },
        { helped: true, spam: false },
      ]),
    ).toEqual({ streak: 2, best: 2 });
  });

  it("returns zeros when nobody helped", () => {
    expect(computeHelpStreak([{ helped: false }, { helped: false }])).toEqual({
      streak: 0,
      best: 0,
    });
  });

  it("is deterministic across repeated calls on the same input", () => {
    const history = [
      { helped: true },
      { helped: true },
      { helped: false },
      { helped: true },
    ] as const;
    const first = computeHelpStreak(history);
    const second = computeHelpStreak(history);
    expect(first).toEqual(second);
    expect(first).toEqual({ streak: 1, best: 2 });
  });
});

describe("describeHelpStreak", () => {
  it("encourages a member with no active streak", () => {
    expect(describeHelpStreak({ streak: 0, best: 0 })).toBe(
      "Aún no tienes una racha de ayuda activa. ¡Empieza hoy! 💪",
    );
  });

  it("announces a record when the current streak ties the best", () => {
    expect(describeHelpStreak({ streak: 2, best: 2 })).toBe(
      "🔥 ¡Racha récord de 2 días ayudando! Sigue así.",
    );
  });

  it("reports progress with singular day wording below the best", () => {
    expect(describeHelpStreak({ streak: 1, best: 3 })).toBe(
      "✅ Llevas 1 día seguidos ayudando. Tu mejor marca es 3.",
    );
  });
});
