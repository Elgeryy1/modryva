import type { TelegramUpdateEnvelope } from "@superbot/domain";

/**
 * ControllerBot-style reaction buttons: a posted message carries a row of emoji
 * buttons whose live tap counts are shown in the labels. Pure parsing + keyboard
 * building; the counts and message editing live in the service.
 */

export const REACTION_EMOJIS = ["👍", "❤️", "🔥", "😂", "😮", "👏"] as const;

const reactionSet: ReadonlySet<string> = new Set(REACTION_EMOJIS);

export type ReactCommandResult =
  | { readonly ok: true; readonly command: { readonly text: string } }
  | {
      readonly ok: false;
      readonly error: {
        readonly code: "text-required";
        readonly usage: string;
      };
    };

/**
 * Parses `/react <text>` (alias `/reactpost`). Requires some text to post.
 * Returns null when the command is not a react command.
 */
export const parseReactCommand = (
  update: TelegramUpdateEnvelope,
): ReactCommandResult | null => {
  const name = update.command?.name;

  if (name !== "react" && name !== "reactpost") {
    return null;
  }

  const text = (update.command?.args ?? []).join(" ").trim();

  return text
    ? { ok: true, command: { text } }
    : {
        ok: false,
        error: { code: "text-required", usage: "Uso: /react <mensaje>" },
      };
};

/**
 * Builds the inline keyboard with each reaction emoji and its current count.
 * A count of 0 shows just the emoji.
 */
export const buildReactionKeyboard = (
  counts: Readonly<Record<string, number>>,
): Record<string, unknown> => ({
  inline_keyboard: [
    REACTION_EMOJIS.map((emoji) => {
      const count = counts[emoji] ?? 0;
      return {
        text: count > 0 ? `${emoji} ${count}` : emoji,
        callback_data: `react:${emoji}`,
      };
    }),
  ],
});

/**
 * Parses a `react:<emoji>` callback. Returns null when it is not a reaction
 * callback or the emoji is not one of the supported reactions.
 */
export const parseReactionCallback = (
  callbackData: string | undefined,
): { emoji: string } | null => {
  if (!callbackData?.startsWith("react:")) {
    return null;
  }

  const emoji = callbackData.slice("react:".length);

  return reactionSet.has(emoji) ? { emoji } : null;
};
