import { describe, expect, it } from "vitest";
import {
  type GuardianSettingsForValidation,
  hasBlockingIssues,
  parseGuardianCommand,
  validateGuardianSettings,
} from "./settings.js";

const baseline: GuardianSettingsForValidation = {
  mode: "auto",
  staffChatId: -100123n,
  maxAttempts: 3,
  sessionTtlSeconds: 600,
  mediaRetentionHours: 72,
  autoApproveThreshold: 0.85,
  manualReviewThreshold: 0.55,
  livenessMinimum: 0.6,
  gestureMinimum: 0.6,
  replayRiskMaximum: 0.4,
  syntheticRiskMaximum: 0.4,
  estimateAge: false,
  minimumAge: null,
  maximumAge: null,
  sendApprovedCasesToStaff: true,
};

describe("validateGuardianSettings", () => {
  it("accepts a coherent baseline with no issues", () => {
    expect(validateGuardianSettings(baseline)).toEqual([]);
  });

  it("rejects a maximum age below the minimum age", () => {
    const issues = validateGuardianSettings({
      ...baseline,
      estimateAge: true,
      minimumAge: 18,
      maximumAge: 16,
    });
    expect(hasBlockingIssues(issues)).toBe(true);
    expect(issues.some((i) => i.field === "maximumAge")).toBe(true);
  });

  it("warns (does not block) an out-of-range maximum age", () => {
    const issues = validateGuardianSettings({
      ...baseline,
      estimateAge: true,
      maximumAge: 5,
    });
    expect(hasBlockingIssues(issues)).toBe(false);
    expect(
      issues.some((i) => i.field === "maximumAge" && i.severity === "warning"),
    ).toBe(true);
  });

  it("accepts a coherent age range (min ≤ max)", () => {
    const issues = validateGuardianSettings({
      ...baseline,
      estimateAge: true,
      minimumAge: 13,
      maximumAge: 23,
    });
    expect(hasBlockingIssues(issues)).toBe(false);
  });

  it("rejects an auto-approve threshold at or below the manual-review threshold", () => {
    const issues = validateGuardianSettings({
      ...baseline,
      autoApproveThreshold: 0.5,
      manualReviewThreshold: 0.55,
    });
    expect(hasBlockingIssues(issues)).toBe(true);
  });

  it("warns (but does not necessarily block) a dangerously low auto-approve threshold", () => {
    const issues = validateGuardianSettings({
      ...baseline,
      autoApproveThreshold: 0.3,
      manualReviewThreshold: 0.1,
    });
    expect(issues.some((i) => i.code === "dangerously-low")).toBe(true);
  });

  it("rejects thresholds outside [0,1]", () => {
    const issues = validateGuardianSettings({
      ...baseline,
      livenessMinimum: 1.5,
    });
    expect(hasBlockingIssues(issues)).toBe(true);
  });

  it("requires a staff chat once mode is not off", () => {
    const issues = validateGuardianSettings({
      ...baseline,
      staffChatId: null,
    });
    expect(hasBlockingIssues(issues)).toBe(true);
  });

  it("allows a missing staff chat when Guardian is off", () => {
    const issues = validateGuardianSettings({
      ...baseline,
      mode: "off",
      staffChatId: null,
    });
    expect(hasBlockingIssues(issues)).toBe(false);
  });

  it("rejects disabling sendApprovedCasesToStaff", () => {
    const issues = validateGuardianSettings({
      ...baseline,
      sendApprovedCasesToStaff: false,
    });
    expect(hasBlockingIssues(issues)).toBe(true);
  });

  it("rejects zero or negative max attempts", () => {
    expect(
      hasBlockingIssues(
        validateGuardianSettings({ ...baseline, maxAttempts: 0 }),
      ),
    ).toBe(true);
  });

  it("warns on an excessive attempt count", () => {
    const issues = validateGuardianSettings({ ...baseline, maxAttempts: 20 });
    expect(issues.some((i) => i.code === "too-many")).toBe(true);
    expect(hasBlockingIssues(issues)).toBe(false);
  });
});

describe("parseGuardianCommand", () => {
  const cmd = (name: string, args: string[] = []) =>
    ({
      command: { name, raw: `/${name}`, args },
    }) as never;

  it("parses /guardian_on and /guardian_off", () => {
    expect(parseGuardianCommand(cmd("guardian_on"))).toEqual({
      ok: true,
      command: { kind: "enable", enabled: true },
    });
    expect(parseGuardianCommand(cmd("guardian_off"))).toEqual({
      ok: true,
      command: { kind: "enable", enabled: false },
    });
  });

  it("parses a valid /guardian_mode", () => {
    expect(parseGuardianCommand(cmd("guardian_mode", ["strict"]))).toEqual({
      ok: true,
      command: { kind: "mode", mode: "strict" },
    });
  });

  it("rejects an invalid /guardian_mode argument", () => {
    const result = parseGuardianCommand(cmd("guardian_mode", ["bogus"]));
    expect(result?.ok).toBe(false);
  });

  it("returns null for unrelated commands", () => {
    expect(parseGuardianCommand(cmd("ban"))).toBeNull();
  });
});
