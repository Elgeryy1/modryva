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
  /**
   * When editing a callback message, append `text` to the message's EXISTING
   * body instead of replacing it (e.g. a Guardian STAFF verdict added under the
   * original report). The combined caption is truncated to Telegram's 1024
   * limit with the appended verdict always preserved. Ignored unless `edit`.
   */
  readonly preserveCaption?: boolean;
  /**
   * When editing a callback message, put the message's EXISTING inline keyboard
   * back. Telegram DROPS the keyboard on any edit that omits reply_markup, so
   * without this an intermediate note (e.g. Guardian's "repetición solicitada")
   * silently strips the reviewer's buttons and the case can never be decided.
   * Set it for any edit that is NOT a final verdict. An explicit `replyMarkup`
   * on the same reply wins. Ignored unless `edit`.
   */
  readonly preserveMarkup?: boolean;
}
