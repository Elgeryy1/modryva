import type { TelegramUpdateEnvelope } from "@superbot/domain";

/**
 * Decides if an incoming update should trigger the automatic AI conversation
 * in a private chat. Returns true only when ALL hold: the update is a plain
 * `message` in a `private` chat, it is a text message whose `messageText` has
 * content after trimming, it carries no parsed command, and the trimmed text
 * does not start with "#" (note recall) nor "/" (malformed command). Pure and
 * deterministic: depends only on the envelope fields.
 */
export const shouldAutoChat = (update: TelegramUpdateEnvelope): boolean => {
  if (update.kind !== "message") {
    return false;
  }
  if (update.chat.chatType !== "private") {
    return false;
  }
  if (!update.isTextMessage) {
    return false;
  }
  if (update.command !== undefined) {
    return false;
  }

  const text = update.messageText?.trim() ?? "";

  if (text.length === 0) {
    return false;
  }
  if (text.startsWith("#") || text.startsWith("/")) {
    return false;
  }

  return true;
};

/**
 * Rides alongside SYSTEM_GUARD (commands.ts) for automatic DM replies, so it
 * only says what is DIFFERENT about a private chat — repeating the personality
 * here would just dilute it on an 8B model. "Me llamo Modryva." is asserted
 * verbatim by dm-chat.test.ts.
 */
const DM_SYSTEM_HINT =
  'Estás en un chat privado, así que aquí puedes explayarte un poco más si hace falta. Mismo carácter de siempre. Si te preguntan tu nombre: "Me llamo Modryva." Si buscan funciones del bot, mándalos a /help.';

/**
 * Returns the short system prompt used for automatic DM conversations.
 * Pure and deterministic: always returns the same constant string.
 */
export const buildDmSystemHint = (): string => DM_SYSTEM_HINT;

/**
 * Truncates `text` to at most `maxChars` characters, appending a single "…"
 * when content was cut so the result never exceeds the limit. When
 * `maxChars <= 1` there is no room for content, so it returns "…". Pure and
 * deterministic: identical inputs always yield identical output.
 */
export const truncateDmInput = (text: string, maxChars: number): string => {
  if (maxChars <= 1) {
    return "…";
  }
  if (text.length <= maxChars) {
    return text;
  }
  return `${text.slice(0, maxChars - 1)}…`;
};
