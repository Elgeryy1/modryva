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
  readonly code: "target-required" | "target-id-required" | "duration-required";
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
  mute: "Uso: /mute <telegram_user_id> <duracion: 10m|2h|7d> [motivo]",
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
    const durationMs = parseDurationMs(secondArg);

    if (!durationMs) {
      return {
        ok: false,
        error: { code: "duration-required", usage: usageByAction[action] },
      };
    }

    return {
      ok: true,
      plan: {
        action,
        targetTelegramUserId,
        durationMs,
        reason: remainingArgs.join(" ") || undefined,
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
