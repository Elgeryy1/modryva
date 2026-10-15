import { formatIpMatchWarning, type IpMatch } from "./ip-identity.js";
import type { IpReputation } from "./ip-reputation.js";
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
  /** Client IP (from the person's first request), or null when unresolved —
   * shown plainly for STAFF fraud/multi-account signals. */
  readonly verifierIp: string | null;
  /** VPN/proxy/risk lookup for that IP (proxycheck.io), or null when the check
   * is disabled/unavailable. Shown plainly next to the IP. */
  readonly ipReputation: IpReputation | null;
  /** Other people who verified in this chat from the same connection — the
   * multi-account signal. Empty means the line is omitted entirely; it never
   * claims "no multi-account", which this check cannot promise. */
  readonly ipMatches?: readonly IpMatch[];
  /**
   * The handful of AI numbers worth showing on the face of the report.
   *
   * Deliberately a small, named subset rather than the raw signal bag: those
   * stay behind the "📄 Informe técnico" button. These three are the ones a
   * non-technical reviewer actually decides on — is it a person, did they do
   * the gesture, and does it look like a photo of a screen.
   */
  readonly signals?: {
    readonly realPerson?: boolean;
    /** 0–1. */
    readonly gestureScore?: number;
    /** 0–1, higher is worse (a photo of a screen rather than a live face). */
    readonly screenRisk?: number;
    /** One plain sentence from the vision model, when it gave one. */
    readonly summary?: string;
  };
}

const STATUS_LABELS: Record<StaffReportStatus, string> = {
  approved_auto: "✅ Aprobado automáticamente",
  queued: "🕓 Pendiente de revisión",
  declined: "❌ Rechazado",
  technical_failure: "⚠️ Fallo técnico",
};

/** How each challenge step is shown to STAFF: an emoji plus a plain-Spanish
 * name. One map rather than two so the emoji and the wording can never drift
 * apart. Anything not listed (a future gesture) falls back to the raw action
 * name rather than guessing or crashing. See FaceAction / HandAction in
 * challenge.ts for the full vocabulary.
 *
 * The names are translated on purpose: STAFF here is often a non-technical
 * group admin, and a report line reading `1. show_three_fingers` tells them
 * nothing about what the person was actually asked to do — the same rule that
 * keeps raw reason codes out of the primary report.
 *
 * Every emoji is DISTINCT: two actions sharing one made a report ambiguous
 * about which gesture was asked for (🤟 previously stood for "three fingers",
 * which is exactly what 🤟 is not). */
const GESTURE_DISPLAY: Record<string, { emoji: string; label: string }> = {
  look_center: { emoji: "👀", label: "mirar al frente" },
  turn_left: { emoji: "⬅️", label: "girar la cabeza a la izquierda" },
  turn_right: { emoji: "➡️", label: "girar la cabeza a la derecha" },
  look_up: { emoji: "⬆️", label: "mirar hacia arriba" },
  blink_once: { emoji: "😉", label: "parpadear una vez" },
  blink_twice: { emoji: "😜", label: "parpadear dos veces" },
  smile: { emoji: "😊", label: "sonreír" },
  thumbs_up: { emoji: "👍", label: "pulgar arriba" },
  victory: { emoji: "✌️", label: "señal de victoria" },
  open_palm: { emoji: "✋", label: "palma abierta" },
  closed_fist: { emoji: "✊", label: "puño cerrado" },
  show_one_finger: { emoji: "☝️", label: "un dedo" },
  show_two_fingers: { emoji: "2️⃣", label: "dos dedos" },
  show_three_fingers: { emoji: "3️⃣", label: "tres dedos" },
  ok_hand: { emoji: "👌", label: "señal de OK" },
  call_me: { emoji: "🤙", label: "pulgar y meñique (llámame)" },
  crossed_fingers: { emoji: "🤞", label: "dedos cruzados" },
  thumbs_down: { emoji: "👎", label: "pulgar abajo" },
  love_you: { emoji: "🤟", label: "pulgar, índice y meñique" },
  vulcan_salute: { emoji: "🖖", label: "saludo vulcano" },
  pinched_fingers: { emoji: "🤌", label: "dedos juntos hacia arriba" },
};

