import {
  signStaffCallbackId,
  verifyStaffCallbackId,
} from "./session-crypto.js";

/**
 * STAFF-facing report formatting + inline-keyboard callback encoding for
 * Guardian Verification. Every session (approved, queued, declined, or
 * technical failure) gets one of these — see rule: "todos los casos deben
 * generar expediente STAFF".
 */

export type StaffReportStatus =
  | "approved_auto"
  | "queued"
  | "declined"
  | "technical_failure";

export interface StaffReportFileInfo {
  readonly kind: "photo" | "video" | "burst";
  readonly resolution?: string;
  readonly durationSeconds?: number;
  readonly sizeMb?: number;
  readonly sha256: string;
  readonly capturedAtIso: string;
  readonly retentionHours: number;
}

export interface StaffReportInput {
  readonly sessionShortId: string;
  readonly status: StaffReportStatus;
  readonly displayName: string;
  readonly username: string | null;
  readonly telegramUserId: bigint;
  readonly groupTitle: string;
  readonly attemptNumber: number;
  readonly maxAttempts: number;
  readonly challengeSteps: readonly string[];
  readonly file: StaffReportFileInfo | null;
  /** Drives the plain-language "Motivo" line via plainReasonLabel — never
   * shown to STAFF as the raw code (rule: no unexplained technical info in
   * the primary report; the "📄 Informe técnico" button covers that). Only
   * rendered for a status that ISN'T approved_auto — an approval needs no
   * justification, and every reason code the decision engine uses for a
   * *successful* auto-approve would otherwise have to be kept in permanent
   * lockstep with plainReasonLabel's map or read as a false "not confirmed". */
  readonly reasonCode?: string;
  /** Self-declared, NEVER an automated approve/decline signal — just shown
   * so STAFF can eyeball it against the person. */
  readonly declaredAge?: number;
  /** e.g. "17-19 años (estimado)", or null when the AI didn't evaluate age —
   * shown plainly (unlike the rest of the raw signals, which stay behind the
   * "📄 Informe técnico" button) because an age range is the one number a
   * non-technical admin actually needs to judge the case. */
  readonly estimatedAge: string | null;
  /** ISO 3166-1 alpha-2 resolved from the person's IP, or null when
   * unresolved — shown plainly next to the reason when the chat restricts
   * by country, same rationale as estimatedAge. */
  readonly countryCode: string | null;
}

const STATUS_LABELS: Record<StaffReportStatus, string> = {
  approved_auto: "✅ Aprobado automáticamente",
  queued: "🕓 Pendiente de revisión",
  declined: "❌ Rechazado",
  technical_failure: "⚠️ Fallo técnico",
};

/** Visual cue next to each challenge step in the STAFF report — purely
 * cosmetic, falls back to no emoji for any action not in this map (e.g. a
 * future gesture type) rather than guessing or crashing. See FaceAction /
 * HandAction in challenge.ts for the full action vocabulary. */
const GESTURE_EMOJI: Record<string, string> = {
  look_center: "👀",
  turn_left: "⬅️",
  turn_right: "➡️",
  look_up: "⬆️",
  blink_once: "😉",
  blink_twice: "😉",
  smile: "😊",
  thumbs_up: "👍",
  victory: "✌️",
  open_palm: "✋",
  closed_fist: "✊",
  show_one_finger: "☝️",
  show_two_fingers: "🤞",
  show_three_fingers: "🤟",
};

const shaSnippet = (sha256: string): string =>
  sha256.length > 16 ? `${sha256.slice(0, 8)}…${sha256.slice(-8)}` : sha256;

/**
 * Plain-Spanish, jargon-free explanation of why a case didn't auto-resolve —
 * STAFF here is often a non-technical group admin, never AI/moderation
 * vocabulary (rule: the primary report shows the reason only; the raw
 * signals stay behind the "📄 Informe técnico" button for whoever wants them).
 */
