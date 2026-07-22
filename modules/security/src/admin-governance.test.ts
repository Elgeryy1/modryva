import { describe, expect, it } from "vitest";
import {
  checkConflictOfInterest,
  evaluateTwoKeyApproval,
  requiresTwoKeys,
  TWO_KEY_ACTIONS,
  TWO_KEY_REQUIRED_APPROVERS,
} from "./admin-governance.js";

describe("checkConflictOfInterest", () => {
  it("blocks an admin who is implicated in the case", () => {
    expect(checkConflictOfInterest("42", ["7", "42", "99"])).toEqual({
      blocked: true,
      reason: "Conflicto de interes: el admin esta implicado en el caso.",
    });
  });

  it("allows an admin who is not implicated", () => {
    expect(checkConflictOfInterest("42", ["7", "99"])).toEqual({
      blocked: false,
      reason: "Sin conflicto de interes.",
    });
  });

  it("allows when the involved list is empty", () => {
    expect(checkConflictOfInterest("42", []).blocked).toBe(false);
  });

  it("blocks when the actor id is empty or whitespace", () => {
    expect(checkConflictOfInterest("", ["7"]).blocked).toBe(true);
    expect(checkConflictOfInterest("   ", ["7"]).blocked).toBe(true);
  });

  it("matches ids after trimming whitespace on both sides", () => {
    expect(checkConflictOfInterest(" 42 ", ["7", " 42 "]).blocked).toBe(true);
  });

  it("is deterministic for identical inputs", () => {
    const involved = ["1", "2", "3"];
    expect(checkConflictOfInterest("2", involved)).toEqual(
      checkConflictOfInterest("2", involved),
    );
  });
});

describe("TWO_KEY_ACTIONS", () => {
  it("lists exactly the four critical actions", () => {
    expect(TWO_KEY_ACTIONS).toEqual([
      "ban-global",
      "monetizacion",
      "expulsion-masiva",
      "borrado-cascada",
    ]);
  });
});

describe("requiresTwoKeys", () => {
  it("returns true for every critical action", () => {
    for (const action of TWO_KEY_ACTIONS) {
      expect(requiresTwoKeys(action)).toBe(true);
    }
  });

  it("returns false for unknown or non-critical actions", () => {
    expect(requiresTwoKeys("warn")).toBe(false);
    expect(requiresTwoKeys("")).toBe(false);
    expect(requiresTwoKeys("BAN-GLOBAL")).toBe(false);
  });
});

describe("evaluateTwoKeyApproval", () => {
  it("auto-approves actions that do not require two keys", () => {
    expect(evaluateTwoKeyApproval("warn", [], "1")).toEqual({
      approved: true,
      reason: "La accion no requiere doble llave.",
    });
  });

  it("approves with two distinct approvers other than the requester", () => {
    expect(evaluateTwoKeyApproval("ban-global", ["7", "9"], "1")).toEqual({
      approved: true,
      reason: "Doble llave satisfecha.",
    });
  });

  it("rejects when there is only one approver", () => {
    const result = evaluateTwoKeyApproval("monetizacion", ["7"], "1");
    expect(result.approved).toBe(false);
    expect(result.reason).toContain("se requieren 2 aprobadores");
  });

  it("does not count the requester as an approver", () => {
    expect(
      evaluateTwoKeyApproval("expulsion-masiva", ["1", "7"], "1").approved,
    ).toBe(false);
  });

  it("deduplicates repeated approvers", () => {
    expect(
      evaluateTwoKeyApproval("borrado-cascada", ["7", "7", "7"], "1").approved,
    ).toBe(false);
  });

  it("approves when duplicates still leave two distinct approvers", () => {
    expect(
      evaluateTwoKeyApproval("ban-global", ["7", "7", "9"], "1").approved,
    ).toBe(true);
  });

  it("ignores empty and whitespace-only approver ids", () => {
    expect(
      evaluateTwoKeyApproval("ban-global", ["7", "  ", "", "9"], "1").approved,
    ).toBe(true);
    expect(
      evaluateTwoKeyApproval("ban-global", ["7", "  ", ""], "1").approved,
    ).toBe(false);
  });

  it("matches requester and approvers after trimming", () => {
    expect(
      evaluateTwoKeyApproval("ban-global", [" 1 ", "7"], "1").approved,
    ).toBe(false);
  });

  it("requires exactly TWO_KEY_REQUIRED_APPROVERS approvers", () => {
    expect(TWO_KEY_REQUIRED_APPROVERS).toBe(2);
    expect(
      evaluateTwoKeyApproval("ban-global", ["7", "8", "9"], "1").approved,
    ).toBe(true);
  });

  it("is deterministic for identical inputs", () => {
    expect(evaluateTwoKeyApproval("ban-global", ["7", "9"], "1")).toEqual(
      evaluateTwoKeyApproval("ban-global", ["7", "9"], "1"),
    );
  });
});