/** One challenge step as STAFF should read it, e.g. "✊ puño cerrado". Falls
 * back to the raw action for anything unmapped. */
export const describeChallengeStep = (action: string): string => {
  const display = GESTURE_DISPLAY[action];
  return display ? `${display.emoji} ${display.label}` : action;
};

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
  // Estos tres NO tienen nada que ver con la edad, aunque el nombre lo parezca:
  // los emite la rama del gesto y la liveness (`gestureBelowMinimum ||
  // livenessBelowMinimum`). La puerta de edad usa `likely_below_minimum_age`
  // y `age_borderline_minimum`, que estan justo arriba.
  //
  // Decian "La edad estimada esta por debajo del minimo permitido", asi que
  // quien revisaba a mano leia un motivo falso Y concreto: decidia sobre "es
  // menor de edad" un caso que era "la foto salio movida". En un grupo sin
  // limite de edad configurado, el mensaje era directamente absurdo.
  //
  // La Mini App ya lo traducia bien —"El gesto no se reconocio con claridad"—,
  // asi que la persona que se verifica leia una cosa y quien la revisaba, otra.
  below_minimum_but_reviewable:
    "El gesto o la comprobación de persona real no alcanzaron el mínimo.",
  below_minimum_signal:
    "El gesto o la comprobación de persona real no alcanzaron el mínimo.",
  below_minimum_attempts_exhausted:
    "El gesto o la comprobación de persona real no alcanzaron el mínimo, en varios intentos.",
  signal_unverified:
    "La IA no llegó a juzgar el gesto o cuántas caras había, así que no se puede aprobar sola.",
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
/** A 0–1 score as a 10-cell bar. Reads faster than a number when the whole
 * point is "is this comfortably high or borderline". */
const scoreBar = (value: number): string => {
  const filled = Math.max(0, Math.min(10, Math.round(value * 10)));
  return `${"█".repeat(filled)}${"▁".repeat(10 - filled)}`;
};

const pct = (value: number): string => `${Math.round(value * 100)}%`;

/** Traffic light for a RISK (higher is worse), so the colour never has to be
 * decoded against the metric's direction. */
const riskLight = (value: number): string =>
  value >= 0.5 ? "🔴" : value >= 0.25 ? "🟠" : "🟢";

const yesNo = (value: boolean | undefined): string =>
  value === undefined ? "❓ sin datos" : value ? "✅ sí" : "❌ no";

const SEPARATOR = "▬▬▬▬▬▬▬▬▬▬▬▬▬▬";

/**
 * The report STAFF actually reads.
 *
 * Ordered by the question a reviewer is answering, not by what the pipeline
 * happens to produce: who is this, what were they asked to do, what did the AI
 * conclude, and only then the forensic detail. The verdict-shaped lines come
 * first because most cases are decided in the first three seconds.
 *
 * Stays compact on purpose: this is a photo CAPTION, capped by Telegram at 1024
 * characters, and a caption that overflows gets truncated at whatever point it
 * happens to reach — losing the end of the report rather than the least
 * important part of it.
 */
/**
 * The same report with every connection-derived detail stripped, for the
 * mirrored STAFF rooms.
 *
 * Two blocks go, and the second matters more than the first. The IP, its
 * country and its VPN verdict are about the person being reviewed. The
 * multi-account line is about OTHER people — it names who else verified from
 * the same connection — so mirroring it would leak third parties who have no
 * relationship with that room at all.
 *
 * Redacts the INPUT rather than skipping lines while rendering, on purpose: a
 * renderer that never receives the data cannot print it, so a connection field
 * added to the report later is redacted by default instead of leaking until
 * somebody remembers to update a second code path. Fail closed, not open.
 *
 * The decision itself, the gesture, the ages and the AI verdict all stay: a
 * mirror still has to be able to tell what happened.
 */
export const redactForMirror = (input: StaffReportInput): StaffReportInput => ({
  ...input,
  countryCode: null,
  verifierIp: null,
  ipReputation: null,
  ipMatches: [],
});

