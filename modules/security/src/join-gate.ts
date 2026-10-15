import type { TelegramUpdateEnvelope } from "@superbot/domain";

/**
 * Entry gate for new members: welcome-mute (a one-button "I'm human" check) and
 * auto-approve for join requests. Pure parsing + callback helpers; the join
 * flow and restriction lifting live in the service.
 */

export type JoinGateCommand =
  | { readonly kind: "welcomemute"; readonly enabled: boolean }
  | { readonly kind: "autoapprove"; readonly enabled: boolean };

export interface JoinGateCommandError {
  readonly code: "invalid-toggle";
  readonly usage: string;
}

export type JoinGateCommandResult =
  | { readonly ok: true; readonly command: JoinGateCommand }
  | { readonly ok: false; readonly error: JoinGateCommandError };

const onValues: ReadonlySet<string> = new Set(["on", "si", "true", "1"]);
const offValues: ReadonlySet<string> = new Set(["off", "no", "false", "0"]);

const parseToggle = (raw: string | undefined): boolean | null => {
  if (raw === undefined) {
    return null;
  }
  const value = raw.toLowerCase();
  if (onValues.has(value)) {
    return true;
  }
  if (offValues.has(value)) {
    return false;
  }
  return null;
};

/**
 * Parses `/welcomemute on|off` and `/autoapprove on|off`. Returns null when the
 * command is not a join-gate command.
 */
export const parseJoinGateCommand = (
  update: TelegramUpdateEnvelope,
): JoinGateCommandResult | null => {
  const name = update.command?.name;

  if (name !== "welcomemute" && name !== "autoapprove") {
    return null;
  }

  const enabled = parseToggle(update.command?.args?.[0]);

  if (enabled === null) {
    return {
      ok: false,
      error: {
        code: "invalid-toggle",
        usage: `Uso: /${name} on|off`,
      },
    };
  }

  return {
    ok: true,
    command:
      name === "welcomemute"
        ? { kind: "welcomemute", enabled }
        : { kind: "autoapprove", enabled },
  };
};

/**
 * Inline keyboard with a single "I'm human" button that only the target user
 * should be able to press (the service verifies the presser's id).
 */
export const buildHumanVerifyButton = (
  telegramUserId: bigint,
): Record<string, unknown> => ({
  inline_keyboard: [
    [
      {
        text: "✅ Soy humano",
        callback_data: `humanverify:${telegramUserId.toString()}`,
      },
    ],
  ],
});

/**
 * Parses a `humanverify:<userId>` callback. Returns null when it is not a
 * human-verify callback or the id is malformed.
 */
export const parseHumanVerifyCallback = (
  callbackData: string | undefined,
): { telegramUserId: bigint } | null => {
  if (!callbackData?.startsWith("humanverify:")) {
    return null;
  }

  const raw = callbackData.slice("humanverify:".length);

  if (!/^-?\d+$/u.test(raw)) {
    return null;
  }

  return { telegramUserId: BigInt(raw) };
};
