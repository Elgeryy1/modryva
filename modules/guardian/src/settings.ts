import type { TelegramUpdateEnvelope } from "@superbot/domain";

/**
 * Coherence validation for GuardianVerificationSettings, plus a small set of
 * quick-access chat commands. Full configuration happens in the Mini App
 * config panel (`/config/guardian`); commands here mirror the existing
 * captcha.ts/join-gate.ts pattern for a fast on/off/status toggle from chat.
 */

export type GuardianModeValue =
  | "off"
  | "manual"
  | "assisted"
  | "auto"
  | "strict";

export interface GuardianSettingsForValidation {
  readonly mode: GuardianModeValue;
  readonly staffChatId: bigint | null;
  readonly maxAttempts: number;
  readonly sessionTtlSeconds: number;
  readonly mediaRetentionHours: number;
  readonly autoApproveThreshold: number;
  readonly manualReviewThreshold: number;
  readonly livenessMinimum: number;
  readonly gestureMinimum: number;
  readonly replayRiskMaximum: number;
  readonly syntheticRiskMaximum: number;
  readonly estimateAge: boolean;
  readonly minimumAge: number | null;
  readonly maximumAge: number | null;
  readonly sendApprovedCasesToStaff: boolean;
}

export interface SettingsIssue {
  readonly field: string;
  readonly code: string;
  readonly message: string;
  readonly severity: "error" | "warning";
}

const isUnitInterval = (value: number): boolean => value >= 0 && value <= 1;

/**
 * Validates settings coherence. Callers MUST reject the update when any
 * `error`-severity issue is present; `warning`s may be surfaced to the admin
 * ("¿seguro?") but are not blocking — this is what keeps an admin from
 * silently configuring absurdly low thresholds (rule: never let a threshold
 * that low pass without a warning).
 */
export const validateGuardianSettings = (
  settings: GuardianSettingsForValidation,
): readonly SettingsIssue[] => {
  const issues: SettingsIssue[] = [];

  const thresholdFields: Array<[string, number]> = [
    ["autoApproveThreshold", settings.autoApproveThreshold],
    ["manualReviewThreshold", settings.manualReviewThreshold],
    ["livenessMinimum", settings.livenessMinimum],
    ["gestureMinimum", settings.gestureMinimum],
    ["replayRiskMaximum", settings.replayRiskMaximum],
    ["syntheticRiskMaximum", settings.syntheticRiskMaximum],
  ];
  for (const [field, value] of thresholdFields) {
    if (!isUnitInterval(value)) {
      issues.push({
        field,
        code: "out-of-range",
        message: `${field} debe estar entre 0 y 1.`,
        severity: "error",
      });
    }
  }

  if (settings.autoApproveThreshold <= settings.manualReviewThreshold) {
    issues.push({
      field: "autoApproveThreshold",
      code: "not-above-manual-review",
      message:
        "El umbral de auto-aprobación debe ser mayor que el de revisión manual.",
      severity: "error",
    });
  }

  if (settings.autoApproveThreshold < 0.5) {
    issues.push({
      field: "autoApproveThreshold",
      code: "dangerously-low",
      message:
        "Un umbral de auto-aprobación por debajo de 0.5 aprobará casos muy débiles automáticamente. ¿Seguro?",
      severity: "warning",
    });
  }

  if (settings.maxAttempts < 1) {
    issues.push({
      field: "maxAttempts",
      code: "too-few",
      message: "Debe permitirse al menos 1 intento.",
      severity: "error",
    });
  }
  if (settings.maxAttempts > 10) {
    issues.push({
      field: "maxAttempts",
      code: "too-many",
      message:
        "Más de 10 intentos facilita probar la verificación por fuerza bruta.",
      severity: "warning",
    });
  }

  if (settings.sessionTtlSeconds < 60) {
    issues.push({
      field: "sessionTtlSeconds",
      code: "too-short",
      message: "La sesión debe durar al menos 60 segundos.",
      severity: "error",
    });
  }

  if (settings.mediaRetentionHours < 1) {
    issues.push({
      field: "mediaRetentionHours",
      code: "too-short",
      message: "La retención de medios debe ser de al menos 1 hora.",
      severity: "error",
    });
  }
  if (settings.mediaRetentionHours > 720) {
    issues.push({
      field: "mediaRetentionHours",
      code: "too-long",
      message:
        "Más de 30 días de retención va contra la minimización de datos recomendada.",
      severity: "warning",
    });
  }

  if (settings.mode !== "off" && !settings.staffChatId) {
    issues.push({
      field: "staffChatId",
      code: "missing",
      message:
        "Hace falta un chat STAFF configurado: todos los casos deben poder revisarse.",
      severity: "error",
    });
  }

  if (!settings.sendApprovedCasesToStaff) {
    issues.push({
      field: "sendApprovedCasesToStaff",
      code: "must-be-true",
      message:
        "Los casos aprobados automáticamente también deben reportarse a STAFF (no puede desactivarse).",
      severity: "error",
    });
  }

  if (settings.estimateAge && settings.minimumAge !== null) {
    if (settings.minimumAge < 13 || settings.minimumAge > 99) {
      issues.push({
        field: "minimumAge",
        code: "unreasonable",
        message: "La edad mínima debe estar entre 13 y 99.",
        severity: "warning",
      });
    }
  }

  if (settings.estimateAge && settings.maximumAge !== null) {
    if (settings.maximumAge < 13 || settings.maximumAge > 99) {
      issues.push({
        field: "maximumAge",
        code: "unreasonable",
        message: "La edad máxima debe estar entre 13 y 99.",
        severity: "warning",
      });
    }
  }

  if (
    settings.minimumAge !== null &&
    settings.maximumAge !== null &&
    settings.maximumAge < settings.minimumAge
  ) {
    issues.push({
      field: "maximumAge",
      code: "max-below-min",
      message: "La edad máxima no puede ser menor que la mínima.",
      severity: "error",
    });
  }

  return issues;
};