export const formatStaffReportText = (input: StaffReportInput): string => {
  const lines: string[] = [];
  lines.push("🛡 Verificación Guardian");
  lines.push(
    `👤 ${input.displayName}${input.username ? ` (@${input.username})` : ""} · ${input.telegramUserId.toString()}`,
  );
  if (input.challengeSteps.length > 0) {
    lines.push(
      `✋ Gesto pedido: ${input.challengeSteps.map(describeChallengeStep).join(" + ")}`,
    );
  }
  // The group MUST be named: one STAFF room can now receive reports from
  // several communities, so "which group is this" stops being obvious.
  lines.push(`💬 ${input.groupTitle}`);
  lines.push(SEPARATOR);

  lines.push(`🤖 Análisis de IA: ${STATUS_LABELS[input.status]}`);
  if (input.signals) {
    const s = input.signals;
    if (s.realPerson !== undefined) {
      lines.push(`🧍 Persona real: ${yesNo(s.realPerson)}`);
    }
    if (s.gestureScore !== undefined) {
      lines.push(
        `✋ Gesto: ${pct(s.gestureScore)} ${scoreBar(s.gestureScore)}`,
      );
    }
    if (s.screenRisk !== undefined) {
      lines.push(
        `📱 Riesgo foto-pantalla: ${pct(s.screenRisk)} ${riskLight(s.screenRisk)}`,
      );
    }
  }
  if (input.estimatedAge) {
    lines.push(`🎂 Edad estimada: ${input.estimatedAge}`);
  }
  if (input.declaredAge !== undefined) {
    lines.push(`🗣 Edad que dice tener: ${input.declaredAge}`);
  }
  if (input.status !== "approved_auto") {
    const reason = plainReasonLabel(input.reasonCode);
    if (reason) {
      lines.push(`⚠️ ${reason}`);
    }
  }
  if (input.signals?.summary) {
    lines.push(`📝 ${input.signals.summary}`);
  }

  // Location / connection only when there is something to say. An absent line
  // is quieter than "no detectada", and this block is the least-read part.
  //
  // La IP EN CRUDO no se imprime, a proposito. Este informe es un mensaje de
  // Telegram: se queda en el historial de la sala de STAFF, lo lee cualquiera
  // que entre despues y se reenvia con dos toques. Es el peor sitio para dejar
  // un dato personal que no hace falta leer.
  //
  // Y no hace falta: todo lo que la IP aporta a quien revisa ya viene
  // calculado — el pais, si es VPN o proxy con su nivel de riesgo, y el aviso
  // de multicuenta, que dice "misma IP que Fulano" sin decir cual. La IP sigue
  // guardada en `verification_sessions` para lo que haga falta despues.
  const where: string[] = [];
  if (input.countryCode) {
    where.push(`🌍 ${input.countryCode}`);
  }
  if (input.ipReputation) {
    const r = input.ipReputation;
    const risk = r.risk !== null ? ` riesgo ${r.risk}/100` : "";
    where.push(
      r.proxy
        ? `⚠️ VPN/Proxy${r.type ? ` ${r.type}` : ""}${risk}`
        : `✅ IP sin VPN/proxy${risk}`,
    );
  }
  if (where.length > 0) {
    lines.push(SEPARATOR);
    lines.push(where.join(" · "));
  }

  // The multi-account signal gets its own line, never folded into the row
  // above: it is the one thing here that should stop a reviewer.
  const multiAccount = formatIpMatchWarning(input.ipMatches ?? []);
  if (multiAccount) {
    lines.push(multiAccount);
  }

  const footer = [`${input.sessionShortId}`];
  if (input.maxAttempts > 1) {
    footer.push(`intento ${input.attemptNumber}/${input.maxAttempts}`);
  }
  if (input.file) {
    footer.push(`se borra en ${input.file.retentionHours} h`);
  }
  lines.push(SEPARATOR);
  lines.push(`🔖 ${footer.join(" · ")}`);

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

/**
 * Callback data for the inert lock on a mirrored report. Telegram requires
 * callback_data on every non-URL inline button, so this exists purely to answer
 * the tap — without it the client spins until the query times out, which reads
 * as a broken button rather than a deliberate one.
 */
export const STAFF_MIRROR_CALLBACK = "gv:mirror";

/**
 * The keyboard for a MIRRORED copy of a report: read-only.
 *
 * Every button that ACTS is absent — approve, decline, retry, delete media,
 * expel, mark false positive — because a case is decided in one room and one
 * room only. What survives is what cannot change the outcome: contacting the
 * person, and reading the technical report.
 *
 * The lock is a visible label rather than simply no keyboard, on purpose. Staff
 * reading a mirror must be able to tell "you decide elsewhere" apart from "the
 * buttons failed to render", and an absence says neither.
 *
 * This keyboard is NOT the access control. It removes the temptation; the bot
 * re-checks which copy was tapped before acting, which is also what covers the
 * reports mirrored before this rule existed and still carry live buttons.
 */
export const buildMirrorKeyboard = (
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
        text: "🔒 Se decide en el grupo principal",
        callback_data: STAFF_MIRROR_CALLBACK,
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
        text: "📄 Informe técnico",
        callback_data: buildStaffCallbackData(sessionId, "report", secret),
      },
    ],
  ],
});