const PLAIN_REASON_LABEL: Record<string, string> = {
  pipeline_error: "Fallo técnico al procesar la verificación.",
  challenge_incomplete: "No completó a tiempo el gesto pedido.",
  challenge_incomplete_attempts_exhausted:
    "No completó el gesto pedido en ningún intento.",
  no_face_detected: "No se detectó ninguna cara en la foto.",
  no_face_detected_attempts_exhausted:
    "No se detectó ninguna cara en ningún intento.",
  multiple_faces_detected: "Se detectó más de una persona en la foto.",
  multiple_faces_after_retries:
    "Se detectó más de una persona en varios intentos.",
  capture_quality_too_low:
    "La foto no tiene calidad suficiente (mala luz o movimiento).",
  hard_failure: "La foto no pasó las comprobaciones básicas de seguridad.",
  provenance_ai_declared: "La foto podría estar generada o editada por IA.",
  insufficient_ai_signal:
    "No hubo información suficiente para decidir automáticamente.",
  age_unverified: "No se pudo estimar la edad de forma fiable.",
  likely_below_minimum_age:
    "Podría ser menor de la edad mínima permitida en el grupo.",
  age_borderline_minimum:
    "La edad estimada está cerca del mínimo permitido — hace falta que la confirme una persona.",
  likely_above_maximum_age:
    "Podría superar la edad máxima permitida en el grupo.",
  age_borderline_maximum:
    "La edad estimada está cerca del máximo permitido — hace falta que la confirme una persona.",
  below_minimum_but_reviewable:
    "La edad estimada está por debajo del mínimo permitido.",
  below_minimum_signal:
    "La edad estimada está por debajo del mínimo permitido.",
  below_minimum_attempts_exhausted:
    "La edad estimada está por debajo del mínimo permitido, en varios intentos.",
  same_person_unverified:
    "No se pudo confirmar si las dos fotos son de la misma persona.",
  same_person_mismatch: "Las dos fotos NO parecen ser de la misma persona.",
  second_gesture_unverified:
    "No se pudo confirmar el gesto de la segunda foto (doble verificación).",
  country_unverified: "No se pudo determinar el país de la persona.",
  country_not_allowed:
    "El país detectado no está entre los permitidos para este grupo.",
  spoofing_risk_too_high:
    "Alto riesgo de que sea una repetición (pantalla, foto de una foto, o contenido sintético).",
  confidence_above_auto_approve_threshold:
    "Todo correcto: se confirmó automáticamente.",
  confidence_between_thresholds:
    "El resultado no fue lo bastante seguro como para decidir solo.",
  confidence_below_manual_review_threshold:
    "El resultado dio poca confianza — hace falta revisión humana.",
  low_confidence_attempts_exhausted:
    "El resultado dio poca confianza en varios intentos.",
  "upload-too-large": "El archivo enviado era demasiado grande.",
  "unrecognized-format": "El archivo enviado no se pudo reconocer.",
  "media-invalid": "El archivo enviado no es válido.",
  session_ttl_expired: "Se acabó el tiempo antes de terminar la verificación.",
};

/** declineOrReview appends this suffix whenever allowAutomaticDecline is off
 * (see decision-engine.ts) — stripping it before the lookup means every base
 * reason above works for BOTH its auto_decline and manual_review form
 * without a second, easy-to-forget map entry (the exact gap that let
 * "hard_failure_auto_decline_disabled" and friends silently fall through to
 * the generic fallback before this fix). */
const AUTO_DECLINE_DISABLED_SUFFIX = "_auto_decline_disabled";

export const plainReasonLabel = (
  reasonCode: string | undefined,
): string | null => {
  if (!reasonCode) {
    return null;
  }
  const base = reasonCode.endsWith(AUTO_DECLINE_DISABLED_SUFFIX)
    ? reasonCode.slice(0, -AUTO_DECLINE_DISABLED_SUFFIX.length)
    : reasonCode;
  if (base.startsWith("integrity_")) {
    return "Se detectó algo irregular con la sesión de verificación.";
  }
  return (
    PLAIN_REASON_LABEL[base] ??
    "No se pudo confirmar automáticamente — revisa el caso."
  );
};

