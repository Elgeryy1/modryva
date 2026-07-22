import { describe, expect, it } from "vitest";
import {
  type Contribution,
  contributionValue,
  HOF_MESSAGE_WEIGHT,
  HOF_THANKS_WEIGHT,
  HOF_UPVOTE_WEIGHT,
  topContributions,
} from "./hall-of-fame.js";

const contrib = (overrides: Partial<Contribution> = {}): Contribution => ({
  userId: "u1",
  upvotes: 0,
  thanks: 0,
  messages: 0,
  ...overrides,
});

describe("weights", () => {
  it("orders upvotes and thanks above messages", () => {
    expect(HOF_UPVOTE_WEIGHT).toBeGreaterThan(HOF_MESSAGE_WEIGHT);
    expect(HOF_THANKS_WEIGHT).toBeGreaterThan(HOF_MESSAGE_WEIGHT);
    expect(HOF_UPVOTE_WEIGHT).toBe(5);
    expect(HOF_THANKS_WEIGHT).toBe(3);
    expect(HOF_MESSAGE_WEIGHT).toBe(1);
  });
});

describe("contributionValue", () => {
  it("is zero for an empty contribution", () => {
    expect(contributionValue(contrib())).toBe(0);
  });

  it("weights upvotes at 5 each", () => {
    expect(contributionValue(contrib({ upvotes: 2 }))).toBe(10);
  });

  it("weights thanks at 3 each", () => {
    expect(contributionValue(contrib({ thanks: 2 }))).toBe(6);
  });

  it("weights messages at 1 each", () => {
    expect(contributionValue(contrib({ messages: 10 }))).toBe(10);
  });

  it("sums the three weighted counters", () => {
    expect(
      contributionValue(contrib({ upvotes: 1, thanks: 1, messages: 1 })),
    ).toBe(9);
  });

  it("values a single upvote above several messages", () => {
    const oneUpvote = contributionValue(contrib({ upvotes: 1 }));
    const fourMessages = contributionValue(contrib({ messages: 4 }));
    expect(oneUpvote).toBe(5);
    expect(fourMessages).toBe(4);
    expect(oneUpvote).toBeGreaterThan(fourMessages);
  });

  it("clamps negative counters to zero", () => {
    expect(contributionValue(contrib({ upvotes: -5 }))).toBe(0);
    expect(
      contributionValue(contrib({ upvotes: 2, thanks: -3, messages: 1 })),
    ).toBe(11);
  });

  it("is deterministic for identical inputs", () => {
    const c = contrib({ upvotes: 3, thanks: 4, messages: 7 });
    expect(contributionValue(c)).toBe(contributionValue(c));
  });
});

describe("topContributions", () => {
  it("returns an empty array for topN <= 0", () => {
    const contribs = [contrib({ userId: "a", upvotes: 3 })];
    expect(topContributions(contribs, 0)).toEqual([]);
    expect(topContributions(contribs, -1)).toEqual([]);
  });

  it("returns an empty array for no contributions", () => {
    expect(topContributions([], 5)).toEqual([]);
  });

  it("ranks by value descending", () => {
    const contribs = [
      contrib({ userId: "low", messages: 2 }),
      contrib({ userId: "high", upvotes: 4 }),
      contrib({ userId: "mid", thanks: 3 }),
    ];
    expect(topContributions(contribs, 3)).toEqual([
      { userId: "high", value: 20 },
      { userId: "mid", value: 9 },
      { userId: "low", value: 2 },
    ]);
  });

  it("limits the result to topN entries", () => {
    const contribs = [
      contrib({ userId: "a", upvotes: 1 }),
      contrib({ userId: "b", upvotes: 2 }),
      contrib({ userId: "c", upvotes: 3 }),
    ];
    expect(topContributions(contribs, 2)).toEqual([
      { userId: "c", value: 15 },
      { userId: "b", value: 10 },
    ]);
  });

  it("returns all entries when topN exceeds the count", () => {
    const contribs = [
      contrib({ userId: "a", upvotes: 1 }),
      contrib({ userId: "b", upvotes: 2 }),
    ];
    expect(topContributions(contribs, 99)).toEqual([
      { userId: "b", value: 10 },
      { userId: "a", value: 5 },
    ]);
  });

  it("breaks ties by userId ascending", () => {
    const contribs = [
      contrib({ userId: "charlie", upvotes: 2 }),
      contrib({ userId: "alice", upvotes: 2 }),
      contrib({ userId: "bob", upvotes: 2 }),
    ];
    expect(topContributions(contribs, 3)).toEqual([
      { userId: "alice", value: 10 },
      { userId: "bob", value: 10 },
      { userId: "charlie", value: 10 },
    ]);
  });

  it("floors a fractional topN", () => {
    const contribs = [
      contrib({ userId: "a", upvotes: 3 }),
      contrib({ userId: "b", upvotes: 2 }),
      contrib({ userId: "c", upvotes: 1 }),
    ];
    expect(topContributions(contribs, 2.9)).toEqual([
      { userId: "a", value: 15 },
      { userId: "b", value: 10 },
    ]);
  });

  it("does not mutate the input array", () => {
    const contribs = [
      contrib({ userId: "a", upvotes: 1 }),
      contrib({ userId: "b", upvotes: 5 }),
    ];
    const snapshot = [...contribs];
    topContributions(contribs, 2);
    expect(contribs).toEqual(snapshot);
    expect(contribs[0]?.userId).toBe("a");
    expect(contribs[1]?.userId).toBe("b");
  });

  it("is deterministic across repeated calls", () => {
    const contribs = [
      contrib({ userId: "a", upvotes: 2, thanks: 1 }),
      contrib({ userId: "b", messages: 3 }),
      contrib({ userId: "c", thanks: 2 }),
    ];
    expect(topContributions(contribs, 3)).toEqual(
      topContributions(contribs, 3),
    );
  });
});
