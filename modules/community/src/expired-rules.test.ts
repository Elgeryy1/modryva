import { describe, expect, it } from "vitest";
import { detectExpiredRules } from "./expired-rules.js";

describe("detectExpiredRules", () => {
  it("splits rules into expired and active by nowMs", () => {
    const rules = [
      { text: "Sorteo de verano", expiresMs: 100 },
      { text: "Normas permanentes", expiresMs: 500 },
    ];
    expect(detectExpiredRules(rules, 150)).toEqual({
      expired: ["Sorteo de verano"],
      active: ["Normas permanentes"],
    });
  });

  it("treats the exact boundary instant as expired", () => {
    const rules = [{ text: "Evento del dia", expiresMs: 200 }];
    expect(detectExpiredRules(rules, 200)).toEqual({
      expired: ["Evento del dia"],
      active: [],
    });
  });

  it("keeps a rule active one millisecond before expiry", () => {
    const rules = [{ text: "Promo relampago", expiresMs: 200 }];
    expect(detectExpiredRules(rules, 199)).toEqual({
      expired: [],
      active: ["Promo relampago"],
    });
  });

  it("returns empty lists for no rules", () => {
    expect(detectExpiredRules([], 1000)).toEqual({ expired: [], active: [] });
  });

  it("classifies every rule as expired when nowMs is large", () => {
    const rules = [
      { text: "A", expiresMs: 1 },
      { text: "B", expiresMs: 2 },
      { text: "C", expiresMs: 3 },
    ];
    expect(detectExpiredRules(rules, 9999)).toEqual({
      expired: ["A", "B", "C"],
      active: [],
    });
  });

  it("classifies every rule as active when nowMs is zero", () => {
    const rules = [
      { text: "A", expiresMs: 1 },
      { text: "B", expiresMs: 2 },
    ];
    expect(detectExpiredRules(rules, 0)).toEqual({
      expired: [],
      active: ["A", "B"],
    });
  });

  it("preserves input order within each group", () => {
    const rules = [
      { text: "r1", expiresMs: 10 },
      { text: "r2", expiresMs: 100 },
      { text: "r3", expiresMs: 20 },
      { text: "r4", expiresMs: 100 },
      { text: "r5", expiresMs: 5 },
    ];
    expect(detectExpiredRules(rules, 50)).toEqual({
      expired: ["r1", "r3", "r5"],
      active: ["r2", "r4"],
    });
  });

  it("keeps duplicate rule texts as separate entries", () => {
    const rules = [
      { text: "dup", expiresMs: 10 },
      { text: "dup", expiresMs: 900 },
      { text: "dup", expiresMs: 5 },
    ];
    expect(detectExpiredRules(rules, 100)).toEqual({
      expired: ["dup", "dup"],
      active: ["dup"],
    });
  });

  it("treats non-finite expiry as never expiring", () => {
    const rules = [
      { text: "sin fin", expiresMs: Number.POSITIVE_INFINITY },
      { text: "roto", expiresMs: Number.NaN },
      { text: "caducado", expiresMs: 10 },
    ];
    expect(detectExpiredRules(rules, 100)).toEqual({
      expired: ["caducado"],
      active: ["sin fin", "roto"],
    });
  });

  it("is deterministic across repeated calls", () => {
    const rules = [
      { text: "x", expiresMs: 50 },
      { text: "y", expiresMs: 150 },
    ];
    const first = detectExpiredRules(rules, 100);
    const second = detectExpiredRules(rules, 100);
    expect(first).toEqual(second);
  });
});
