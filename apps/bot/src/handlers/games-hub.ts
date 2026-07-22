import type { BotReply, TelegramUpdateEnvelope } from "@superbot/domain";
import { encodeGamesHubStartParam } from "@superbot/shared";

import { readAppUrl } from "../runtime-url.js";

interface GamesHubConfig {
  readonly appUrl: string;
  readonly botUsername: string;
  readonly miniAppName: string;
}

export const handleGamesHub = (
  update: TelegramUpdateEnvelope,
  config: GamesHubConfig,
): BotReply | null => {
  const name = update.command?.name;
  if (name !== "jugar" && name !== "games" && name !== "juegos") {
    return null;
  }

  const appUrl = readAppUrl(config.appUrl);
  if (!appUrl.startsWith("https://")) {
    return {
      text: "🎮 Los juegos viven en la Mini App. Configura una URL publica (tunel) para activarlos.",
    };
  }

  const chatType = update.chat.chatType;

  if (
    (chatType === "group" || chatType === "supergroup") &&
    update.chat.chatId
  ) {
    // One button that opens the whole games hub (all minigames + community
    // trivia + boss live inside it). The `games_<gid>` deep link carries the
    // group so every score played from here counts for this group.
    const gid = update.chat.chatId.toString();
    const hubLink = `https://t.me/${config.botUsername}/${config.miniAppName}?startapp=${encodeGamesHubStartParam(gid)}`;
    return {
      text: "🎮 *Juegos* — tu puntuación cuenta para este grupo.",
      parseMode: "Markdown",
      replyMarkup: {
        inline_keyboard: [[{ text: "🎮 Abrir juegos", url: hubLink }]],
      },
    };
  }

  return {
    text: "🎮 Abre el hub de juegos:",
    replyMarkup: {
      inline_keyboard: [
        [
          {
            text: "🎮 Jugar",
            web_app: { url: `${appUrl}/games` },
          },
        ],
      ],
    },
  };
};
