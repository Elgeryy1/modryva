import { describe, expect, it } from "vitest";
import {
  AGGRESSIVE_RULE_THRESHOLD_PCT,
  detectAggressiveRule,
  detectDeadRule,
  matchesRuleCondition,
  ruleFiresOnEvent,
  type SampleEvent,
  type SimulatableRule,
  simulateRule,
} from "./rule-simulation.js";

const ev = (overrides: Partial<SampleEvent> = {}): SampleEvent => ({
  event: "message",
  fields: {},
  ms: 1_000,
  ...overrides,
});

describe("matchesRuleCondition", () => {
  it("matches eq comparing as strings across number and text", () => {
    const event = ev({ fields: { warns: 3 } });
    expect(
      matchesRuleCondition(event, { field: "warns", op: "eq", value: "3" }),
    ).toBe(true);
    expect(
      matchesRuleCondition(event, { field: "warns", op: "eq", value: 3 }),
    ).toBe(true);
  });

  it("matches ne when values differ", () => {
    const event = ev({ fields: { role: "admin" } });
    expect(
      matchesRuleCondition(event, { field: "role", op: "ne", value: "member" }),
    ).toBe(true);
    expect(
      matchesRuleCondition(event, { field: "role", op: "ne", value: "admin" }),
    ).toBe(false);
  });

  it("matches contains as substring", () => {
    const event = ev({ fields: { text: "compra criptomonedas ya" } });
    expect(
      matchesRuleCondition(event, {
        field: "text",
        op: "contains",
        value: "cripto",
      }),
    ).toBe(true);
    expect(
      matchesRuleCondition(event, {
        field: "text",
        op: "contains",
        value: "nft",
      }),
    ).toBe(false);
  });

  it("evaluates numeric order operators", () => {
    const event = ev({ fields: { warns: 5 } });
    expect(
      matchesRuleCondition(event, { field: "warns", op: "gt", value: 3 }),
    ).toBe(true);
    expect(
      matchesRuleCondition(event, { field: "warns", op: "gte", value: 5 }),
    ).toBe(true);
    expect(
      matchesRuleCondition(event, { field: "warns", op: "lt", value: 5 }),
    ).toBe(false);
    expect(
      matchesRuleCondition(event, { field: "warns", op: "lte", value: 5 }),
    ).toBe(true);
  });

  it("fails order operators when a side is not numeric", () => {
    const event = ev({ fields: { warns: "muchos" } });
    expect(
      matchesRuleCondition(event, { field: "warns", op: "gt", value: 3 }),
    ).toBe(false);
  });

  it("never matches an unknown operator", () => {
    const event = ev({ fields: { warns: 5 } });
    expect(
      matchesRuleCondition(event, {
        field: "warns",
        op: "approx",
        value: 5,
      }),
    ).toBe(false);
  });

  it("never matches an absent field", () => {
    const event = ev({ fields: { warns: 5 } });
    expect(
      matchesRuleCondition(event, { field: "score", op: "eq", value: 5 }),
    ).toBe(false);
  });
});

describe("ruleFiresOnEvent", () => {
  it("requires the event type to match", () => {
    const rule: SimulatableRule = { event: "join", conditions: [] };
    expect(ruleFiresOnEvent(rule, ev({ event: "message" }))).toBe(false);
    expect(ruleFiresOnEvent(rule, ev({ event: "join" }))).toBe(true);
  });

  it("fires on any event of its type when it has no conditions", () => {
    const rule: SimulatableRule = { event: "message", conditions: [] };
    expect(ruleFiresOnEvent(rule, ev({ fields: { anything: "x" } }))).toBe(
      true,
    );
  });

  it("requires all conditions (AND)", () => {
    const rule: SimulatableRule = {
      event: "message",
      conditions: [
        { field: "warns", op: "gte", value: 3 },
        { field: "role", op: "eq", value: "member" },
      ],
    };
    expect(
      ruleFiresOnEvent(rule, ev({ fields: { warns: 3, role: "member" } })),
    ).toBe(true);
    expect(
      ruleFiresOnEvent(rule, ev({ fields: { warns: 3, role: "admin" } })),
    ).toBe(false);
  });
});

describe("simulateRule", () => {
  const rule: SimulatableRule = {
    event: "message",
    conditions: [{ field: "warns", op: "gte", value: 3 }],
  };

  it("counts firings and reports matched timestamps in sample order", () => {
    const samples: readonly SampleEvent[] = [
      ev({ fields: { warns: 4 }, ms: 100 }),
      ev({ fields: { warns: 1 }, ms: 200 }),
      ev({ fields: { warns: 3 }, ms: 300 }),
      ev({ event: "join", fields: { warns: 9 }, ms: 400 }),
    ];
    const result = simulateRule(rule, samples);
    expect(result.wouldFire).toBe(2);
    expect(result.total).toBe(4);
    expect(result.impactPct).toBe(50);
    expect(result.matchedMs).toEqual([100, 300]);
  });

  it("returns zeroed impact and no matches for an empty sample", () => {
    expect(simulateRule(rule, [])).toEqual({
      wouldFire: 0,
      total: 0,
      impactPct: 0,
      matchedMs: [],
    });
  });

  it("rounds the impact percentage to one decimal", () => {
    const samples: readonly SampleEvent[] = [
      ev({ fields: { warns: 5 } }),
      ev({ fields: { warns: 0 } }),
      ev({ fields: { warns: 0 } }),
    ];
    expect(simulateRule(rule, samples).impactPct).toBe(33.3);
  });

  it("is deterministic and does not mutate the input", () => {
    const samples: readonly SampleEvent[] = [
      ev({ fields: { warns: 4 }, ms: 10 }),
      ev({ fields: { warns: 4 }, ms: 20 }),
    ];
    const first = simulateRule(rule, samples);
    const second = simulateRule(rule, samples);
    expect(first).toEqual(second);
    expect(samples).toHaveLength(2);
  });

  it("reports full impact when every event fires", () => {
    const allRule: SimulatableRule = { event: "message", conditions: [] };
    const samples: readonly SampleEvent[] = [ev({ ms: 1 }), ev({ ms: 2 })];
    const result = simulateRule(allRule, samples);
    expect(result.wouldFire).toBe(2);
    expect(result.impactPct).toBe(100);
  });
});

describe("detectDeadRule", () => {
  it("is true when there are events but none fired", () => {
    expect(detectDeadRule(0, 10)).toBe(true);
  });

  it("is false when at least one event fired", () => {
    expect(detectDeadRule(1, 10)).toBe(false);
  });

  it("is false for an empty sample (cannot conclude)", () => {
    expect(detectDeadRule(0, 0)).toBe(false);
  });
});

describe("detectAggressiveRule", () => {
  it("is true above the default threshold", () => {
    expect(detectAggressiveRule(75)).toBe(true);
  });

  it("is false at exactly the default threshold", () => {
    expect(detectAggressiveRule(AGGRESSIVE_RULE_THRESHOLD_PCT)).toBe(false);
  });

  it("is false below the default threshold", () => {
    expect(detectAggressiveRule(10)).toBe(false);
  });

  it("honors a custom threshold", () => {
    expect(detectAggressiveRule(25, 20)).toBe(true);
    expect(detectAggressiveRule(15, 20)).toBe(false);
  });
});
