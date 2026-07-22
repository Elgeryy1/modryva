import { describe, expect, it } from "vitest";
import {
  decideSanctionReview,
  nextReviewAtMs,
  type ReviewableSanction,
  sanctionExpiresAtMs,
} from "./sanction-review.js";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const sanction = (
  overrides: Partial<ReviewableSanction> = {},
): ReviewableSanction => ({
  appliedMs: 1_000,
  reviewAfterMs: 7 * DAY,
  reverted: false,
  ...overrides,
});

describe("sanctionExpiresAtMs", () => {
  it("returns applied + duration when a duration is set", () => {
    expect(
      sanctionExpiresAtMs(sanction({ appliedMs: 1_000, durationMs: 3 * DAY })),
    ).toBe(1_000 + 3 * DAY);
  });

  it("returns null for a permanent sanction (no duration)", () => {
    expect(sanctionExpiresAtMs(sanction())).toBeNull();
  });

  it("returns applied even for a zero duration", () => {
    expect(
      sanctionExpiresAtMs(sanction({ appliedMs: 500, durationMs: 0 })),
    ).toBe(500);
  });
});

describe("nextReviewAtMs", () => {
  it("returns applied + reviewAfter for an active sanction", () => {
    expect(
      nextReviewAtMs(sanction({ appliedMs: 2_000, reviewAfterMs: 5 * DAY })),
    ).toBe(2_000 + 5 * DAY);
  });

  it("returns null once the sanction is reverted", () => {
    expect(nextReviewAtMs(sanction({ reverted: true }))).toBeNull();
  });

  it("is independent of any duration", () => {
    expect(
      nextReviewAtMs(
        sanction({ appliedMs: 0, reviewAfterMs: DAY, durationMs: HOUR }),
      ),
    ).toBe(DAY);
  });
});

describe("decideSanctionReview", () => {
  it("returns none while the review is not yet due", () => {
    const s = sanction({ appliedMs: 0, reviewAfterMs: 7 * DAY });
    const decision = decideSanctionReview(s, 3 * DAY);
    expect(decision.action).toBe("none");
    expect(decision.reason).toBe("Sancion activa; revision no vencida.");
  });

  it("reopens exactly when now equals the review time (boundary)", () => {
    const s = sanction({ appliedMs: 0, reviewAfterMs: 7 * DAY });
    expect(decideSanctionReview(s, 7 * DAY).action).toBe("reopen");
  });

  it("reopens after the review time has passed", () => {
    const s = sanction({ appliedMs: 1_000, reviewAfterMs: DAY });
    const decision = decideSanctionReview(s, 1_000 + DAY + HOUR);
    expect(decision.action).toBe("reopen");
    expect(decision.reason).toBe("Revision automatica pendiente.");
  });

  it("does not reopen one ms before the review time", () => {
    const s = sanction({ appliedMs: 0, reviewAfterMs: DAY });
    expect(decideSanctionReview(s, DAY - 1).action).toBe("none");
  });

  it("expires exactly when now equals the expiry time (boundary)", () => {
    const s = sanction({
      appliedMs: 0,
      durationMs: 3 * DAY,
      reviewAfterMs: DAY,
    });
    const decision = decideSanctionReview(s, 3 * DAY);
    expect(decision.action).toBe("expire");
    expect(decision.reason).toBe("Duracion de la sancion cumplida.");
  });

  it("expires when the duration has elapsed", () => {
    const s = sanction({ appliedMs: 0, durationMs: HOUR, reviewAfterMs: DAY });
    expect(decideSanctionReview(s, 2 * HOUR).action).toBe("expire");
  });

  it("prefers expire over reopen when both are due", () => {
    const s = sanction({ appliedMs: 0, durationMs: DAY, reviewAfterMs: HOUR });
    // now is past both the review (HOUR) and the expiry (DAY)
    expect(decideSanctionReview(s, 2 * DAY).action).toBe("expire");
  });

  it("stays active before the duration elapses even if never reviewable soon", () => {
    const s = sanction({
      appliedMs: 0,
      durationMs: DAY,
      reviewAfterMs: 10 * DAY,
    });
    expect(decideSanctionReview(s, HOUR).action).toBe("none");
  });

  it("returns none for a reverted sanction regardless of timers", () => {
    const s = sanction({
      appliedMs: 0,
      durationMs: HOUR,
      reviewAfterMs: HOUR,
      reverted: true,
    });
    const decision = decideSanctionReview(s, 10 * DAY);
    expect(decision.action).toBe("none");
    expect(decision.reason).toBe("Sancion ya revertida; sin accion.");
  });

  it("reopens a permanent sanction once its review is due", () => {
    const s = sanction({ appliedMs: 0, reviewAfterMs: DAY });
    expect(decideSanctionReview(s, 2 * DAY).action).toBe("reopen");
  });

  it("expires immediately with a zero duration once applied", () => {
    const s = sanction({ appliedMs: 500, durationMs: 0, reviewAfterMs: DAY });
    expect(decideSanctionReview(s, 500).action).toBe("expire");
  });

  it("is deterministic for identical inputs", () => {
    const s = sanction({ appliedMs: 42, durationMs: DAY, reviewAfterMs: HOUR });
    expect(decideSanctionReview(s, 5 * HOUR)).toEqual(
      decideSanctionReview(s, 5 * HOUR),
    );
  });

  it("does not expire before the duration even when negative now is given", () => {
    const s = sanction({ appliedMs: 0, durationMs: DAY, reviewAfterMs: DAY });
    expect(decideSanctionReview(s, -HOUR).action).toBe("none");
  });
});