/** Builds the human-readable STAFF report text (rule-specified format). */
export const formatStaffReportText = (input: StaffReportInput): string => {
  const lines: string[] = [];
  lines.push("🔐 NUEVA VERIFICACIÓN");
  lines.push("");
  lines.push(`Estado: ${STATUS_LABELS[input.status]}`);
  lines.push(
    `Usuario: ${input.displayName}${input.username ? ` (@${input.username})` : ""}`,
  );
  lines.push(`ID: ${input.telegramUserId.toString()}`);
  lines.push(`Grupo: ${input.groupTitle}`);
  lines.push(`Sesión: ${input.sessionShortId}`);
  lines.push(`Intento: ${input.attemptNumber}/${input.maxAttempts}`);
  if (input.status !== "approved_auto") {
    const reason = plainReasonLabel(input.reasonCode);
    if (reason) {
      lines.push(`Motivo: ${reason}`);
    }
  }
  if (input.declaredAge !== undefined) {
    lines.push(`Edad declarada por el usuario: ${input.declaredAge} años`);
  }
  if (input.estimatedAge) {
    lines.push(`Edad estimada por IA: ${input.estimatedAge}`);
  }
  if (input.countryCode) {
    lines.push(`País detectado (por IP): ${input.countryCode}`);
  }
  lines.push("");

  if (input.challengeSteps.length > 0) {
    lines.push("RETO");
    input.challengeSteps.forEach((step, i) => {
      const emoji = GESTURE_EMOJI[step];
      lines.push(`${i + 1}. ${emoji ? `${emoji} ` : ""}${step}`);
    });
    lines.push("");
  }

  if (input.file) {
    lines.push("");
    lines.push("ARCHIVO");
    lines.push(
      `Tipo: ${input.file.kind === "video" ? "vídeo" : input.file.kind === "burst" ? "ráfaga" : "foto"}`,
    );
    if (input.file.resolution)
      lines.push(`Resolución: ${input.file.resolution}`);
    if (input.file.durationSeconds !== undefined) {
      lines.push(`Duración: ${input.file.durationSeconds.toFixed(1)} s`);
    }
    if (input.file.sizeMb !== undefined) {
      lines.push(`Tamaño: ${input.file.sizeMb.toFixed(1)} MB`);
    }
    lines.push(`SHA-256: ${shaSnippet(input.file.sha256)}`);
    lines.push(`Capturado: ${input.file.capturedAtIso}`);
    lines.push(`Retención: se eliminará en ${input.file.retentionHours} h`);
  }

  return lines.join("\n");
};

// --- Callback buttons ---

export type StaffCallbackAction =
  | "approve"
  | "decline"
  | "retry"
  | "delete_media"
  | "mark_false_positive"
  | "expel"
  | "expel_confirm"
  | "report";

const ACTION_CODE: Record<StaffCallbackAction, string> = {
  approve: "ap",
  decline: "dc",
  retry: "rt",
  delete_media: "dm",
  mark_false_positive: "fp",
  expel: "ex",
  expel_confirm: "ec",
  report: "rp",
};

const CODE_ACTION: Record<string, StaffCallbackAction> = Object.fromEntries(
  Object.entries(ACTION_CODE).map(([action, code]) => [code, action]),
) as Record<string, StaffCallbackAction>;

const CALLBACK_PREFIX = "grd";

/** callback_data is `grd:<code>:<sessionId>:<sig>` — short, opaque, and
 * unforgeable without GUARDIAN_SESSION_SECRET (verified via signStaffCallbackId). */
export const buildStaffCallbackData = (
  sessionId: string,
  action: StaffCallbackAction,
  secret: string,
): string => {
  const code = ACTION_CODE[action];
  const sig = signStaffCallbackId(sessionId, action, secret);
  return `${CALLBACK_PREFIX}:${code}:${sessionId}:${sig}`;
};

