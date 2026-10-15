import type { BotReply, TelegramUpdateEnvelope } from "@superbot/domain";
import type { TelegramGateway } from "@superbot/telegram";

export const extractCallbackMessageId = (raw: unknown): number | undefined => {
  if (typeof raw !== "object" || raw === null) {
    return undefined;
  }

  const callbackQuery = (raw as { callback_query?: unknown }).callback_query;

  if (typeof callbackQuery !== "object" || callbackQuery === null) {
    return undefined;
  }

  const message = (callbackQuery as { message?: unknown }).message;

  if (typeof message !== "object" || message === null) {
    return undefined;
  }

  const messageId = (message as { message_id?: unknown }).message_id;

  return typeof messageId === "number" ? messageId : undefined;
};

/**
 * Human label for the person a `chat_member` update happened TO, read straight
 * off the raw update.
 *
 * The normalized envelope carries only the subject's id, and an alert that says
 * "448291736 is now an admin" makes the reader do the lookup at the exact
 * moment they are least able to — which is the same complaint that applies to
 * any security alert printing raw ids. Telegram already ships the username in
 * `new_chat_member.user`, so there is nothing to fetch.
 *
 * Returns undefined rather than a placeholder, so the caller decides what an
 * unknown person is called.
 */
export const extractChatMemberSubjectLabel = (
  raw: unknown,
): string | undefined => {
  if (typeof raw !== "object" || raw === null) {
    return undefined;
  }
  const change = (raw as { chat_member?: unknown }).chat_member;
  if (typeof change !== "object" || change === null) {
    return undefined;
  }
  const member = (change as { new_chat_member?: unknown }).new_chat_member;
  if (typeof member !== "object" || member === null) {
    return undefined;
  }
  const user = (member as { user?: unknown }).user;
  if (typeof user !== "object" || user === null) {
    return undefined;
  }
  const { username, first_name: firstName } = user as {
    username?: unknown;
    first_name?: unknown;
  };
  if (typeof username === "string" && username.length > 0) {
    return `@${username}`;
  }
  return typeof firstName === "string" && firstName.trim().length > 0
    ? firstName.trim()
    : undefined;
};

/**
 * True when the message a callback is attached to is a media (photo) message.
 * Those have no editable text — editMessageText is rejected by Telegram — so a
 * verdict editing them in place (e.g. Guardian's STAFF report) must go through
 * editMessageCaption instead.
 */
export const extractCallbackMessageIsPhoto = (raw: unknown): boolean => {
  if (typeof raw !== "object" || raw === null) {
    return false;
  }
  const callbackQuery = (raw as { callback_query?: unknown }).callback_query;
  if (typeof callbackQuery !== "object" || callbackQuery === null) {
    return false;
  }
  const message = (callbackQuery as { message?: unknown }).message;
  if (typeof message !== "object" || message === null) {
    return false;
  }
  return Array.isArray((message as { photo?: unknown }).photo);
};

/**
 * The current body of a callback's message — a photo's caption, or a plain
 * message's text — so a verdict can be appended without losing the original
 * report (Guardian's STAFF card).
 */
export const extractCallbackMessageBody = (
  raw: unknown,
): string | undefined => {
  if (typeof raw !== "object" || raw === null) {
    return undefined;
  }
  const callbackQuery = (raw as { callback_query?: unknown }).callback_query;
  if (typeof callbackQuery !== "object" || callbackQuery === null) {
    return undefined;
  }
  const message = (callbackQuery as { message?: unknown }).message;
  if (typeof message !== "object" || message === null) {
    return undefined;
  }
  const m = message as { caption?: unknown; text?: unknown };
  if (typeof m.caption === "string") {
    return m.caption;
  }
  return typeof m.text === "string" ? m.text : undefined;
};

/**
 * The inline keyboard currently attached to a callback's message. Telegram
 * removes the keyboard from any edit that omits reply_markup, so an edit that
 * is not a final verdict (e.g. Guardian's "repetición solicitada" note) has to
 * hand the original one back or the reviewer's buttons vanish for good.
 */
