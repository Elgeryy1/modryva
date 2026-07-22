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
    try {
      return await gateway.editMessageText({
        chatId,
        messageId,
        reply,
        token,
      });
    } catch {
      return { ok: true };
    }
  }

  try {
    return await gateway.sendMessage({
      chatId,
      reply,
      token,
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
      });
    } catch {
      return { ok: false };
    }
  }
};
