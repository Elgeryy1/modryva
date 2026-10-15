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

/**
 * Retention deadline for the STAFF report message. `keepStaffPhotos` groups get
 * `null` — no deadline is stamped, so the cleanup job (which only lists reports
 * whose deadline is due) never deletes them and the photo stays in the chat
 * forever. Otherwise the report expires `mediaRetentionHours` after `now`.
 * Pure and deterministic.
 */
export const resolveStaffReportDeleteAfter = (
  settings: {
    readonly keepStaffPhotos: boolean;
    readonly mediaRetentionHours: number;
  },
  now: Date,
): Date | null =>
  settings.keepStaffPhotos
    ? null
    : new Date(now.getTime() + settings.mediaRetentionHours * 60 * 60 * 1000);

// --- Quick chat commands ---

export type GuardianCommand =
  | { readonly kind: "help" }
  | { readonly kind: "status" }
  | { readonly kind: "enable"; readonly enabled: boolean }
  | { readonly kind: "mode"; readonly mode: GuardianModeValue }
  | { readonly kind: "topic-id" }
  | { readonly kind: "roster" }
  /**
   * Re-send someone's verification link.
   *
   * Exists because of a dead end in Telegram: a person who opens the Mini App
   * and closes it keeps a pending join request, and Telegram will not let them
   * request again while it is pending — so the "supersede the abandoned
   * session" path, which only runs on a NEW join request, can never fire. They
   * are stuck with no link and nothing on screen saying so. The repeat
   * machinery already exists but hangs off a STAFF report button, and someone
   * who never submitted a photo never produced a report to press.
   */
  | { readonly kind: "resend" };

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
  "guardian_topic",
  "topicid",
  // The verification roster screen: every person who verified, the connection
  // they came from, and who shares one.
  "bdani",
  "guardian_bd",
  // Rescue someone stuck with a pending join request and no link.
  "reenviar",
  "reintentar",
  "guardian_resend",
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
    case "guardian_topic":
    case "topicid":
      return { ok: true, command: { kind: "topic-id" } };
    case "bdani":
    case "guardian_bd":
      return { ok: true, command: { kind: "roster" } };
    case "reenviar":
    case "reintentar":
    case "guardian_resend":
      return { ok: true, command: { kind: "resend" } };
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

/**
 * Prefijo del payload de `/start` que Guardian reparte cuando NO puede escribir
 * por privado a la persona (el caso normal: la ventana de `user_chat_id` de una
 * solicitud de entrada dura 5 minutos y ya ha pasado cuando STAFF revisa). El
 * admin le pasa `https://t.me/<bot>?start=grdv_<token>`; al pulsar EMPEZAR la
 * persona establece el primer contacto — que es justo lo que desbloquea los
 * mensajes privados — y el bot ya puede entregarle el botón de la Mini App.
 */
export const GUARDIAN_RETRY_START_PREFIX = "grdv_";

/**
 * Payload de `/start` del AUTO-rescate: `https://t.me/<bot>?start=verif`.
 *
 * El hermano sin token de `grdv_`, y la diferencia es quien lo usa. El de token
 * lo reparte un admin sobre una sesion concreta. Este lo pulsa la persona a la
 * que **no le ha salido la Mini App**, que por definicion no tiene ningun
 * enlace que pegar ni a quien pedirselo — y hasta ahora no tenia salida: el DM
 * explicativo le falla con 403 porque nunca ha abierto chat con el bot, y
 * `user_chat_id` no lo arregla (medido el 27-08-2026: 18 de 19 fallos eran
 * exactamente esa gente).
 *
 * Pulsar EMPEZAR es lo unico que desbloquea el privado, y este enlace no pide
 * nada mas. Cabe en la descripcion del grupo, que es donde esta la persona
 * justo cuando le falta el boton.
 *
 * Sin token a proposito: un enlace por persona no se puede publicar, y publicar
 * uno es la unica forma de que llegue a quien no ha recibido nada. La sesion se
 * busca por el id de quien pulsa, asi que compartirlo no da acceso a la de
 * nadie mas.
 */
