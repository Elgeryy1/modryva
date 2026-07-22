import type { TelegramUpdateEnvelope } from "@superbot/domain";

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");

/**
 * Extracts the question when a plain group message mentions the bot by
 * `@username` (e.g. "@modryvabot que tal"), so groups where the bot is already
 * a member can talk to the AI without needing the /ai command. Returns
 * undefined when: the update isn't a plain message, the chat isn't a
 * group/supergroup, it already parsed as a command, the text doesn't mention
 * `botUsername`, or nothing is left after stripping the mention. Pure and
 * deterministic: depends only on the envelope fields and botUsername.
 */
export const extractMentionPrompt = (
  update: TelegramUpdateEnvelope,
  botUsername: string,
): string | undefined => {
  if (update.kind !== "message") {
    return undefined;
  }
  if (
    update.chat.chatType !== "group" &&
    update.chat.chatType !== "supergroup"
  ) {
    return undefined;
  }
  if (update.command !== undefined) {
    return undefined;
  }

  const text = update.messageText?.trim();
  if (!text) {
    return undefined;
  }

  const cleanUsername = botUsername.replace(/^@/u, "");
  if (!cleanUsername) {
    return undefined;
  }

  const mentionPattern = new RegExp(`@${escapeRegExp(cleanUsername)}\\b`, "iu");
  if (!mentionPattern.test(text)) {
    return undefined;
  }

  const stripped = text
    .replace(mentionPattern, " ")
    .replace(/\s+/gu, " ")
    .trim();
  return stripped.length > 0 ? stripped : undefined;
};