export interface ParsedStaffCallback {
  readonly action: StaffCallbackAction;
  readonly sessionId: string;
  readonly signature: string;
}

export const parseStaffCallbackData = (
  data: string | undefined,
): ParsedStaffCallback | null => {
  if (!data?.startsWith(`${CALLBACK_PREFIX}:`)) {
    return null;
  }
  const parts = data.split(":");
  if (parts.length !== 4) {
    return null;
  }
  const [, code, sessionId, signature] = parts;
  const action = code ? CODE_ACTION[code] : undefined;
  if (!action || !sessionId || !signature) {
    return null;
  }
  return { action, sessionId, signature };
};

/** Verifies a parsed callback's signature against the session it claims to
 * act on. Callers MUST call this before acting on any parsed callback. */
export const verifyStaffCallback = (
  parsed: ParsedStaffCallback,
  secret: string,
): boolean =>
  verifyStaffCallbackId(
    parsed.sessionId,
    parsed.action,
    parsed.signature,
    secret,
  );

/** Builds the reviewer keyboard for a MANUAL_REVIEW report awaiting a decision. */
/** `t.me/<username>` when known (works everywhere); otherwise `tg://user?id=`,
 * which opens a chat with that Telegram user from inside a Telegram client —
 * the only option when the person has no public username. */
const contactUrl = (telegramUserId: bigint, username: string | null): string =>
  username ? `https://t.me/${username}` : `tg://user?id=${telegramUserId}`;

export const buildManualReviewKeyboard = (
  sessionId: string,
  secret: string,
  contact: {
    readonly telegramUserId: bigint;
    readonly username: string | null;
  },
): Record<string, unknown> => ({
  inline_keyboard: [
    [
      {
        text: "✅ Aprobar",
        callback_data: buildStaffCallbackData(sessionId, "approve", secret),
      },
      {
        text: "❌ Rechazar",
        callback_data: buildStaffCallbackData(sessionId, "decline", secret),
      },
    ],
    [
      {
        text: "💬 Contactar con la persona",
        url: contactUrl(contact.telegramUserId, contact.username),
      },
    ],
    [
      {
        text: "🔁 Pedir repetición",
        callback_data: buildStaffCallbackData(sessionId, "retry", secret),
      },
      {
        text: "🗑 Eliminar medio",
        callback_data: buildStaffCallbackData(
          sessionId,
          "delete_media",
          secret,
        ),
      },
    ],
    [
      {
        text: "📄 Informe técnico",
        callback_data: buildStaffCallbackData(sessionId, "report", secret),
      },
    ],
  ],
});

/** Builds the reviewer keyboard for a case that was already auto-approved. */
export const buildAutoApprovedKeyboard = (
  sessionId: string,
  secret: string,
): Record<string, unknown> => ({
  inline_keyboard: [
    [
      {
        text: "🚨 Marcar falso positivo",
        callback_data: buildStaffCallbackData(
          sessionId,
          "mark_false_positive",
          secret,
        ),
      },
    ],
    [
      {
        text: "🚪 Expulsar",
        callback_data: buildStaffCallbackData(sessionId, "expel", secret),
      },
      {
        text: "🗑 Eliminar medio",
        callback_data: buildStaffCallbackData(
          sessionId,
          "delete_media",
          secret,
        ),
      },
    ],
    [
      {
        text: "📄 Informe técnico",
        callback_data: buildStaffCallbackData(sessionId, "report", secret),
      },
    ],
  ],
});

/** Second-tap confirmation before an actual ban — a single accidental tap on
 * "Expulsar" must never ban by itself (rule: expel requires confirmation). */
export const buildExpelConfirmKeyboard = (
  sessionId: string,
  secret: string,
): Record<string, unknown> => ({
  inline_keyboard: [
    [
      {
        text: "⚠️ Confirmar expulsión",
        callback_data: buildStaffCallbackData(
          sessionId,
          "expel_confirm",
          secret,
        ),
      },
    ],
  ],
});
