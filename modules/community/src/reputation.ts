import type { TelegramUpdateEnvelope } from "@superbot/domain";

export type ReputationCommand =
  | { readonly kind: "give"; readonly targetTelegramUserId: bigint }
  | { readonly kind: "show-self" }
  | { readonly kind: "top" }
  | { readonly kind: "level" };

export interface ReputationCommandError {
  readonly code: "invalid-target";
  readonly usage: string;
}

export type ReputationCommandResult =
  | { readonly ok: true; readonly command: ReputationCommand }
  | { readonly ok: false; readonly error: ReputationCommandError };

const reputationCommandNames: ReadonlySet<string> = new Set([
  "rep",
  "top",
  "level",
  "rank",
]);

const parseTargetUserId = (value: string | undefined): bigint | undefined => {
  if (!value || !/^-?\d+$/u.test(value)) {
    return undefined;
  }
  return BigInt(value);
};

export const parseReputationCommand = (
  update: TelegramUpdateEnvelope,
): ReputationCommandResult | null => {
  const name = update.command?.name;

  if (!name || !reputationCommandNames.has(name)) {
    return null;
  }

  if (name === "top") {
    return { ok: true, command: { kind: "top" } };
  }

  if (name === "level" || name === "rank") {
    return { ok: true, command: { kind: "level" } };
  }

  const rawTarget = (update.command?.args ?? [])[0];

  if (!rawTarget) {
    return { ok: true, command: { kind: "show-self" } };
  }

  const targetTelegramUserId = parseTargetUserId(rawTarget);

  if (!targetTelegramUserId) {
    return {
      ok: false,
      error: {
        code: "invalid-target",
        usage: "Uso: /rep <telegram_user_id> (o /rep para ver tu reputacion)",
      },
    };
  }

  return { ok: true, command: { kind: "give", targetTelegramUserId } };
};

/**
 * Level curve: level n requires xp >= 10 * n^2. Pure and monotonic, so it is safe
 * to recompute from stored xp at any time.
 */
export const levelForXp = (xp: number): number => {
  if (xp <= 0) {
    return 0;
  }
  return Math.floor(Math.sqrt(xp / 10));
};

export const xpForLevel = (level: number): number => 10 * level * level;