export const GUARDIAN_SELF_START = "verif";

/** Si el payload de `/start` es el del auto-rescate. Pura y total. */
export const esArranqueDeAutoVerificacion = (
  arg: string | undefined,
): boolean => arg === GUARDIAN_SELF_START;

/**
 * TTL de una repetición pedida por STAFF. Deliberadamente MUCHO más largo que
 * `sessionTtlSeconds` (10 min por defecto), porque los dos casos no se parecen:
 * una sesión nueva la abre alguien que acaba de pulsar "unirme" y tiene el
 * móvil en la mano, mientras que una repetición atraviesa un relevo humano
 * (bot → admin → persona → cuando esa persona abra Telegram). Con 10 minutos el
 * enlace caducaba antes de que nadie pudiera usarlo.
 *
 * Mantenerlo abierto un día es seguro: el token está atado a UNA persona (la
 * API rechaza el initData de cualquier otra), y una solicitud de entrada nueva
 * y genuina sustituye a una sesión `awaiting_retry` obsoleta.
 */
export const GUARDIAN_RETRY_TTL_SECONDS = 86_400;

/**
 * Duración en castellano llano para el mensaje que ve el admin: "45 min",
 * "24 h", "2 días". Minutos por debajo de una hora, horas por debajo de un día,
 * días a partir de ahí — nadie lee bien "1440 min". Pura y determinista.
 */
export const formatRetryTtl = (seconds: number): string => {
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `${hours} h`;
  }
  const days = Math.round(hours / 24);
  return days === 1 ? "1 día" : `${days} días`;
};

/**
 * Extrae el token de sesión de un payload `/start grdv_<token>`. Devuelve null
 * si no es un payload de Guardian o si el token no tiene la forma de un
 * `generateSessionToken()` (base64url) — así una cadena arbitraria de un
 * tercero nunca llega a la búsqueda por hash. Pura y total.
 */
export const parseGuardianRetryStart = (
  arg: string | undefined,
): string | null => {
  if (!arg?.startsWith(GUARDIAN_RETRY_START_PREFIX)) {
    return null;
  }
  const token = arg.slice(GUARDIAN_RETRY_START_PREFIX.length);
  return /^[A-Za-z0-9_-]{16,64}$/u.test(token) ? token : null;
};

/**
 * Texto (Markdown legacy) para `/topicid` — reporta el id del grupo y, si el
 * comando se emitió dentro de un tema de un supergrupo con Temas, el id del
 * topic (message_thread_id). El admin pega ambos en el panel de Guardian para
 * enrutar las verificaciones a ese tema. `topicId === undefined` significa que
 * se emitió en el tema "General" o en un grupo sin Temas. Los ids van en code
 * spans (tap-para-copiar en Telegram) y no llevan caracteres que rompan el
 * parseo Markdown legacy. Pura y determinista.
 */
export const formatTopicIdReply = (input: {
  readonly chatId: string;
  readonly topicId: number | undefined;
}): string => {
  if (input.topicId === undefined) {
    return (
      "Estás en el tema *General* (o este grupo no tiene Temas activados).\n" +
      `🆔 ID del grupo: \`${input.chatId}\`\n\n` +
      "Abre el *tema de verificaciones* y vuelve a enviar /topicid ahí para capturar su ID."
    );
  }
  return (
    "🧵 *Topic detectado*\n" +
    `🆔 ID del grupo (Chat STAFF): \`${input.chatId}\`\n` +
    `🧵 ID del topic (Topic de staff): \`${input.topicId}\`\n\n` +
    "Pega ambos en el panel de *Guardian* (Mini App → Configuración) " +
    "para que las verificaciones lleguen solo a este tema."
  );
};
