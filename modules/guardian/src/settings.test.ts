import type { TelegramUpdateEnvelope } from "@superbot/domain";
import { describe, expect, it } from "vitest";
import {
  esArranqueDeAutoVerificacion,
  formatRetryTtl,
  formatTopicIdReply,
  GUARDIAN_RETRY_START_PREFIX,
  GUARDIAN_RETRY_TTL_SECONDS,
  GUARDIAN_SELF_START,
  type GuardianSettingsForValidation,
  hasBlockingIssues,
  parseGuardianCommand,
  parseGuardianRetryStart,
  resolveStaffReportDeleteAfter,
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

  it("parses /topicid and its /guardian_topic alias to the same command", () => {
    expect(parseGuardianCommand(cmd("topicid"))).toEqual({
      ok: true,
      command: { kind: "topic-id" },
    });
    expect(parseGuardianCommand(cmd("guardian_topic"))).toEqual({
      ok: true,
      command: { kind: "topic-id" },
    });
  });

  it("returns null for unrelated commands", () => {
    expect(parseGuardianCommand(cmd("ban"))).toBeNull();
  });
});

describe("resolveStaffReportDeleteAfter", () => {
  const now = new Date("2026-07-24T12:00:00.000Z");

  it("returns null when keepStaffPhotos is on (photos never deleted)", () => {
    expect(
      resolveStaffReportDeleteAfter(
        { keepStaffPhotos: true, mediaRetentionHours: 72 },
        now,
      ),
    ).toBeNull();
  });

  it("stamps now + mediaRetentionHours when keepStaffPhotos is off", () => {
    const result = resolveStaffReportDeleteAfter(
      { keepStaffPhotos: false, mediaRetentionHours: 72 },
      now,
    );
    expect(result?.getTime()).toBe(now.getTime() + 72 * 60 * 60 * 1000);
  });
});

describe("formatTopicIdReply", () => {
  it("reports both ids when issued inside a forum topic", () => {
    const text = formatTopicIdReply({ chatId: "-1001234567890", topicId: 42 });
    expect(text).toContain("-1001234567890");
    expect(text).toContain("42");
    expect(text).toContain("Topic de staff");
  });

  it("reports only the group id and guidance when there is no topic", () => {
    const text = formatTopicIdReply({
      chatId: "-1001234567890",
      topicId: undefined,
    });
    expect(text).toContain("-1001234567890");
    expect(text).toContain("General");
    expect(text).toContain("/topicid");
  });

  it("keeps Markdown bold and code spans balanced (no parse-breaking markup)", () => {
    for (const topicId of [undefined, 7] as const) {
      const text = formatTopicIdReply({ chatId: "-100999", topicId });
      const asterisks = (text.match(/\*/g) ?? []).length;
      const backticks = (text.match(/`/g) ?? []).length;
      expect(asterisks % 2).toBe(0);
      expect(backticks % 2).toBe(0);
    }
  });
});

describe("esArranqueDeAutoVerificacion", () => {
  it("reconoce el payload publico del auto-rescate", () => {
    expect(esArranqueDeAutoVerificacion(GUARDIAN_SELF_START)).toBe(true);
  });

  it("no se confunde con el de token ni con un /start pelado", () => {
    // El de token lleva a otra rama: sesion concreta repartida por un admin.
    expect(esArranqueDeAutoVerificacion("grdv_abcdefghijklmnop")).toBe(false);
    expect(esArranqueDeAutoVerificacion(undefined)).toBe(false);
    expect(esArranqueDeAutoVerificacion("")).toBe(false);
  });

  it("es exacto, no un prefijo", () => {
    // Si aceptara prefijos, `verificacion_de_otra_cosa` entraria aqui y se
    // comeria un /start que pertenece a otro flujo.
    expect(esArranqueDeAutoVerificacion("verificar")).toBe(false);
    expect(esArranqueDeAutoVerificacion("verif_")).toBe(false);
    expect(esArranqueDeAutoVerificacion(" verif")).toBe(false);
  });
});

describe("parseGuardianRetryStart", () => {
  const token = "aZ_9-".repeat(8); // 40 chars of the base64url alphabet

  it("extracts the session token from a Guardian retry deep link", () => {
    expect(
      parseGuardianRetryStart(`${GUARDIAN_RETRY_START_PREFIX}${token}`),
    ).toBe(token);
  });

  it("ignores payloads that are not Guardian retries", () => {
    expect(parseGuardianRetryStart(undefined)).toBeNull();
    expect(parseGuardianRetryStart("cfg_-1001234567890")).toBeNull();
    expect(parseGuardianRetryStart("custombot")).toBeNull();
  });

  it("rejects anything that is not a plausible session token", () => {
    // Never hand an arbitrary third-party string to the token-hash lookup.
    expect(
      parseGuardianRetryStart(`${GUARDIAN_RETRY_START_PREFIX}`),
    ).toBeNull();
    expect(
      parseGuardianRetryStart(`${GUARDIAN_RETRY_START_PREFIX}short`),
    ).toBeNull();
    expect(
      parseGuardianRetryStart(`${GUARDIAN_RETRY_START_PREFIX}${token}!!`),
    ).toBeNull();
    expect(
      parseGuardianRetryStart(
        `${GUARDIAN_RETRY_START_PREFIX}${"a".repeat(65)}`,
      ),
    ).toBeNull();
  });
});

describe("formatRetryTtl", () => {
  it("reads as minutes below an hour, hours below a day, days above", () => {
    expect(formatRetryTtl(600)).toBe("10 min");
    expect(formatRetryTtl(45 * 60)).toBe("45 min");
    expect(formatRetryTtl(2 * 3600)).toBe("2 h");
    expect(formatRetryTtl(GUARDIAN_RETRY_TTL_SECONDS)).toBe("1 día");
    expect(formatRetryTtl(3 * 86_400)).toBe("3 días");
  });

  it("never reports an expiry of zero for a very short window", () => {
    expect(formatRetryTtl(5)).toBe("1 min");
  });

  it("gives a staff-requested repeat long enough to cross a human relay", () => {
    // bot -> admin -> person -> whenever they next open Telegram. The 10-minute
    // session default expired before anyone could act on it.
    expect(GUARDIAN_RETRY_TTL_SECONDS).toBeGreaterThanOrEqual(3600);
  });
});

describe("parseGuardianCommand — roster", () => {
  const cmd = (name: string) =>
    ({ command: { name, raw: `/${name}`, args: [] } }) as never;

  it("parses /bdani and its /guardian_bd alias to the same command", () => {
    expect(parseGuardianCommand(cmd("bdani"))).toEqual({
      ok: true,
      command: { kind: "roster" },
    });
    expect(parseGuardianCommand(cmd("guardian_bd"))).toEqual({
      ok: true,
      command: { kind: "roster" },
    });
  });
});

describe("/reenviar — rescue for a stuck verification", () => {
  const cmd = (name: string) =>
    ({ command: { name, args: [] } }) as unknown as TelegramUpdateEnvelope;

  it("parses every alias", () => {
    // The dead end it rescues: a pending join request blocks a second one, so
    // the "supersede the abandoned session" path can never fire on its own.
    for (const name of ["reenviar", "reintentar", "guardian_resend"]) {
      expect(parseGuardianCommand(cmd(name)), name).toEqual({
        ok: true,
        command: { kind: "resend" },
      });
    }
  });

  it("does not collide with the other guardian commands", () => {
    expect(parseGuardianCommand(cmd("bdani"))?.ok).toBe(true);
    expect(parseGuardianCommand(cmd("guardian_status"))).toEqual({
      ok: true,
      command: { kind: "status" },
    });
  });
});
