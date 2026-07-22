import type { TelegramUpdateEnvelope } from "@superbot/domain";

/** Modo de sancion que se aplica al alcanzar el limite de warns. */
export type WarnMode = "ban" | "kick" | "mute" | "tban" | "tmute";

/** Configuracion de warns de un chat, al estilo del sistema de Rose. */
export interface WarnPolicy {
  readonly limit: number;
  readonly mode: WarnMode;
  readonly durationMs: number | undefined;
  readonly expireMs: number | undefined;
}

/** Politica de warns por defecto: 3 warns, silencia y sin caducidad. */
export const defaultWarnPolicy: WarnPolicy = {
  limit: 3,
  mode: "mute",
  durationMs: undefined,
  expireMs: undefined,
};

/** Comando de configuracion del sistema de warns, discriminado por "kind". */
export type WarnConfigCommand =
  | { readonly kind: "setLimit"; readonly limit: number }
  | {
      readonly kind: "setMode";
      readonly mode: WarnMode;
      readonly durationMs: number | undefined;
    }
  | { readonly kind: "setTime"; readonly expireMs: number | null }
  | { readonly kind: "show" };

/** Error de validacion de un comando de configuracion de warns. */
export interface WarnConfigCommandError {
  readonly code:
    | "limit-out-of-range"
    | "invalid-mode"
    | "duration-required"
    | "invalid-duration";
  readonly usage: string;
}

/** Resultado del parser de configuracion de warns. */
export type WarnConfigCommandResult =
  | { readonly ok: true; readonly command: WarnConfigCommand }
  | { readonly ok: false; readonly error: WarnConfigCommandError };

const warnConfigCommandNames: ReadonlySet<string> = new Set([
  "setwarnlimit",
  "setwarnmode",
  "setwarntime",
  "warnpolicy",
]);

const timedModes: ReadonlySet<WarnMode> = new Set<WarnMode>(["tban", "tmute"]);

const warnModes: ReadonlySet<string> = new Set<WarnMode>([
  "ban",
  "kick",
  "mute",
  "tban",
  "tmute",
]);

const isWarnMode = (value: string): value is WarnMode => warnModes.has(value);

const setLimitUsage = "Uso: /setwarnlimit <1..20>";
const setModeUsage =
  "Uso: /setwarnmode ban|kick|mute|tban <duracion>|tmute <duracion>";
const setTimeUsage = "Uso: /setwarntime <duracion: 30m|2h|7d|4w|off>";

const compactDurationPattern = /^(\d+)(m|h|d|w)$/u;

/**
 * Convierte una duracion compacta (30m/2h/7d/4w) a milisegundos. Acepta minutos,
 * horas, dias y semanas. Devuelve null si el valor es undefined o el formato es
 * invalido. Pura y determinista.
 */
export const parseCompactDuration = (
  value: string | undefined,
): number | null => {
  const match = value ? compactDurationPattern.exec(value) : null;

  if (!match) {
    return null;
  }

  const amount = Number.parseInt(match[1] ?? "0", 10);
  const unit = match[2];
  const multiplier =
    unit === "m"
      ? 60_000
      : unit === "h"
        ? 3_600_000
        : unit === "d"
          ? 86_400_000
          : 604_800_000;

  return amount * multiplier;
};

/**
 * Parsea los comandos de configuracion del sistema de warns: /setwarnlimit,
 * /setwarnmode, /setwarntime y /warnpolicy. Devuelve null si el comando no
 * pertenece a este modulo, un error si los argumentos son invalidos, o el
 * comando ya normalizado. Pura y determinista.
 */
