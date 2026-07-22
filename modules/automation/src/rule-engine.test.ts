import { describe, expect, it } from "vitest";
import {
  type EcaRule,
  evaluateRule,
  evaluateRules,
  type RuleCondition,
  type RuleContext,
} from "./rule-engine.js";

const rule = (overrides: Partial<EcaRule> = {}): EcaRule => ({
  id: "r1",
  event: "message",
  conditions: [],
  action: "warn",
  ...overrides,
});

const ctx = (overrides: Partial<RuleContext> = {}): RuleContext => ({
  event: "message",
  fields: {},
  nowMs: 10_000,
  ...overrides,
});

const cond = (
  field: string,
  op: RuleCondition["op"],
  value: string | number,
): RuleCondition => ({ field, op, value });

describe("evaluateRule event matching", () => {
  it("does not fire when the event does not match", () => {
    expect(
      evaluateRule(rule({ event: "join" }), ctx({ event: "message" })),
    ).toEqual({
      fires: false,
      reason: "event-mismatch",
    });
  });

  it("fires a rule with no conditions when the event matches", () => {
    expect(evaluateRule(rule(), ctx())).toEqual({
      fires: true,
      reason: "fires",
    });
  });
});

describe("evaluateRule conditions", () => {
  it("fires when every condition passes", () => {
    const r = rule({
      conditions: [cond("count", "gt", 3), cond("text", "contains", "spam")],
    });
    const result = evaluateRule(
      r,
      ctx({ fields: { count: 5, text: "this is spam here" } }),
    );
    expect(result).toEqual({ fires: true, reason: "fires" });
  });

  it("does not fire when a single condition fails", () => {
    const r = rule({
      conditions: [cond("count", "gt", 3), cond("kind", "eq", "x")],
    });
    expect(evaluateRule(r, ctx({ fields: { count: 5, kind: "y" } }))).toEqual({
      fires: false,
      reason: "condition-failed",
    });
  });

  it("reports a missing field distinctly from a failed comparison", () => {
    const r = rule({ conditions: [cond("absent", "eq", "x")] });
    expect(evaluateRule(r, ctx({ fields: {} }))).toEqual({
      fires: false,
      reason: "missing-field",
    });
  });

  it("evaluates eq and neq by strict value", () => {
    const eq = rule({ conditions: [cond("role", "eq", "admin")] });
    const neq = rule({ conditions: [cond("role", "neq", "admin")] });
    expect(evaluateRule(eq, ctx({ fields: { role: "admin" } })).fires).toBe(
      true,
    );
    expect(evaluateRule(eq, ctx({ fields: { role: "user" } })).fires).toBe(
      false,
    );
    expect(evaluateRule(neq, ctx({ fields: { role: "user" } })).fires).toBe(
      true,
    );
    expect(evaluateRule(neq, ctx({ fields: { role: "admin" } })).fires).toBe(
      false,
    );
  });

  it("evaluates gt and lt numerically, even for numeric strings", () => {
    const gt = rule({ conditions: [cond("n", "gt", 10)] });
    const lt = rule({ conditions: [cond("n", "lt", 10)] });
    expect(evaluateRule(gt, ctx({ fields: { n: 11 } })).fires).toBe(true);
    expect(evaluateRule(gt, ctx({ fields: { n: "11" } })).fires).toBe(true);
    expect(evaluateRule(gt, ctx({ fields: { n: 10 } })).fires).toBe(false);
    expect(evaluateRule(lt, ctx({ fields: { n: 9 } })).fires).toBe(true);
    expect(evaluateRule(lt, ctx({ fields: { n: 10 } })).fires).toBe(false);
  });

  it("evaluates contains as substring on the stringified field", () => {
    const r = rule({ conditions: [cond("text", "contains", "23")] });
    expect(evaluateRule(r, ctx({ fields: { text: 12345 } })).fires).toBe(true);
    expect(evaluateRule(r, ctx({ fields: { text: "abc" } })).fires).toBe(false);
  });
});

describe("evaluateRule expiration", () => {
  it("does not fire at or after expiresAtMs", () => {
    const r = rule({ expiresAtMs: 10_000 });
    expect(evaluateRule(r, ctx({ nowMs: 10_000 })).reason).toBe("expired");
    expect(evaluateRule(r, ctx({ nowMs: 10_001 })).reason).toBe("expired");
  });

  it("fires before expiresAtMs", () => {
    const r = rule({ expiresAtMs: 10_000 });
    expect(evaluateRule(r, ctx({ nowMs: 9_999 })).fires).toBe(true);
  });
});

describe("evaluateRule cooldown", () => {
  it("does not fire while inside the cooldown window", () => {
    const r = rule({ cooldownMs: 5_000 });
    expect(evaluateRule(r, ctx({ nowMs: 10_000, lastFiredMs: 7_000 }))).toEqual(
      { fires: false, reason: "cooldown" },
    );
  });

  it("fires once the cooldown has elapsed", () => {
    const r = rule({ cooldownMs: 5_000 });
    expect(
      evaluateRule(r, ctx({ nowMs: 12_000, lastFiredMs: 7_000 })).fires,
    ).toBe(true);
  });

  it("ignores cooldown when there is no lastFiredMs", () => {
    const r = rule({ cooldownMs: 5_000 });
    expect(evaluateRule(r, ctx({ nowMs: 10_000 })).fires).toBe(true);
  });

  it("checks expiration before cooldown", () => {
    const r = rule({ cooldownMs: 5_000, expiresAtMs: 8_000 });
    expect(
      evaluateRule(r, ctx({ nowMs: 9_000, lastFiredMs: 8_900 })).reason,
    ).toBe("expired");
  });
});

describe("evaluateRule determinism", () => {
  it("returns identical results for identical inputs", () => {
    const r = rule({ conditions: [cond("n", "gt", 1)], cooldownMs: 100 });
    const c = ctx({ fields: { n: 5 }, nowMs: 500, lastFiredMs: 100 });
    expect(evaluateRule(r, c)).toEqual(evaluateRule(r, c));
  });
});

describe("evaluateRules", () => {
  it("returns only the firing rules preserving input order", () => {
    const rules = [
      rule({ id: "a", event: "message", conditions: [cond("n", "gt", 10)] }),
      rule({ id: "b", event: "join" }),
      rule({ id: "c", event: "message", conditions: [cond("n", "lt", 10)] }),
      rule({ id: "d", event: "message" }),
    ];
    const result = evaluateRules(
      rules,
      ctx({ event: "message", fields: { n: 5 } }),
    );
    expect(result.fired.map((r) => r.id)).toEqual(["c", "d"]);
  });

  it("returns an empty list when nothing fires", () => {
    const rules = [rule({ event: "join" }), rule({ event: "leave" })];
    expect(evaluateRules(rules, ctx({ event: "message" }))).toEqual({
      fired: [],
    });
  });

  it("returns an empty list for no rules", () => {
    expect(evaluateRules([], ctx())).toEqual({ fired: [] });
  });

  it("respects per-rule cooldown within a batch", () => {
    const rules = [
      rule({ id: "cool", cooldownMs: 5_000 }),
      rule({ id: "ready" }),
    ];
    const result = evaluateRules(
      rules,
      ctx({ nowMs: 10_000, lastFiredMs: 8_000 }),
    );
    expect(result.fired.map((r) => r.id)).toEqual(["ready"]);
  });
});
