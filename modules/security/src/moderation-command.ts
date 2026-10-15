import type { TelegramUpdateEnvelope } from "@superbot/domain";

export type ModerationAction =
  | "warn"
  | "ban"
  | "mute"
  | "unban"
  | "unmute"
  | "kick";

export interface ModerationCommandPlan {
  readonly action: ModerationAction;
  readonly targetTelegramUserId: bigint;
  readonly reason: string | undefined;
  readonly durationMs: number | undefined;
}

export interface ModerationCommandError {
  readonly code: "target-required" | "target-id-required";
  readonly usage: string;
}

export type ModerationCommandParseResult =
  | { readonly ok: true; readonly plan: ModerationCommandPlan }
  | { readonly ok: false; readonly error: ModerationCommandError };

const moderationCommands = new Set([
  "warn",
  "ban",
  "mute",
  "unban",
  "unmute",
  "kick",
]);

const usageByAction: Record<ModerationAction, string> = {
  warn: "Uso: /warn <telegram_user_id> [motivo]",
  ban: "Uso: /ban <telegram_user_id> [motivo]",
  mute: "Uso: /mute <telegram_user_id> [duración: 10m|2h|7d] [motivo]",
  unban: "Uso: /unban <telegram_user_id> [motivo]",
  unmute: "Uso: /unmute <telegram_user_id> [motivo]",
  kick: "Uso: /kick <telegram_user_id> [motivo]",
};

const durationPattern = /^(\d+)(m|h|d)$/u;

const parseDurationMs = (value: string | undefined): number | undefined => {
  const match = value ? durationPattern.exec(value) : null;

  if (!match) {
    return undefined;
  }

  const amount = Number.parseInt(match[1] ?? "0", 10);
  const unit = match[2];
  const multiplier =
    unit === "m" ? 60_000 : unit === "h" ? 3_600_000 : 86_400_000;

  return amount * multiplier;
};

const parseTargetUserId = (value: string | undefined): bigint | undefined => {
  if (!value || !/^-?\d+$/u.test(value)) {
    return undefined;
  }

  return BigInt(value);
};

/**
 * A quien NO se puede sancionar sin romper algo.
 *
 * Un administrador nombrado por el bot es degradable POR el bot, y eso convierte
 * `restrictChatMember` en una degradacion silenciosa. Ocurrio de verdad el 6 de
 * agosto de 2026 en Grupo Central: tres `/mute` a admins nombrados con `/admin`, y
 * un segundo despues los tres pasaban de `administrator` a `restricted`. El
 * `/unmute` les quito el silencio y NO les devolvio el cargo, asi que uno de
 * ellos se paso media hora sin poder usar `/mute` sin entender por que.
 *
 * Un admin nombrado a mano por una persona es inmune porque Telegram rechaza la
 * llamada — o sea que el bot solo se dispara en el pie con los suyos.
 */
export const PROTECTED_TARGET_STATUSES: ReadonlySet<string> = new Set([
  "administrator",
  "creator",
]);

/** Exportado para `intocables.ts`, que redacta la otra negativa y tiene que
 * conjugar la accion igual: dos listas de verbos acabarian diciendo "banear a"
 * en un sitio y "banear" en el otro. No sale por el index — es de la casa. */
export const ACTION_LABEL: Record<ModerationAction, string> = {
  warn: "avisar a",
  ban: "banear a",
  mute: "silenciar a",
  kick: "expulsar a",
  unban: "desbanear a",
  unmute: "quitarle el silencio a",
};

export const parseModerationCommand = (
  update: TelegramUpdateEnvelope,
): ModerationCommandParseResult | null => {
  const commandName = update.command?.name;

  if (!commandName || !moderationCommands.has(commandName)) {
    return null;
  }

  const action = commandName as ModerationAction;
  const [rawTarget, secondArg, ...remainingArgs] = update.command?.args ?? [];
  const targetTelegramUserId = parseTargetUserId(rawTarget);

  if (!rawTarget) {
    return {
      ok: false,
      error: { code: "target-required", usage: usageByAction[action] },
    };
  }

  if (!targetTelegramUserId) {
    return {
      ok: false,
      error: { code: "target-id-required", usage: usageByAction[action] },
    };
  }

  if (action === "mute") {
    // La duración es opcional: sin ella el silencio es indefinido, que es lo
    // que espera cualquiera que responda a un mensaje y escriba `/mute` a
    // secas. Exigirla convertía el gesto más común en un error de uso, y
    // además mudo en la auditoría (el parseo falla antes de registrar nada).
    // Es reversible con /unmute, así que el caso severo se puede deshacer;
    // lo que no se podía deshacer era no silenciar a nadie.
    const durationMs = parseDurationMs(secondArg);
    // Si el segundo argumento no es una duración, forma parte del motivo.
    const reasonArgs = durationMs
      ? remainingArgs
      : [secondArg, ...remainingArgs];

    return {
      ok: true,
      plan: {
        action,
        targetTelegramUserId,
        durationMs,
        reason: reasonArgs.filter(Boolean).join(" ") || undefined,
      },
    };
  }

  return {
    ok: true,
    plan: {
      action,
      targetTelegramUserId,
      durationMs: undefined,
      reason:
        [secondArg, ...remainingArgs].filter(Boolean).join(" ") || undefined,
    },
  };
};
