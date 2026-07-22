import { describe, expect, it } from "vitest";
import {
  canApplyOwnerAbsentAction,
  rulesForOwnerAbsent,
} from "./owner-absent.js";

describe("rulesForOwnerAbsent", () => {
  it("enables strict mode and consensus when owner is absent", () => {
    const rules = rulesForOwnerAbsent(true);
    expect(rules.strict).toBe(true);
    expect(rules.requireConsensus).toBe(true);
    expect(rules.consensusThreshold).toBe(2);
  });

  it("applies normal rules when owner is present", () => {
    const rules = rulesForOwnerAbsent(false);
    expect(rules.strict).toBe(false);
    expect(rules.requireConsensus).toBe(false);
    expect(rules.consensusThreshold).toBe(1);
  });

  it("uses an accented Spanish note when absent", () => {
    expect(rulesForOwnerAbsent(true).note).toContain("no esta disponible");
    expect(rulesForOwnerAbsent(true).note).toContain("administradores");
  });

  it("uses a distinct Spanish note when present", () => {
    expect(rulesForOwnerAbsent(false).note).toContain("reglas normales");
    expect(rulesForOwnerAbsent(false).note).not.toEqual(
      rulesForOwnerAbsent(true).note,
    );
  });

  it("is deterministic for the same input", () => {
    expect(rulesForOwnerAbsent(true)).toEqual(rulesForOwnerAbsent(true));
    expect(rulesForOwnerAbsent(false)).toEqual(rulesForOwnerAbsent(false));
  });
});

describe("canApplyOwnerAbsentAction", () => {
  it("requires two approvals in owner-absent mode", () => {
    const rules = rulesForOwnerAbsent(true);
    expect(canApplyOwnerAbsentAction(rules, 2)).toBe(true);
    expect(canApplyOwnerAbsentAction(rules, 1)).toBe(false);
  });

  it("allows a single approval in normal mode", () => {
    const rules = rulesForOwnerAbsent(false);
    expect(canApplyOwnerAbsentAction(rules, 1)).toBe(true);
    expect(canApplyOwnerAbsentAction(rules, 0)).toBe(false);
  });

  it("treats negative approvals as zero", () => {
    const rules = rulesForOwnerAbsent(false);
    expect(canApplyOwnerAbsentAction(rules, -5)).toBe(false);
  });

  it("permits actions above the threshold", () => {
    const rules = rulesForOwnerAbsent(true);
    expect(canApplyOwnerAbsentAction(rules, 5)).toBe(true);
  });
});
