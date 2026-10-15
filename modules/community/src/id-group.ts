import type { BotReply, TelegramUpdateEnvelope } from "@superbot/domain";

/**
 * Comando /idgroup: devuelve el ID del chat actual (grupo, canal o privado) en
 * un texto humano. Logica pura y determinista: recibe el update y devuelve el
 * BotReply, o null cuando el comando no es /idgroup. No hace I/O ni red.
 */
export const buildIdGroupReply = (
  update: TelegramUpdateEnvelope,
): BotReply | null => {
  if (update.command?.name !== "idgroup") {
    return null;
  }

  const chatId = update.chat.chatId;
  if (!chatId) {
    return { text: "No he podido leer el ID de este chat." };
  }

  const kind =
    update.chat.chatType === "private"
      ? "chat privado"
      : (update.chat.chatType ?? "chat");

  return {
    text: `🆔 ID de este ${kind}: ${chatId.toString()}`,
  };
};