export const parseWarnConfigCommand = (
  update: TelegramUpdateEnvelope,
): WarnConfigCommandResult | null => {
  const name = update.command?.name;

  if (!name || !warnConfigCommandNames.has(name)) {
    return null;
  }

  const args = update.command?.args ?? [];

  switch (name) {
    case "warnpolicy": {
      return { ok: true, command: { kind: "show" } };
    }
    case "setwarnlimit": {
      const limit = Number.parseInt(args[0] ?? "", 10);
      if (!Number.isInteger(limit) || limit < 1 || limit > 20) {
        return {
          ok: false,
          error: { code: "limit-out-of-range", usage: setLimitUsage },
        };
      }
      return { ok: true, command: { kind: "setLimit", limit } };
    }
    case "setwarnmode": {
      const rawMode = (args[0] ?? "").toLowerCase();
      if (!isWarnMode(rawMode)) {
        return {
          ok: false,
          error: { code: "invalid-mode", usage: setModeUsage },
        };
      }
      if (timedModes.has(rawMode)) {
        const durationMs = parseCompactDuration(args[1]);
        if (durationMs === null) {
          return {
            ok: false,
            error: { code: "duration-required", usage: setModeUsage },
          };
        }
        return {
          ok: true,
          command: { kind: "setMode", mode: rawMode, durationMs },
        };
      }
      return {
        ok: true,
        command: { kind: "setMode", mode: rawMode, durationMs: undefined },
      };
    }
    case "setwarntime": {
      const rawValue = (args[0] ?? "").toLowerCase();
      if (rawValue === "off") {
        return { ok: true, command: { kind: "setTime", expireMs: null } };
      }
      const expireMs = parseCompactDuration(args[0]);
      if (expireMs === null) {
        return {
          ok: false,
          error: { code: "invalid-duration", usage: setTimeUsage },
        };
      }
      return { ok: true, command: { kind: "setTime", expireMs } };
    }
    default:
      return null;
  }
};

/** Decision de escalado: si se aplica sancion y con que modo/duracion. */
export interface WarnEscalation {
  readonly escalate: boolean;
  readonly mode: WarnMode;
  readonly durationMs: number | undefined;
}

/**
 * Decide si el numero actual de warns alcanza el limite de la politica. Si es
 * asi, devuelve escalate=true con el modo y la duracion de la politica; en caso
 * contrario escalate=false. Pura y determinista.
 */
export const decideWarnEscalation = (
  currentCount: number,
  policy: WarnPolicy,
): WarnEscalation => ({
  escalate: currentCount >= policy.limit,
  mode: policy.mode,
  durationMs: policy.durationMs,
});

const formatCompactDuration = (durationMs: number): string => {
  if (durationMs % 604_800_000 === 0) {
    return `${durationMs / 604_800_000}w`;
  }
  if (durationMs % 86_400_000 === 0) {
    return `${durationMs / 86_400_000}d`;
  }
  if (durationMs % 3_600_000 === 0) {
    return `${durationMs / 3_600_000}h`;
  }
  return `${Math.round(durationMs / 60_000)}m`;
};

/**
 * Devuelve un texto legible en espanol sin acentos con el limite, el modo, la
 * duracion (si aplica) y la caducidad de la politica de warns.
 */
export const formatWarnPolicy = (policy: WarnPolicy): string => {
  const lines = [
    "Politica de warns:",
    `- Limite: ${policy.limit}`,
    `- Modo: ${policy.mode}`,
  ];

  if (policy.durationMs !== undefined) {
    lines.push(
      `- Duracion sancion: ${formatCompactDuration(policy.durationMs)}`,
    );
  }

  lines.push(
    policy.expireMs === undefined
      ? "- Caducidad: los warns no caducan"
      : `- Caducidad: ${formatCompactDuration(policy.expireMs)}`,
  );

  return lines.join("\n");
};

/**
 * Construye un teclado inline con un unico boton para que un admin quite un warn
 * concreto. El callback_data es "warn:remove:<warnId>".
 */
export const buildRemoveWarnButton = (
  warnId: string,
): Record<string, unknown> => ({
  inline_keyboard: [
    [
      {
        text: "❌ Quitar warn (admin)",
        callback_data: `warn:remove:${warnId}`,
      },
    ],
  ],
});

/**
 * Parsea un callback de borrado de warn con formato "warn:remove:<id>". Devuelve
 * null si el callback es undefined, no coincide con el prefijo o falta el id.
 */
export const parseRemoveWarnCallback = (
  callbackData: string | undefined,
): { warnId: string } | null => {
  const prefix = "warn:remove:";

  if (!callbackData?.startsWith(prefix)) {
    return null;
  }

  const warnId = callbackData.slice(prefix.length);

  if (warnId.length === 0) {
    return null;
  }

  return { warnId };
};
