import { describe, expect, it } from "vitest";
import {
  type CaseSignalCtx,
  CONFIDENCE_BASE_PCT,
  CONFIDENCE_CONFIRM_BONUS_PCT,
  CONFIDENCE_MAX_PCT,
  CONFIDENCE_MIN_PCT,
  CONFIDENCE_REVERT_PENALTY_PCT,
  computeActionConfidencePct,
  escalateActionIndex,
  suggestModerationAction,
} from "./action-confidence.js";

const ctx = (overrides: Partial<CaseSignalCtx> = {}): CaseSignalCtx => ({
  activeWarnings: 0,
  severity: "leve",
  historyReverts: 0,
  historyConfirms: 0,
  ...overrides,
});

describe("escalateActionIndex", () => {
  it("starts at aviso (0) for a leve case with no warnings", () => {
    expect(escalateActionIndex(ctx())).toBe(0);
  });

  it("uses severity as the floor", () => {
    expect(escalateActionIndex(ctx({ severity: "media" }))).toBe(1);
    expect(escalateActionIndex(ctx({ severity: "grave" }))).toBe(2);
  });

  it("adds one step every two active warnings", () => {
    expect(escalateActionIndex(ctx({ activeWarnings: 1 }))).toBe(0);
    expect(escalateActionIndex(ctx({ activeWarnings: 2 }))).toBe(1);
    expect(escalateActionIndex(ctx({ activeWarnings: 4 }))).toBe(2);
  });

  it("saturates at the hardest step (ban)", () => {
    expect(
      escalateActionIndex(ctx({ severity: "grave", activeWarnings: 10 })),
    ).toBe(2);
  });

  it("treats negative or fractional warnings as zero effective warnings", () => {
    expect(escalateActionIndex(ctx({ activeWarnings: -5 }))).toBe(0);
    expect(escalateActionIndex(ctx({ activeWarnings: 1.9 }))).toBe(0);
  });
});

describe("computeActionConfidencePct", () => {
  it("returns the base confidence with no history", () => {
    expect(computeActionConfidencePct(ctx())).toBe(CONFIDENCE_BASE_PCT);
  });

  it("drops confidence for each historic revert", () => {
    expect(computeActionConfidencePct(ctx({ historyReverts: 1 }))).toBe(
      CONFIDENCE_BASE_PCT - CONFIDENCE_REVERT_PENALTY_PCT,
    );
    expect(computeActionConfidencePct(ctx({ historyReverts: 2 }))).toBe(
      CONFIDENCE_BASE_PCT - 2 * CONFIDENCE_REVERT_PENALTY_PCT,
    );
  });

  it("raises confidence for each historic confirm", () => {
    expect(computeActionConfidencePct(ctx({ historyConfirms: 1 }))).toBe(
      CONFIDENCE_BASE_PCT + CONFIDENCE_CONFIRM_BONUS_PCT,
    );
  });

  it("clamps confidence to the minimum with many reverts", () => {
    expect(computeActionConfidencePct(ctx({ historyReverts: 100 }))).toBe(
      CONFIDENCE_MIN_PCT,
    );
  });

  it("clamps confidence to the maximum with many confirms", () => {
    expect(computeActionConfidencePct(ctx({ historyConfirms: 100 }))).toBe(
      CONFIDENCE_MAX_PCT,
    );
  });

  it("ignores negative counts (treated as zero)", () => {
    expect(
      computeActionConfidencePct(
        ctx({ historyReverts: -3, historyConfirms: -3 }),
      ),
    ).toBe(CONFIDENCE_BASE_PCT);
  });

  it("is deterministic for identical inputs", () => {
    const c = ctx({ historyReverts: 2, historyConfirms: 1 });
    expect(computeActionConfidencePct(c)).toBe(computeActionConfidencePct(c));
  });
});

describe("suggestModerationAction", () => {
  it("suggests aviso for a leve case, with softer saturated and harder mute", () => {
    const s = suggestModerationAction(ctx());
    expect(s.action).toBe("aviso");
    expect(s.softer).toBe("aviso");
    expect(s.harder).toBe("mute");
    expect(s.confidencePct).toBe(CONFIDENCE_BASE_PCT);
  });

  it("suggests mute for a media case with the two neighbours", () => {
    const s = suggestModerationAction(ctx({ severity: "media" }));
    expect(s.action).toBe("mute");
    expect(s.softer).toBe("aviso");
    expect(s.harder).toBe("ban");
  });

  it("suggests ban for a grave case, with harder saturated at ban", () => {
    const s = suggestModerationAction(ctx({ severity: "grave" }));
    expect(s.action).toBe("ban");
    expect(s.softer).toBe("mute");
    expect(s.harder).toBe("ban");
  });

  it("escalates the action as warnings accumulate", () => {
    expect(suggestModerationAction(ctx({ activeWarnings: 2 })).action).toBe(
      "mute",
    );
    expect(suggestModerationAction(ctx({ activeWarnings: 4 })).action).toBe(
      "ban",
    );
  });

  it("lowers confidence when there are many reverts", () => {
    const clean = suggestModerationAction(ctx());
    const shaky = suggestModerationAction(ctx({ historyReverts: 3 }));
    expect(shaky.confidencePct).toBeLessThan(clean.confidencePct);
  });

  it("mentions the reverts in the rationale when present", () => {
    const s = suggestModerationAction(
      ctx({ severity: "media", historyReverts: 2 }),
    );
    expect(s.rationale).toContain("2 revert(s)");
    expect(s.rationale).toContain("media");
  });

  it("omits the revert clause in the rationale when there are none", () => {
    const s = suggestModerationAction(ctx());
    expect(s.rationale).not.toContain("revert");
    expect(s.rationale).toContain("0 aviso(s)");
  });

  it("is fully deterministic for identical inputs", () => {
    const c = ctx({ severity: "grave", activeWarnings: 3, historyReverts: 1 });
    expect(suggestModerationAction(c)).toEqual(suggestModerationAction(c));
  });
});
