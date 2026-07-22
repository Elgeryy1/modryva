import { describe, expect, it } from "vitest";
import { detectDeadRules, formatDeadRulesNotice } from "./dead-rules.js";

describe("detectDeadRules", () => {
  it("flags rules with zero and negative counts in input order", () => {
    expect(
      detectDeadRules([
        { name: "antispam", triggerCount: 5 },
        { name: "antilink", triggerCount: 0 },
        { name: "antiflood", triggerCount: -2 },
      ]),
    ).toEqual(["antilink", "antiflood"]);
  });

  it("excludes every active rule", () => {
    expect(
      detectDeadRules([
        { name: "a", triggerCount: 1 },
        { name: "b", triggerCount: 99 },
      ]),
    ).toEqual([]);
  });

  it("returns all names when every rule is dead", () => {
    expect(
      detectDeadRules([
        { name: "x", triggerCount: 0 },
        { name: "y", triggerCount: 0 },
      ]),
    ).toEqual(["x", "y"]);
  });

  it("returns empty for empty input", () => {
    expect(detectDeadRules([])).toEqual([]);
  });

  it("treats exactly 1 as alive and exactly 0 as dead at the boundary", () => {
    expect(
      detectDeadRules([
        { name: "alive", triggerCount: 1 },
        { name: "dead", triggerCount: 0 },
      ]),
    ).toEqual(["dead"]);
  });

  it("keeps duplicate names when they repeat", () => {
    expect(
      detectDeadRules([
        { name: "dup", triggerCount: 0 },
        { name: "dup", triggerCount: 0 },
      ]),
    ).toEqual(["dup", "dup"]);
  });

  it("preserves original order when dead rules are interleaved with active ones", () => {
    expect(
      detectDeadRules([
        { name: "first", triggerCount: 0 },
        { name: "mid", triggerCount: 3 },
        { name: "last", triggerCount: 0 },
      ]),
    ).toEqual(["first", "last"]);
  });

  it("is deterministic across repeated calls with the same input", () => {
    const input = [
      { name: "r1", triggerCount: 0 },
      { name: "r2", triggerCount: 4 },
      { name: "r3", triggerCount: -1 },
    ] as const;
    expect(detectDeadRules(input)).toEqual(detectDeadRules(input));
  });
});

describe("formatDeadRulesNotice", () => {
  it("reports the reassuring message when there are no dead rules", () => {
    expect(formatDeadRulesNotice([])).toBe(
      "✅ Todas las reglas se han activado al menos una vez.",
    );
  });

  it("uses singular wording for exactly one dead rule", () => {
    expect(formatDeadRulesNotice(["antilink"])).toBe(
      "⚠️ Aviso: 1 regla muerta que solo hacen ruido: antilink.",
    );
  });

  it("uses plural wording and joins several dead rules", () => {
    expect(formatDeadRulesNotice(["antilink", "antiflood"])).toBe(
      "⚠️ Aviso: 2 reglas muertas que solo hacen ruido: antilink, antiflood.",
    );
  });
});
