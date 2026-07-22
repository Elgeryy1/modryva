/**
 * The single source of truth for the Telegram `allowed_updates` the bot opts
 * into — used by BOTH the primary bot's long-poller (getUpdates) and every
 * managed child bot's webhook registration (setWebhook), on first activation and
 * on reactivation/refresh. Keeping one list prevents the drift that once left
 * `message_reaction` (Bot API 10.0) missing from the managed-bot paths, so
 * reaction moderation silently never fired for child bots.
 *
 * Only real Telegram update types belong here: Telegram delivers `message_reaction`
 * only to admin bots that opt in via this list, and ignores unknown entries. The
 * platform's synthetic `managed_bot` "update" is intentionally NOT here — Telegram
 * never emits it, so listing it would be a no-op at best and a rejected
 * setWebhook at worst.
 */
export const TELEGRAM_ALLOWED_UPDATES = [
  "message",
  "edited_message",
  "callback_query",
  "inline_query",
  "guest_message",
  "pre_checkout_query",
  "chat_join_request",
  "my_chat_member",
  "chat_member",
  "message_reaction",
] as const;

export type TelegramAllowedUpdate = (typeof TELEGRAM_ALLOWED_UPDATES)[number];
