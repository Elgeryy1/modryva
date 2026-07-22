import { describe, expect, it } from "vitest";
import {
  PLAN_RECOMMENDER_PRICES,
  PLAN_RECOMMENDER_THRESHOLDS,
  recommendPlan,
  type UsageStats,
} from "./plan-recommender.js";

const usage = (overrides: Partial<UsageStats> = {}): UsageStats => ({
  members: 0,
  monthlyActions: 0,
  aiTokens: 0,
  groups: 0,
  ...overrides,
});

describe("recommendPlan free tier", () => {
  it("recommends free for an empty/zero usage", () => {
    const r = recommendPlan(usage());
    expect(r.plan).toBe("free");
    expect(r.reason).toContain("gratis");
  });

  it("stays free right at every free cap", () => {
    const r = recommendPlan(
      usage({
        members: PLAN_RECOMMENDER_THRESHOLDS.free.members,
        monthlyActions: PLAN_RECOMMENDER_THRESHOLDS.free.monthlyActions,
        aiTokens: PLAN_RECOMMENDER_THRESHOLDS.free.aiTokens,
        groups: PLAN_RECOMMENDER_THRESHOLDS.free.groups,
      }),
    );
    expect(r.plan).toBe("free");
  });

  it("reports wouldSave equal to the pro price on free", () => {
    const r = recommendPlan(usage());
    expect(r.wouldSave).toBe(PLAN_RECOMMENDER_PRICES.pro);
  });

  it("tolerates negative values as free", () => {
    const r = recommendPlan(
      usage({ members: -10, monthlyActions: -5, aiTokens: -1, groups: -3 }),
    );
    expect(r.plan).toBe("free");
  });
});

describe("recommendPlan pro tier", () => {
  it("bumps to pro when members exceed the free cap by one", () => {
    const r = recommendPlan(
      usage({ members: PLAN_RECOMMENDER_THRESHOLDS.free.members + 1 }),
    );
    expect(r.plan).toBe("pro");
    expect(r.reason).toContain("miembros");
  });

  it("bumps to pro on monthly actions over the free cap", () => {
    const r = recommendPlan(usage({ monthlyActions: 1_500 }));
    expect(r.plan).toBe("pro");
    expect(r.reason).toContain("acciones");
  });

  it("bumps to pro on ai tokens over the free cap", () => {
    const r = recommendPlan(usage({ aiTokens: 60_000 }));
    expect(r.plan).toBe("pro");
    expect(r.reason).toContain("tokens");
  });

  it("stays pro at the pro caps for a single-community deployment", () => {
    // Exactly at the pro caps must stay pro; only strictly above a pro cap
    // escalates to network. Groups is kept below the multi-group minimum (3)
    // so the separate PLAN_RECOMMENDER_MULTIGROUP rule does not apply here.
    const r = recommendPlan(
      usage({
        members: PLAN_RECOMMENDER_THRESHOLDS.pro.members,
        monthlyActions: PLAN_RECOMMENDER_THRESHOLDS.pro.monthlyActions,
        aiTokens: PLAN_RECOMMENDER_THRESHOLDS.pro.aiTokens,
        groups: 2,
      }),
    );
    expect(r.plan).toBe("pro");
  });

  it("reports wouldSave equal to network minus pro on pro", () => {
    const r = recommendPlan(usage({ members: 1_000 }));
    expect(r.wouldSave).toBe(
      PLAN_RECOMMENDER_PRICES.network - PLAN_RECOMMENDER_PRICES.pro,
    );
  });

  it("prioritizes groups over members for the reason on a tie", () => {
    const r = recommendPlan(usage({ members: 1_000, groups: 3 }));
    expect(r.plan).toBe("pro");
    expect(r.reason).toContain("grupos");
  });
});

describe("recommendPlan network tier", () => {
  it("recommends network when members exceed the pro cap", () => {
    const r = recommendPlan(
      usage({ members: PLAN_RECOMMENDER_THRESHOLDS.pro.members + 1 }),
    );
    expect(r.plan).toBe("network");
    expect(r.reason).toContain("network");
  });

  it("recommends network on huge monthly actions", () => {
    const r = recommendPlan(usage({ monthlyActions: 500_000, groups: 1 }));
    expect(r.plan).toBe("network");
  });

  it("recommends network on huge ai token usage", () => {
    const r = recommendPlan(usage({ aiTokens: 5_000_000, groups: 1 }));
    expect(r.plan).toBe("network");
  });

  it("recommends network when groups exceed the pro cap", () => {
    const r = recommendPlan(
      usage({
        groups: PLAN_RECOMMENDER_THRESHOLDS.pro.groups + 1,
        members: 50,
      }),
    );
    expect(r.plan).toBe("network");
  });

  it("omits wouldSave on the network plan", () => {
    const r = recommendPlan(usage({ members: 10_000 }));
    expect(r.plan).toBe("network");
    expect(r.wouldSave).toBeUndefined();
    expect(Object.hasOwn(r, "wouldSave")).toBe(false);
  });

  it("forces network for multi-group large despite per-dim pro fit", () => {
    const r = recommendPlan(
      usage({ groups: 3, members: 3_000, monthlyActions: 5_000 }),
    );
    expect(r.plan).toBe("network");
    expect(r.reason).toContain("Multiples grupos");
  });

  it("multi-group large also triggers via high activity", () => {
    const r = recommendPlan(
      usage({ groups: 4, members: 500, monthlyActions: 25_000 }),
    );
    expect(r.plan).toBe("network");
  });

  it("does not force network with few groups even if large", () => {
    const r = recommendPlan(usage({ groups: 2, members: 4_000 }));
    expect(r.plan).toBe("pro");
  });
});

describe("recommendPlan determinism", () => {
  it("returns identical results for identical inputs", () => {
    const u = usage({ members: 3_000, monthlyActions: 40_000, groups: 4 });
    expect(recommendPlan(u)).toEqual(recommendPlan(u));
  });

  it("does not mutate the input", () => {
    const u = usage({ members: 6_000, groups: 7 });
    const snapshot = { ...u };
    recommendPlan(u);
    expect(u).toEqual(snapshot);
  });
});