export const hasBlockingIssues = (issues: readonly SettingsIssue[]): boolean =>
  issues.some((issue) => issue.severity === "error");

// --- Quick chat commands ---

export type GuardianCommand =
  | { readonly kind: "help" }
  | { readonly kind: "status" }
  | { readonly kind: "enable"; readonly enabled: boolean }
  | { readonly kind: "mode"; readonly mode: GuardianModeValue };

export interface GuardianCommandError {
  readonly code: "invalid-mode";
  readonly usage: string;
}

export type GuardianCommandResult =
  | { readonly ok: true; readonly command: GuardianCommand }
  | { readonly ok: false; readonly error: GuardianCommandError };

const guardianModes: ReadonlySet<string> = new Set([
  "off",
  "manual",
  "assisted",
  "auto",
  "strict",
]);

const guardianCommandNames: ReadonlySet<string> = new Set([
  "guardian",
  "guardian_on",
  "guardian_off",
  "guardian_status",
  "guardian_mode",
]);

export const parseGuardianCommand = (
  update: TelegramUpdateEnvelope,
): GuardianCommandResult | null => {
  const name = update.command?.name;
  if (!name || !guardianCommandNames.has(name)) {
    return null;
  }

  switch (name) {
    case "guardian":
      return { ok: true, command: { kind: "help" } };
    case "guardian_status":
      return { ok: true, command: { kind: "status" } };
    case "guardian_on":
      return { ok: true, command: { kind: "enable", enabled: true } };
    case "guardian_off":
      return { ok: true, command: { kind: "enable", enabled: false } };
    case "guardian_mode": {
      const mode = (update.command?.args?.[0] ?? "").toLowerCase();
      if (!guardianModes.has(mode)) {
        return {
          ok: false,
          error: {
            code: "invalid-mode",
            usage: "Uso: /guardian_mode <off|manual|assisted|auto|strict>",
          },
        };
      }
      return {
        ok: true,
        command: { kind: "mode", mode: mode as GuardianModeValue },
      };
    }
    default:
      return null;
  }
};
