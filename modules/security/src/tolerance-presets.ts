import type { TelegramUpdateEnvelope } from "@superbot/domain";

/**
 * Selector de tolerancia de una sola perilla: mapea un nivel humano
 * ("suave" .. "nuclear") a un juego coherente de umbrales concretos para
 * antiflood, antiraid, warns y captcha. Logica pura y determinista: no hace
 * I/O ni depende de reloj/azar; recibe el nivel y devuelve el preset.
 *
 * Escala: "suave" es laxo (limites altos, castigos leves, sin captcha) y
 * "nuclear" es muy estricto (limites bajos, castigos duros, captcha ON). Los
 * valores crecen o decrecen de forma monotona entre niveles.
 */

/** Niveles de tolerancia ordenados de mas laxo a mas estricto. */
export const TOLERANCE_LEVELS = [
  "suave",
  "normal",
  "estricto",
  "nuclear",
] as const;

/** Un nivel de tolerancia valido. */
export type ToleranceLevel = (typeof TOLERANCE_LEVELS)[number];

/** Accion aplicada por el antiflood al superar el limite de mensajes. */
export type ToleranceAntifloodAction = "mute" | "delete" | "ban";

/** Modo del antiraid: solo observar o aplicar medidas. */
export type ToleranceAntiraidMode = "observe" | "enforce";

/** Accion aplicada por el sistema de warns al alcanzar el limite. */
export type ToleranceWarnMode = "mute" | "ban" | "kick";

/** Umbrales del antiflood dentro de un preset. */
export interface ToleranceAntifloodPreset {
  readonly messageLimit: number;
  readonly windowSeconds: number;
  readonly action: ToleranceAntifloodAction;
}

/** Umbrales del antiraid dentro de un preset. */
export interface ToleranceAntiraidPreset {
  readonly joinLimit: number;
  readonly windowSeconds: number;
  readonly mode: ToleranceAntiraidMode;
}

/** Umbrales del sistema de warns dentro de un preset. */
export interface ToleranceWarnPreset {
  readonly limit: number;
  readonly mode: ToleranceWarnMode;
}

/** Preset completo de proteccion derivado de un nivel de tolerancia. */
export interface TolerancePreset {
  readonly antiflood: ToleranceAntifloodPreset;
  readonly antiraid: ToleranceAntiraidPreset;
  readonly warn: ToleranceWarnPreset;
  readonly captchaOn: boolean;
}

const TOLERANCE_PRESETS: Readonly<Record<ToleranceLevel, TolerancePreset>> = {
  suave: {
    antiflood: { messageLimit: 12, windowSeconds: 5, action: "delete" },
    antiraid: { joinLimit: 20, windowSeconds: 30, mode: "observe" },
    warn: { limit: 5, mode: "mute" },
    captchaOn: false,
  },
  normal: {
    antiflood: { messageLimit: 8, windowSeconds: 6, action: "mute" },
    antiraid: { joinLimit: 12, windowSeconds: 30, mode: "observe" },
    warn: { limit: 3, mode: "mute" },
    captchaOn: false,
  },
  estricto: {
    antiflood: { messageLimit: 5, windowSeconds: 8, action: "mute" },
    antiraid: { joinLimit: 6, windowSeconds: 30, mode: "enforce" },
    warn: { limit: 2, mode: "kick" },
    captchaOn: true,
  },
  nuclear: {
    antiflood: { messageLimit: 3, windowSeconds: 10, action: "ban" },
    antiraid: { joinLimit: 3, windowSeconds: 30, mode: "enforce" },
    warn: { limit: 1, mode: "ban" },
    captchaOn: true,
  },
};

/**
 * Devuelve el preset de umbrales concreto para un nivel de tolerancia. Cada
 * llamada devuelve la misma referencia congelada por nivel (determinista).
 */
export const resolveTolerancePreset = (
  level: ToleranceLevel,
): TolerancePreset => TOLERANCE_PRESETS[level];

/** True si el valor es uno de los niveles de tolerancia conocidos. */
export const isToleranceLevel = (value: string): value is ToleranceLevel =>
  (TOLERANCE_LEVELS as readonly string[]).includes(value);

/** Comando de tolerancia ya parseado. */
export interface ToleranceCommand {
  readonly level: ToleranceLevel;
}

/** Error de parseo de `/tolerance` (nivel ausente o desconocido). */
export interface ToleranceCommandError {
  readonly code: "missing-level" | "unknown-level";
  readonly usage: string;
}

/** Resultado de parsear `/tolerance`: union discriminada por `ok`. */
export type ToleranceCommandResult =
  | { readonly ok: true; readonly command: ToleranceCommand }
  | { readonly ok: false; readonly error: ToleranceCommandError };

const TOLERANCE_USAGE = "Uso: /tolerance suave|normal|estricto|nuclear";

/**
 * Parsea `/tolerance <nivel>`. Devuelve `{ ok: true, command }` con el nivel
 * elegido, `{ ok: false, error }` si falta el nivel o es desconocido, y `null`
 * cuando el update no es el comando `/tolerance`. Pura y determinista.
 */
export const parseToleranceCommand = (
  update: TelegramUpdateEnvelope,
): ToleranceCommandResult | null => {
  const name = update.command?.name;

  if (name !== "tolerance") {
    return null;
  }

  const raw = update.command?.args?.[0]?.toLowerCase();

  if (!raw) {
    return {
      ok: false,
      error: { code: "missing-level", usage: TOLERANCE_USAGE },
    };
  }

  if (!isToleranceLevel(raw)) {
    return {
      ok: false,
      error: { code: "unknown-level", usage: TOLERANCE_USAGE },
    };
  }

  return { ok: true, command: { level: raw } };
};

const TOLERANCE_LABELS: Readonly<Record<ToleranceLevel, string>> = {
  suave: "🟢 Suave",
  normal: "🟡 Normal",
  estricto: "🟠 Estricto",
  nuclear: "🔴 Nuclear",
};

/**
 * Construye un resumen humano de una linea del preset asociado a un nivel,
 * util para confirmar `/tolerance`. Pura y determinista.
 */
export const formatTolerancePreset = (level: ToleranceLevel): string => {
  const preset = resolveTolerancePreset(level);
  const captcha = preset.captchaOn ? "captcha ON" : "captcha OFF";
  return (
    `${TOLERANCE_LABELS[level]} — ` +
    `antiflood ${preset.antiflood.messageLimit} msg/${preset.antiflood.windowSeconds}s (${preset.antiflood.action}), ` +
    `antiraid ${preset.antiraid.joinLimit} joins/${preset.antiraid.windowSeconds}s (${preset.antiraid.mode}), ` +
    `warns ${preset.warn.limit} (${preset.warn.mode}), ${captcha}`
  );
};