export const extractCallbackMessageReplyMarkup = (
  raw: unknown,
): Record<string, unknown> | undefined => {
  if (typeof raw !== "object" || raw === null) {
    return undefined;
  }
  const callbackQuery = (raw as { callback_query?: unknown }).callback_query;
  if (typeof callbackQuery !== "object" || callbackQuery === null) {
    return undefined;
  }
  const message = (callbackQuery as { message?: unknown }).message;
  if (typeof message !== "object" || message === null) {
    return undefined;
  }
  const markup = (message as { reply_markup?: unknown }).reply_markup;
  return typeof markup === "object" && markup !== null
    ? (markup as Record<string, unknown>)
    : undefined;
};

/**
 * Appends `verdict` beneath the message's existing body. The verdict is ALWAYS
 * kept; only the older body is truncated when the combined text would exceed
 * Telegram's 1024-char caption limit.
 */
export const mergeVerdictCaption = (
  verdict: string,
  existing: string | undefined,
): string => {
  if (!existing) {
    return verdict;
  }
  const LIMIT = 1024;
  const tail = `\n\n${verdict}`;
  if (existing.length + tail.length <= LIMIT) {
    return existing + tail;
  }
  const room = LIMIT - tail.length - 1; // leave room for the "…" marker
  return `${existing.slice(0, Math.max(0, room))}…${tail}`;
};

export const deliverBotReply = async ({
  gateway,
  update,
  rawUpdate,
  reply,
  token,
}: {
  readonly gateway: TelegramGateway;
  readonly update: TelegramUpdateEnvelope;
  readonly rawUpdate: unknown;
  readonly reply: BotReply;
  readonly token: string | undefined;
}): Promise<{ ok: boolean }> => {
  const chatId = update.chat.chatId;
  const inlineMessageId = update.callbackInlineMessageId;

  if (reply.edit && update.kind === "callback_query" && inlineMessageId) {
    try {
      return await gateway.editMessageText({
        inlineMessageId,
        reply,
        token,
      });
    } catch {
      return { ok: true };
    }
  }

  if (!chatId) {
    return { ok: false };
  }

  if (reply.dice) {
    try {
      return await gateway.sendDice({
        chatId,
        emoji: reply.dice,
        token,
      });
    } catch {
      return { ok: false };
    }
  }

  const messageId = extractCallbackMessageId(rawUpdate);

  if (reply.edit && update.kind === "callback_query" && messageId) {
    // A photo report (Guardian's STAFF card) has no text: editMessageText is
    // rejected by Telegram and the verdict silently never lands (the person is
    // admitted but STAFF sees no "Aprobado"). Edit its caption instead.
    const isPhoto = extractCallbackMessageIsPhoto(rawUpdate);
    // preserveCaption keeps the original report and adds the verdict beneath it
    // instead of replacing the whole caption; preserveMarkup hands the original
    // inline keyboard back so a non-final note doesn't strip the buttons. An
    // explicit replyMarkup on the reply always wins (e.g. the expel
    // confirmation, which deliberately swaps the keyboard).
    const keptMarkup =
      reply.preserveMarkup && !reply.replyMarkup
        ? extractCallbackMessageReplyMarkup(rawUpdate)
        : undefined;
    const editReply: BotReply = {
      ...reply,
      ...(reply.preserveCaption
        ? {
            text: mergeVerdictCaption(
              reply.text,
              extractCallbackMessageBody(rawUpdate),
            ),
          }
        : {}),
      ...(keptMarkup ? { replyMarkup: keptMarkup } : {}),
    };
    try {
      return isPhoto
        ? await gateway.editMessageCaption({
            chatId,
            messageId,
            reply: editReply,
            token,
          })
        : await gateway.editMessageText({
            chatId,
            messageId,
            reply: editReply,
            token,
          });
    } catch {
      return { ok: true };
    }
  }

  // In a forum supergroup the reply must land in the SAME topic the message
  // came from — otherwise every command answered in a topic (e.g. /topicid)
  // shows up in General. topicId is undefined outside forums / in General, so
  // this is a no-op there.
  const messageThreadId = update.chat.topicId;
  const threadRoute = messageThreadId !== undefined ? { messageThreadId } : {};

  try {
    return await gateway.sendMessage({
      chatId,
      reply,
      token,
      ...threadRoute,
    });
  } catch {
    if (!reply.parseMode) {
      return { ok: false };
    }
    const { parseMode: _dropped, ...plain } = reply;
    try {
      return await gateway.sendMessage({
        chatId,
        reply: plain,
        token,
        ...threadRoute,
      });
    } catch {
      return { ok: false };
    }
  }
};
