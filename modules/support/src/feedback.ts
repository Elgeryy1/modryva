import type { TelegramUpdateEnvelope } from "@superbot/domain";

/**
 * Livegram-style feedback inbox helpers. Users DM the bot; their message is
 * relayed to a staff group with a hidden origin marker; when a staff member
 * replies to that relayed message, the marker tells us which user to answer.
 * Plus a broadcast command to message everyone who has written the bot.
 */

export type FeedbackCommand =
  | { readonly kind: "set-staff" }
  | { readonly kind: "unset-staff" }
  | { readonly kind: "broadcast"; readonly text: string };

export interface FeedbackCommandError {
  readonly code: "text-required";
  readonly usage: string;
}

export type FeedbackCommandResult =
  | { readonly ok: true; readonly command: FeedbackCommand }
  | { readonly ok: false; readonly error: FeedbackCommandError };

export const parseFeedbackCommand = (
  update: TelegramUpdateEnvelope,
): FeedbackCommandResult | null => {
  const name = update.command?.name;

  if (name === "setfeedback") {
    return { ok: true, command: { kind: "set-staff" } };
  }
  if (name === "unsetfeedback") {
    return { ok: true, command: { kind: "unset-staff" } };
  }
  if (name === "broadcast") {
    const text = (update.command?.args ?? []).join(" ").trim();
    return text
      ? { ok: true, command: { kind: "broadcast", text } }
      : {
          ok: false,
          error: { code: "text-required", usage: "Uso: /broadcast <mensaje>" },
        };
  }

  return null;
};

// Zero-width marker so the origin id is invisible-ish but recoverable from the
// relayed message text a staff member replies to.
const MARKER_PREFIX = "⁣id:";

/**
 * Builds the message posted to the staff group for an incoming DM. Ends with a
 * hidden `id:<userId>` marker used to route staff replies back to the user.
 */
export const buildFeedbackRelay = (
  name: string,
  telegramUserId: bigint,
  text: string,
): string =>
  `📨 *${name}* (\`${telegramUserId.toString()}\`):\n${text}\n${MARKER_PREFIX}${telegramUserId.toString()}`;

/**
 * Extracts the origin user id from the text of the relayed message a staff
 * member replied to. Returns null when there is no marker.
 */
export const parseFeedbackOrigin = (
  relayedText: string | undefined,
): bigint | null => {
  if (!relayedText) {
    return null;
  }

  const match = /⁣id:(-?\d+)/u.exec(relayedText);

  if (!match?.[1]) {
    return null;
  }

  try {
    return BigInt(match[1]);
  } catch {
    return null;
  }
};
