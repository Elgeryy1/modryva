export interface BotReply {
  readonly text: string;
  readonly parseMode?: "Markdown" | "MarkdownV2" | "HTML";
  readonly disableWebPagePreview?: boolean;
  readonly replyMarkup?: Record<string, unknown>;
  /**
   * When set, the reply is delivered as a Telegram native animated dice
   * (sendDice) with this emoji (🎲 🎯 🏀 ⚽ 🎳 🎰) instead of a text message.
   * `text` is ignored by the sender in that case.
   */
  readonly dice?: string;
  /**
   * When true and the triggering update is a callback_query, the reply edits the
   * message the button lives on (editMessageText) instead of sending a new one.
   * This powers GroupHelp-style in-place menu navigation. Ignored for
   * non-callback updates.
   */
  readonly edit?: boolean;
}
