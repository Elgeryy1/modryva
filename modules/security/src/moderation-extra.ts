import type { TelegramUpdateEnvelope } from "@superbot/domain";

export type ModerationExtraCommand =
  | { readonly kind: "unwarn"; readonly targetTelegramUserId: bigint }
  | { readonly kind: "reset"; readonly targetTelegramUserId: bigint }
  | { readonly kind: "list"; readonly targetTelegramUserId: bigint }
  | { readonly kind: "purge"; readonly count: number }
  | {
      readonly kind: "report";
      readonly targetTelegramUserId: bigint;
      readonly reason: string | undefined;
    };

export interface ModerationExtraCommandError {
  readonly code: "target-id-required" | "invalid-count";
  readonly usage: string;
}

export type ModerationExtraCommandResult =
  | { readonly ok: true; readonly command: ModerationExtraCommand }
  | { readonly ok: false; readonly error: ModerationExtraCommandError };

const moderationExtraCommandNames: ReadonlySet<string> = new Set([
  "unwarn",
  "resetwarn",
  "warnings",
  "purge",
  "report",
]);

const targetIdPattern = /^-?\d+$/;

const targetIdError = (command: string): ModerationExtraCommandResult => ({
  ok: false,
  error: {
    code: "target-id-required",
    usage: `Uso: /${command} <id_usuario>`,
  },
});

const parseTargetId = (raw: string | undefined): bigint | null => {
  if (raw === undefined || !targetIdPattern.test(raw)) {
    return null;
  }
  return BigInt(raw);
};

export const parseModerationExtraCommand = (
  update: TelegramUpdateEnvelope,
): ModerationExtraCommandResult | null => {
  const name = update.command?.name;

  if (!name || !moderationExtraCommandNames.has(name)) {
    return null;
  }

  const args = update.command?.args ?? [];

  switch (name) {
    case "unwarn": {
      const targetTelegramUserId = parseTargetId(args[0]);
      if (targetTelegramUserId === null) {
        return targetIdError("unwarn");
      }
      return { ok: true, command: { kind: "unwarn", targetTelegramUserId } };
    }
    case "resetwarn": {
      const targetTelegramUserId = parseTargetId(args[0]);
      if (targetTelegramUserId === null) {
        return targetIdError("resetwarn");
      }
      return { ok: true, command: { kind: "reset", targetTelegramUserId } };
    }
    case "warnings": {
      const targetTelegramUserId = parseTargetId(args[0]);
      if (targetTelegramUserId === null) {
        return targetIdError("warnings");
      }
      return { ok: true, command: { kind: "list", targetTelegramUserId } };
    }
    case "purge": {
      const count = Number.parseInt(args[0] ?? "", 10);
      if (!Number.isInteger(count) || count < 1 || count > 100) {
        return {
          ok: false,
          error: {
            code: "invalid-count",
            usage: "Uso: /purge <cantidad 1..100>",
          },
        };
      }
      return { ok: true, command: { kind: "purge", count } };
    }
    case "report": {
      const targetTelegramUserId = parseTargetId(args[0]);
      if (targetTelegramUserId === null) {
        return targetIdError("report");
      }
      const reasonText = args.slice(1).join(" ").trim();
      const reason = reasonText.length > 0 ? reasonText : undefined;
      return {
        ok: true,
        command: { kind: "report", targetTelegramUserId, reason },
      };
    }
    default:
      return null;
  }
};

/**
 * Pure escalation check: a member should be escalated (e.g. muted or banned)
 * once their active warnings reach the configured limit.
 */
export const shouldEscalate = (
  activeWarnings: number,
  limit: number,
): boolean => activeWarnings >= limit;
