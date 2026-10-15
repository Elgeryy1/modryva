import { describe, expect, it } from "vitest";
import {
  computeHelperHelpfulness,
  HELPER_ANSWER_WEIGHT,
  HELPER_THANKS_WEIGHT,
  type HelperActivity,
  rankHelpers,
} from "./helper-score.js";

const activity = (overrides: Partial<HelperActivity> = {}): HelperActivity => ({
  userId: "u1",
  answers: 0,
  thanksReceived: 0,
  questionsAsked: 0,
  ...overrides,
});

describe("computeHelperHelpfulness", () => {
  it("sums answers and weighted thanks", () => {
    expect(
      computeHelperHelpfulness(activity({ answers: 2, thanksReceived: 3 })),
    ).toBe(2 * HELPER_ANSWER_WEIGHT + 3 * HELPER_THANKS_WEIGHT);
  });

  it("returns zero for a user with no activity", () => {
    expect(computeHelperHelpfulness(activity())).toBe(0);
  });

  it("weights thanks above answers (quality over quantity)", () => {
    const chatty = computeHelperHelpfulness(activity({ answers: 2 }));
    const helpful = computeHelperHelpfulness(activity({ thanksReceived: 1 }));
    expect(helpful).toBeGreaterThan(chatty);
  });

  it("ignores questionsAsked entirely", () => {
    const withQuestions = computeHelperHelpfulness(
      activity({ answers: 1, questionsAsked: 50 }),
    );
    const without = computeHelperHelpfulness(activity({ answers: 1 }));
    expect(withQuestions).toBe(without);
  });

  it("treats negative answers as zero", () => {
    expect(
      computeHelperHelpfulness(activity({ answers: -5, thanksReceived: 2 })),
    ).toBe(2 * HELPER_THANKS_WEIGHT);
  });

  it("treats negative thanks as zero", () => {
    expect(
      computeHelperHelpfulness(activity({ answers: 4, thanksReceived: -3 })),
    ).toBe(4 * HELPER_ANSWER_WEIGHT);
  });

  it("is deterministic for identical inputs", () => {
    const input = activity({ answers: 3, thanksReceived: 4 });
    expect(computeHelperHelpfulness(input)).toBe(
      computeHelperHelpfulness(input),
    );
  });
});

describe("rankHelpers", () => {
  it("orders helpers by utility descending", () => {
    const result = rankHelpers([
      activity({ userId: "low", answers: 1 }),
      activity({ userId: "high", thanksReceived: 5 }),
      activity({ userId: "mid", answers: 2, thanksReceived: 1 }),
    ]);
    expect(result.map((r) => r.userId)).toEqual(["high", "mid", "low"]);
  });

  it("ranks the useful helper above the chatty one", () => {
    const result = rankHelpers([
      activity({ userId: "chatty", answers: 10 }),
      activity({ userId: "useful", answers: 1, thanksReceived: 8 }),
    ]);
    expect(result[0]?.userId).toBe("useful");
  });

  it("keeps insertion order for ties (stable sort)", () => {
    const result = rankHelpers([
      activity({ userId: "a", answers: 3 }),
      activity({ userId: "b", answers: 3 }),
      activity({ userId: "c", answers: 3 }),
    ]);
    expect(result.map((r) => r.userId)).toEqual(["a", "b", "c"]);
  });

  it("breaks ties from mixed counters by insertion order", () => {
    const result = rankHelpers([
      activity({ userId: "first", thanksReceived: 1 }),
      activity({ userId: "second", answers: 3 }),
    ]);
    expect(result.map((r) => r.userId)).toEqual(["first", "second"]);
    expect(result[0]?.helpfulness).toBe(result[1]?.helpfulness);
  });

  it("includes the computed helpfulness for each entry", () => {
    const result = rankHelpers([
      activity({ userId: "x", answers: 2, thanksReceived: 1 }),
    ]);
    expect(result[0]).toEqual({
      userId: "x",
      helpfulness: 2 * HELPER_ANSWER_WEIGHT + 1 * HELPER_THANKS_WEIGHT,
    });
  });

  it("returns an empty array for empty input", () => {
    expect(rankHelpers([])).toEqual([]);
  });

  it("handles a single helper", () => {
    const result = rankHelpers([
      activity({ userId: "solo", thanksReceived: 2 }),
    ]);
    expect(result).toEqual([
      { userId: "solo", helpfulness: 2 * HELPER_THANKS_WEIGHT },
    ]);
  });

  it("does not mutate the input array", () => {
    const input: readonly HelperActivity[] = [
      activity({ userId: "a", answers: 1 }),
      activity({ userId: "b", thanksReceived: 9 }),
    ];
    const snapshot = input.map((entry) => entry.userId);
    rankHelpers(input);
    expect(input.map((entry) => entry.userId)).toEqual(snapshot);
  });

  it("is deterministic across repeated calls", () => {
    const input: readonly HelperActivity[] = [
      activity({ userId: "a", answers: 2, thanksReceived: 1 }),
      activity({ userId: "b", answers: 1, thanksReceived: 3 }),
      activity({ userId: "c", answers: 5 }),
    ];
    expect(rankHelpers(input)).toEqual(rankHelpers(input));
  });

  it("treats negative counters as zero when ranking", () => {
    const result = rankHelpers([
      activity({ userId: "corrupt", answers: -100, thanksReceived: -100 }),
      activity({ userId: "real", answers: 1 }),
    ]);
    expect(result.map((r) => r.userId)).toEqual(["real", "corrupt"]);
    expect(result[1]?.helpfulness).toBe(0);
  });
});