/** One delivered copy of a STAFF report, as far as this rule needs to know. */
export interface StaffReportCopyRef {
  readonly telegramChatId: bigint;
  readonly messageId: number;
  readonly isPrimary: boolean;
}

/**
 * Whether the tapped copy is a MIRROR — i.e. NOT the room where this case is
 * decided. The caller refuses every acting button when this returns true.
 *
 * Answers false whenever it cannot prove otherwise, and that asymmetry is the
 * whole design. Recording the primary copy is best-effort (a failed bookkeeping
 * write must never undo a report that really was delivered), so "no matching
 * row" means *unknown*, not *mirror*. Refusing on unknown would strand the real
 * STAFF room with a case nobody can decide — a worse failure than the one this
 * prevents. Only a row that positively says `isPrimary: false` blocks.
 *
 * Pure: the caller does the I/O.
 */
export const isMirroredStaffCopy = (
  copies: readonly StaffReportCopyRef[],
  tapped: {
    readonly chatId: bigint | undefined;
    readonly messageId: number | undefined;
  },
): boolean => {
  const match = copies.find(
    (copy) =>
      copy.telegramChatId === tapped.chatId &&
      copy.messageId === tapped.messageId,
  );
  return match !== undefined && !match.isPrimary;
};

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

/**
 * El mismo teclado sin los botones que Telegram puede rechazar.
 *
 * `tg://user?id=` es la única forma de ofrecer "contactar" a alguien sin alias
 * público — y Telegram RECHAZA EL MENSAJE ENTERO con
 * `BUTTON_USER_PRIVACY_RESTRICTED` si esa persona no permite que la enlacen
 * así. No falla el botón: falla el envío completo.
 *
 * Visto en producción el 6 de agosto: una verificación resuelta cuyo informe no
 * llegó a nadie. La regla del sistema es que todo caso resuelto llega al STAFF,
 * y un botón de cortesía la estaba rompiendo.
 *
 * Se quitan SOLO los enlaces a personas. Los botones de callback —aprobar,
 * rechazar, reintentar— se quedan, porque son con los que se decide y un
 * informe sin ellos obligaría a resolver el caso a mano.
 *
 * Pura y determinista.
 */
export const stripPrivacyRestrictedButtons = (markup: unknown): unknown => {
  if (typeof markup !== "object" || markup === null) {
    return markup;
  }
  const teclado = (markup as { inline_keyboard?: unknown }).inline_keyboard;
  if (!Array.isArray(teclado)) {
    return markup;
  }
  const filas = teclado
    .map((fila) =>
      Array.isArray(fila)
        ? fila.filter((boton) => {
            const url = (boton as { url?: unknown } | null)?.url;
            return typeof url !== "string" || !url.startsWith("tg://user");
          })
        : fila,
    )
    // Una fila que se queda vacía no se manda: Telegram tampoco la acepta.
    .filter((fila) => !Array.isArray(fila) || fila.length > 0);
  return { ...(markup as object), inline_keyboard: filas };
};

/** True cuando Telegram rechazó el mensaje por culpa de un botón, no del texto. */
export const isButtonPrivacyError = (error: unknown): boolean => {
  const mensaje =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";
  return mensaje.includes("BUTTON_USER_PRIVACY_RESTRICTED");
};
