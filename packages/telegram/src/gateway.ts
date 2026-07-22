import type { BotReply } from "@superbot/domain";

export interface SendTelegramMessageInput {
  readonly chatId: bigint;
  readonly reply: BotReply;
  readonly token: string | undefined;
}

export interface TelegramModerationInput {
  readonly chatId: bigint;
  readonly userId: bigint;
  readonly token: string | undefined;
  readonly untilDate: Date | undefined;
}

export interface TelegramChatPermissions {
  readonly can_send_messages: boolean;
  readonly can_send_audios: boolean;
  readonly can_send_documents: boolean;
  readonly can_send_photos: boolean;
  readonly can_send_videos: boolean;
  readonly can_send_video_notes: boolean;
  readonly can_send_voice_notes: boolean;
  readonly can_send_polls: boolean;
  readonly can_send_other_messages: boolean;
  readonly can_add_web_page_previews: boolean;
}

export interface TelegramSetChatPermissionsInput {
  readonly chatId: bigint;
  readonly permissions: TelegramChatPermissions;
  readonly token: string | undefined;
}

export interface TelegramForumTopicInput {
  readonly chatId: bigint;
  readonly messageThreadId: number;
  readonly token: string | undefined;
}

export interface TelegramGatewayResult {
  readonly ok: boolean;
  readonly skipped: boolean;
  readonly reason?: "missing-token";
}

export interface TelegramSendMessageResult extends TelegramGatewayResult {
  /** Telegram's own message_id, when the send succeeded and the response
   * could be parsed — lets a caller (e.g. Guardian's STAFF report) later
   * delete that exact message via deleteMessage(), instead of never being
   * able to reference it again. */
  readonly messageId?: number;
}

export interface TelegramGetMeResult extends TelegramGatewayResult {
  readonly botUserId?: bigint | undefined;
  readonly name?: string | undefined;
  readonly username?: string | undefined;
  readonly supportsGuestQueries?: boolean | undefined;
  /** Bot API 10.1: whether this bot can receive `chat_join_request.query_id`
   * and use sendChatJoinRequestWebApp / answerChatJoinRequestQuery. */
  readonly supportsJoinRequestQueries?: boolean | undefined;
}

export interface TelegramDiceResult extends TelegramGatewayResult {
  /** The value Telegram rolled: 🎲/🎯/🎳 = 1-6, 🏀/⚽ = 1-5, 🎰 (slot) = 1-64. */
  readonly value?: number;
}

export interface TelegramRevokeInput {
  readonly chatId: bigint;
  readonly userId: bigint;
  readonly token: string | undefined;
  /** unbanChatMember only: defaults to true (never removes a member who
   * isn't actually banned — the safe behavior for a real /unban). Pass
   * false for a kick's ban-then-immediately-unban pattern, where Telegram's
   * own ban can lag behind the call that issued it — with the default,
   * unban would then see "not banned yet" and no-op, leaving the ban
   * permanent instead of a kick. */
  readonly onlyIfBanned?: boolean;
}

export interface TelegramPinMessageInput {
  readonly chatId: bigint;
  readonly messageId: number;
  readonly token: string | undefined;
}

export interface TelegramChatTextInput {
  readonly chatId: bigint;
  readonly text: string;
  readonly token: string | undefined;
}

export interface TelegramChatActionInput {
  readonly chatId: bigint;
  readonly action: "typing";
  readonly token: string | undefined;
}

export interface TelegramMessageDraftInput {
  readonly chatId: bigint;
  readonly text: string;
  readonly token: string | undefined;
}

export interface TelegramPromoteInput {
  readonly chatId: bigint;
  readonly userId: bigint;
  readonly customTitle: string | undefined;
  readonly token: string | undefined;
}

export interface TelegramInviteLinkResult extends TelegramGatewayResult {
  readonly inviteLink?: string;
}

export interface TelegramChatAdminInfo {
  readonly userId: bigint;
  readonly username: string | undefined;
  readonly firstName: string | undefined;
  readonly isOwner: boolean;
  readonly customTitle: string | undefined;
}

export interface TelegramAdminsResult extends TelegramGatewayResult {
  readonly admins?: readonly TelegramChatAdminInfo[];
}

export interface TelegramChatMemberResult extends TelegramGatewayResult {
  readonly status?: string;
  /**
   * Whether this member can delete messages (Bot API ChatMember). True for
   * creators/owners, the explicit flag for administrators, absent otherwise.
   * Used to check the BOT's own rights before a reaction-moderation call so we
   * never fire a request Telegram would reject with 400/403.
   */
  readonly canDeleteMessages?: boolean;
}

export interface TelegramChatInfo {
  readonly chatId: bigint | undefined;
  readonly type: string | undefined;
  readonly title: string | undefined;
  readonly username: string | undefined;
  readonly firstName?: string | undefined;
  readonly lastName?: string | undefined;
  /** ChatFullInfo.guard_bot (Bot API 10.1): whether a Guardian Bot is already
   * assigned to this chat. There is no API method to assign one — see
   * docs/GUARDIAN_TELEGRAM_TEST.md for the manual Telegram-side steps. */
  readonly guardBot?: boolean | undefined;
}

export interface TelegramChatResult extends TelegramGatewayResult {
  readonly chat?: TelegramChatInfo;
}

export interface TelegramDiceInput {
  readonly chatId: bigint;
  readonly emoji: string;
  readonly token: string | undefined;
}

export interface TelegramCallbackAnswerInput {
  readonly callbackQueryId: string;
  readonly text: string | undefined;
  readonly token: string | undefined;
  /** When true, Telegram shows `text` as a blocking modal popup (show_alert)
   * instead of a transient toast. Used by the welcome "rules" button. */
  readonly showAlert?: boolean;
}

export interface TelegramMediaInput {
  readonly chatId: bigint;
  readonly imageBase64: string;
  readonly type: "png" | "webp" | "jpg";
  readonly token: string | undefined;
  /** Optional caption. Telegram caps photo captions at 1024 chars — the
   * caller MUST pre-truncate; this layer sends it verbatim. */
  readonly caption?: string;
  /** Optional inline keyboard (e.g. Guardian's STAFF approve/decline row) so
   * the buttons attach directly to the photo message. */
  readonly replyMarkup?: Record<string, unknown>;
  /** Telegram's protect_content: when true, the sent media cannot be
   * forwarded or saved by the recipient chat. Used by Guardian's STAFF
   * report so the 'protectStaffContent' setting actually does something. */
  readonly protectContent?: boolean;
}

export interface TelegramGateway {
  sendMessage(
    input: SendTelegramMessageInput,
  ): Promise<TelegramSendMessageResult>;
  sendChatAction(
    input: TelegramChatActionInput,
  ): Promise<TelegramGatewayResult>;
  sendMessageDraft(
    input: TelegramMessageDraftInput,
  ): Promise<TelegramGatewayResult>;
  editMessageText(
    input: TelegramEditMessageInput,
  ): Promise<TelegramGatewayResult>;
  banChatMember(input: TelegramModerationInput): Promise<TelegramGatewayResult>;
  restrictChatMember(
    input: TelegramModerationInput,
  ): Promise<TelegramGatewayResult>;
  unbanChatMember(input: TelegramRevokeInput): Promise<TelegramGatewayResult>;
  liftRestrictions(input: TelegramRevokeInput): Promise<TelegramGatewayResult>;
  /** Chat-wide permissions (Bot API setChatPermissions) — distinct from
   * restrictChatMember, which only restricts a single member. */
  setChatPermissions(
    input: TelegramSetChatPermissionsInput,
  ): Promise<TelegramGatewayResult>;
  closeForumTopic(
    input: TelegramForumTopicInput,
  ): Promise<TelegramGatewayResult>;
  deleteMessage(
    input: TelegramDeleteMessageInput,
  ): Promise<TelegramGatewayResult>;
  /** Remove an actor's reaction(s) from ONE message (Bot API 10.0). */
  deleteMessageReaction(
    input: TelegramDeleteMessageReactionInput,
  ): Promise<TelegramGatewayResult>;
  /**
   * Purge up to 10 000 of an actor's recent reactions across the WHOLE chat
   * (Bot API 10.0). Global + heavy — admin-confirmed use only, never automatic.
   */
  deleteAllMessageReactions(
    input: TelegramDeleteAllMessageReactionsInput,
  ): Promise<TelegramGatewayResult>;
  sendInvoice(input: TelegramInvoiceInput): Promise<TelegramGatewayResult>;
  createInvoiceLink(
    input: TelegramInvoiceLinkInput,
  ): Promise<TelegramInvoiceLinkResult>;
  editUserStarSubscription(
    input: TelegramEditStarSubscriptionInput,
  ): Promise<TelegramGatewayResult>;
  answerPreCheckoutQuery(
    input: TelegramPreCheckoutAnswer,
  ): Promise<TelegramGatewayResult>;
  answerInlineQuery(
    input: TelegramInlineAnswer,
  ): Promise<TelegramGatewayResult>;
  answerGuestQuery(input: TelegramGuestAnswer): Promise<TelegramGatewayResult>;
  pinChatMessage(
    input: TelegramPinMessageInput,
  ): Promise<TelegramGatewayResult>;
  unpinChatMessage(input: {
    chatId: bigint;
    token: string | undefined;
  }): Promise<TelegramGatewayResult>;
  setChatTitle(input: TelegramChatTextInput): Promise<TelegramGatewayResult>;
  setChatDescription(
    input: TelegramChatTextInput,
  ): Promise<TelegramGatewayResult>;
  promoteChatMember(
    input: TelegramPromoteInput,
  ): Promise<TelegramGatewayResult>;
  demoteChatMember(input: TelegramRevokeInput): Promise<TelegramGatewayResult>;
  createChatInviteLink(input: {
    chatId: bigint;
    token: string | undefined;
  }): Promise<TelegramInviteLinkResult>;
  getChatAdministrators(input: {
    chatId: bigint;
    token: string | undefined;
  }): Promise<TelegramAdminsResult>;
  getChat(input: {
    chatId: bigint;
    token: string | undefined;
  }): Promise<TelegramChatResult>;
  sendDice(input: TelegramDiceInput): Promise<TelegramDiceResult>;
  setChatMenuButton(input: {
    url: string;
    text: string;
    token: string | undefined;
  }): Promise<TelegramGatewayResult>;
  getMe(input: { token: string | undefined }): Promise<TelegramGetMeResult>;
  setMyCommands(input: {
    commands: readonly { command: string; description: string }[];
    token: string | undefined;
  }): Promise<TelegramGatewayResult>;
  setMyDescription(input: {
    description: string;
    token: string | undefined;
  }): Promise<TelegramGatewayResult>;
  setMyShortDescription(input: {
    shortDescription: string;
    token: string | undefined;
  }): Promise<TelegramGatewayResult>;
  getChatMember(input: {
    chatId: bigint;
    userId: bigint;
    token: string | undefined;
  }): Promise<TelegramChatMemberResult>;
  answerCallbackQuery(
    input: TelegramCallbackAnswerInput,
  ): Promise<TelegramGatewayResult>;
  sendSticker(input: TelegramMediaInput): Promise<TelegramGatewayResult>;
  /** Returns Telegram's message_id (when parseable) so a caller can later
   * delete this exact photo — Guardian's STAFF report relies on it for the
   * media-retention promise. */
  sendPhoto(input: TelegramMediaInput): Promise<TelegramSendMessageResult>;
  approveChatJoinRequest(
    input: TelegramRevokeInput,
  ): Promise<TelegramGatewayResult>;
  declineChatJoinRequest(
    input: TelegramRevokeInput,
  ): Promise<TelegramGatewayResult>;
  /** Bot API 10.1: opens the Guardian verification Mini App from a pending
   * chat_join_request. Must be called within Telegram's initial ~10s window. */
  sendChatJoinRequestWebApp(
    input: TelegramSendJoinRequestWebAppInput,
  ): Promise<TelegramGatewayResult>;
  /** Bot API 10.1: resolves a chat_join_request.query_id with approve/decline/
   * queue. Only valid for the FIRST answer to a given query_id — a later
   * manual staff decision (after `queue`) uses approveChatJoinRequest /
   * declineChatJoinRequest instead, since Telegram's query_id is considered
   * answered at that point. See docs/GUARDIAN_TELEGRAM_TEST.md. */
  answerChatJoinRequestQuery(
    input: TelegramAnswerJoinRequestQueryInput,
  ): Promise<TelegramGatewayResult>;
  editMessageReplyMarkup(input: {
    chatId: bigint;
    messageId: number;
    replyMarkup: Record<string, unknown>;
    token: string | undefined;
  }): Promise<TelegramGatewayResult>;
}

// --- Bot API 10.1: Guardian Bots / join request queries ---

export interface TelegramSendJoinRequestWebAppInput {
  readonly chatJoinRequestQueryId: string;
  /** HTTPS URL of the Guardian verification Mini App, e.g. GUARDIAN_MINIAPP_URL. */
  readonly webAppUrl: string;
  readonly token: string | undefined;
}

export type TelegramJoinRequestQueryResult = "approve" | "decline" | "queue";

export interface TelegramAnswerJoinRequestQueryInput {
  readonly chatJoinRequestQueryId: string;
  readonly result: TelegramJoinRequestQueryResult;
  readonly token: string | undefined;
}

export interface TelegramManagedBotTokenInput {
  readonly userId: bigint;
  readonly token: string | undefined;
}

export interface TelegramSetWebhookInput {
  readonly url: string;
  readonly secretToken: string;
  readonly allowedUpdates: readonly string[];
  readonly token: string | undefined;
  /**
   * Whether Telegram should discard updates queued before this call. Defaults to
   * true (a fresh registration/activation wants a clean slate). A webhook REFRESH
   * that only rotates the secret / widens allowed_updates must pass false so it
   * never drops updates already waiting for delivery.
   */
  readonly dropPendingUpdates?: boolean;
}

export interface TelegramWebhookInfoResult extends TelegramGatewayResult {
  readonly url?: string;
  /** The update types Telegram will deliver; absent means "all default". */
  readonly allowedUpdates?: readonly string[];
  readonly pendingUpdateCount?: number;
}

export interface TelegramManagedBotGateway {
  getManagedBotToken(
    input: TelegramManagedBotTokenInput,
  ): Promise<string | undefined>;
  replaceManagedBotToken(
    input: TelegramManagedBotTokenInput,
  ): Promise<string | undefined>;
  setWebhook(input: TelegramSetWebhookInput): Promise<TelegramGatewayResult>;
}

export interface TelegramInlineResult {
  readonly id: string;
  readonly title: string;
  readonly content: string;
  readonly description?: string;
  readonly thumbnailUrl?: string;
  readonly replyMarkup?: Record<string, unknown>;
}

export interface TelegramInlineAnswer {
  readonly inlineQueryId: string;
  readonly results: readonly TelegramInlineResult[];
  readonly cacheTime?: number;
  readonly token: string | undefined;
}

export interface TelegramGuestAnswer {
  readonly guestQueryId: string;
  readonly text: string;
  readonly token: string | undefined;
}

export interface TelegramDeleteMessageInput {
  readonly chatId: bigint;
  readonly messageId: number;
  readonly token: string | undefined;
}

/**
 * The ACTOR whose reaction(s) Telegram will remove — exactly one of a user or a
 * channel-as-actor. deleteMessageReaction / deleteAllMessageReactions identify
 * WHO reacted, never which emoji: the Bot API has no per-emoji targeting. The
 * `?: never` arms make it a compile error to pass both or neither.
 */
export type TelegramReactionActor =
  | { readonly userId: bigint; readonly actorChatId?: never }
  | { readonly actorChatId: bigint; readonly userId?: never };

/**
 * deleteMessageReaction (Bot API 10.0): removes the reaction(s) a single ACTOR
 * placed on ONE message. The bot must be an admin with can_delete_messages.
 * There is NO `reaction` parameter — removal is by actor, so this also clears
 * any other (innocent) reactions that same actor added to that message.
 * Requires exactly one of user_id / actor_chat_id (see {@link
 * TelegramReactionActor}).
 */
export interface TelegramDeleteMessageReactionInput {
  readonly chatId: bigint;
  readonly messageId: number;
  readonly actor: TelegramReactionActor;
  readonly token: string | undefined;
}

/**
 * deleteAllMessageReactions (Bot API 10.0): removes up to 10 000 of an actor's
 * MOST RECENT reactions across the WHOLE chat — NOT the reactions on one
 * message (there is no message_id). A heavy, global action on an actor's
 * history: keep it a deliberate, admin-CONFIRMED tool, never an automatic
 * response to a reaction surge.
 */
export interface TelegramDeleteAllMessageReactionsInput {
  readonly chatId: bigint;
  readonly actor: TelegramReactionActor;
  readonly token: string | undefined;
}

const reactionActorToPayload = (
  actor: TelegramReactionActor,
): Record<string, string> =>
  actor.userId !== undefined
    ? { user_id: actor.userId.toString() }
    : { actor_chat_id: actor.actorChatId.toString() };

export interface TelegramEditMessageInput {
  readonly chatId?: bigint;
  readonly messageId?: number;
  readonly inlineMessageId?: string;
  readonly reply: BotReply;
  readonly token: string | undefined;
}

export interface TelegramInvoiceInput {
  readonly chatId: bigint;
  readonly title: string;
  readonly description: string;
  readonly payload: string;
  readonly currency: string;
  readonly amount: number;
  readonly token: string | undefined;
}

export interface TelegramPreCheckoutAnswer {
  readonly preCheckoutQueryId: string;
  readonly ok: boolean;
  readonly errorMessage: string | undefined;
  readonly token: string | undefined;
}

export interface TelegramInvoiceLinkInput {
  readonly title: string;
  readonly description: string;
  readonly payload: string;
  readonly currency: string;
  readonly amount: number;
  /** Stars-only. Telegram currently accepts exactly 2_592_000 (30 days). */
  readonly subscriptionPeriodSeconds?: number;
  readonly token: string | undefined;
}

export interface TelegramInvoiceLinkResult extends TelegramGatewayResult {
  readonly url?: string;
}

export interface TelegramEditStarSubscriptionInput {
  readonly userId: bigint;
  readonly telegramPaymentChargeId: string;
  readonly isCanceled: boolean;
  readonly token: string | undefined;
}

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

interface RetryPolicy {
  readonly maxAttempts: number;
  readonly capSeconds: number;
}

// Provisioning calls (managed-bot activation) are rare; getting them right
// matters more than latency, so telegramJson's own loop already affords a
// long wait across several attempts. This constant documents that existing
// policy for reference — telegramJson is NOT changed to use it, to avoid
// touching an already-working, already-covered code path.
const PROVISIONING_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 4,
  capSeconds: 30,
};

// High-volume calls (sendMessage, moderation, media uploads, editMessageText,
// getChatMember/createInvoiceLink, ...) run inside sequential loops: the
// bot's getUpdates poller processes one update's reply at a time, and the
// worker's due-item processors send one message per due item with no
// throttling between them. A long wait on one rate-limited call would stall
// every other pending chat behind it, so this policy allows only ONE retry,
// capped at 3s — enough to absorb Telegram's common per-chat "wait ~1s" flood
// control without turning a single 429 into a multi-second pileup.
const HIGH_VOLUME_RETRY_POLICY: RetryPolicy = { maxAttempts: 2, capSeconds: 3 };

export class HttpTelegramGateway implements TelegramGateway {
  /**
   * POSTs to Telegram, transparently retrying a bounded number of times when
   * Telegram answers 429 (Too Many Requests) with parameters.retry_after.
   * Returns the final attempt's Response completely unread — every existing
   * caller's own response.json()/response.ok handling keeps working exactly
   * as it does today; this only inserts a capped wait-and-retry *before*
   * that handling runs, on 429 responses that would otherwise be discarded.
   */
  private async fetchWithRetry(
    url: string,
    init: RequestInit,
    policy: RetryPolicy,
  ): Promise<Response> {
    for (let attempt = 1; ; attempt += 1) {
      const response = await fetch(url, init);

      if (response.status !== 429 || attempt >= policy.maxAttempts) {
        return response;
      }

      // This response is being discarded (we're retrying), so it's safe to
      // consume its body here — the response we eventually return is always
      // the fresh, unread one from the branch above.
      const retryAfter = await response
        .json()
        .then(
          (body) =>
            (body as { parameters?: { retry_after?: number } }).parameters
              ?.retry_after,
        )
        .catch(() => undefined);

      const waitSeconds = Math.min(
        retryAfter ?? 2 ** attempt,
        policy.capSeconds,
      );
      await delay(waitSeconds * 1000);
    }
  }

  private async telegramJson<T>(
    token: string | undefined,
    method: string,
    body: Record<string, unknown>,
  ): Promise<T> {
    if (!token) {
      throw new Error("missing-token");
    }

    // Telegram answers a burst of writes (setWebhook, getManagedBotToken, ...)
    // with HTTP 429 + parameters.retry_after. Honour that delay and retry a few
    // times so a transient rate-limit doesn't fail a managed-bot activation.
    const maxAttempts = 4;
    for (let attempt = 1; ; attempt += 1) {
      const response = await fetch(
        `https://api.telegram.org/bot${token}/${method}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        },
      );

      const payload = (await response.json()) as {
        ok?: boolean;
        result?: T;
        description?: string;
        parameters?: { retry_after?: number };
      };

      if (response.ok && payload.ok) {
        return payload.result as T;
      }

      const retryAfter = payload.parameters?.retry_after;
      const isRateLimited = response.status === 429 || retryAfter !== undefined;
      if (isRateLimited && attempt < maxAttempts) {
        // Cap the wait so a hostile retry_after can't hang the request forever.
        const waitSeconds = Math.min(retryAfter ?? 2 ** attempt, 30);
        await delay(waitSeconds * 1000);
        continue;
      }

      const retryHint =
        retryAfter !== undefined ? ` retry_after=${retryAfter}s` : "";
      if (!response.ok) {
        throw new Error(
          `Telegram ${method} failed with status ${response.status}: ${payload.description ?? "unknown"}${retryHint}`,
        );
      }
      throw new Error(
        `Telegram ${method} failed: ${payload.description ?? "unknown"}${retryHint}`,
      );
    }
  }

  async getManagedBotToken({
    userId,
    token,
  }: TelegramManagedBotTokenInput): Promise<string | undefined> {
    if (!token) {
      return undefined;
    }
    return this.telegramJson<string>(token, "getManagedBotToken", {
      user_id: userId.toString(),
    });
  }

  async replaceManagedBotToken({
    userId,
    token,
  }: TelegramManagedBotTokenInput): Promise<string | undefined> {
    if (!token) {
      return undefined;
    }
    return this.telegramJson<string>(token, "replaceManagedBotToken", {
      user_id: userId.toString(),
    });
  }

  async setWebhook({
    url,
    secretToken,
    allowedUpdates,
    token,
    dropPendingUpdates = true,
  }: TelegramSetWebhookInput): Promise<TelegramGatewayResult> {
    if (!token) {
      return { ok: false, skipped: true, reason: "missing-token" };
    }
    await this.telegramJson<boolean>(token, "setWebhook", {
      url,
      secret_token: secretToken,
      allowed_updates: allowedUpdates,
      drop_pending_updates: dropPendingUpdates,
    });
    return { ok: true, skipped: false };
  }

  /**
   * Reads the current webhook registration. Used to VERIFY, after a refresh,
   * that a bot's allowed_updates actually contains what we set (e.g.
   * message_reaction). Never throws — a lookup failure surfaces as { ok: false }
   * so a bulk refresh can report it per bot instead of aborting.
   */
  async getWebhookInfo({
    token,
  }: {
    token: string | undefined;
  }): Promise<TelegramWebhookInfoResult> {
    if (!token) {
      return { ok: false, skipped: true, reason: "missing-token" };
    }
    try {
      const info = await this.telegramJson<{
        url?: unknown;
        allowed_updates?: unknown;
        pending_update_count?: unknown;
      }>(token, "getWebhookInfo", {});
      const allowedUpdates = Array.isArray(info.allowed_updates)
        ? info.allowed_updates.filter(
            (value): value is string => typeof value === "string",
          )
        : undefined;
      return {
        ok: true,
        skipped: false,
        ...(typeof info.url === "string" ? { url: info.url } : {}),
        ...(allowedUpdates ? { allowedUpdates } : {}),
        ...(typeof info.pending_update_count === "number"
          ? { pendingUpdateCount: info.pending_update_count }
          : {}),
      };
    } catch {
      return { ok: false, skipped: false };
    }
  }

  /** Removes a bot's webhook — used to switch off a suspended managed bot. */
  async deleteWebhook({
    token,
  }: {
    token: string | undefined;
  }): Promise<TelegramGatewayResult> {
    if (!token) {
      return { ok: false, skipped: true, reason: "missing-token" };
    }
    await this.telegramJson<boolean>(token, "deleteWebhook", {
      drop_pending_updates: true,
    });
    return { ok: true, skipped: false };
  }

  async sendMessage({
    chatId,
    reply,
    token,
  }: SendTelegramMessageInput): Promise<TelegramSendMessageResult> {
    if (!token) {
      return { ok: false, skipped: true, reason: "missing-token" };
    }

    const response = await this.fetchWithRetry(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          chat_id: chatId.toString(),
          text: reply.text,
          parse_mode: reply.parseMode,
          disable_web_page_preview: reply.disableWebPagePreview ?? true,
          reply_markup: reply.replyMarkup,
        }),
      },
      HIGH_VOLUME_RETRY_POLICY,
    );

    if (!response.ok) {
      throw new Error(
        `Telegram sendMessage failed with status ${response.status}`,
      );
    }

    try {
      const body = (await response.json()) as {
        ok?: boolean;
        result?: { message_id?: number };
      };
      const messageId = body.result?.message_id;
      return {
        ok: true,
        skipped: false,
        ...(messageId !== undefined ? { messageId } : {}),
      };
    } catch {
      // Response wasn't parseable JSON — the send itself already succeeded
      // (checked via response.ok above), just without a usable message_id.
      return { ok: true, skipped: false };
    }
  }

  async sendChatAction({
    chatId,
    action,
    token,
  }: TelegramChatActionInput): Promise<TelegramGatewayResult> {
    return this.callTelegramMethod({
      token,
      method: "sendChatAction",
      payload: {
        chat_id: chatId.toString(),
        action,
      },
    });
  }

  async sendMessageDraft({
    chatId,
    text,
    token,
  }: TelegramMessageDraftInput): Promise<TelegramGatewayResult> {
    return this.callTelegramMethod({
      token,
      method: "sendMessageDraft",
      payload: {
        chat_id: chatId.toString(),
        text,
      },
    });
  }

  async editMessageText({
    chatId,
    messageId,
    inlineMessageId,
    reply,
    token,
  }: TelegramEditMessageInput): Promise<TelegramGatewayResult> {
    if (!token) {
      return { ok: false, skipped: true, reason: "missing-token" };
    }

    const response = await this.fetchWithRetry(
      `https://api.telegram.org/bot${token}/editMessageText`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          ...(inlineMessageId
            ? { inline_message_id: inlineMessageId }
            : {
                chat_id: chatId?.toString(),
                message_id: messageId,
              }),
          text: reply.text,
          parse_mode: reply.parseMode,
          disable_web_page_preview: reply.disableWebPagePreview ?? true,
          reply_markup: reply.replyMarkup,
        }),
      },
      HIGH_VOLUME_RETRY_POLICY,
    );

    if (!response.ok) {
      throw new Error(
        `Telegram editMessageText failed with status ${response.status}`,
      );
    }

    return { ok: true, skipped: false };
  }

  async banChatMember({
    chatId,
    userId,
    token,
    untilDate,
  }: TelegramModerationInput): Promise<TelegramGatewayResult> {
    return this.callTelegramMethod({
      token,
      method: "banChatMember",
      payload: {
        chat_id: chatId.toString(),
        user_id: userId.toString(),
        ...(untilDate
          ? { until_date: Math.floor(untilDate.getTime() / 1000) }
          : {}),
      },
    });
  }

  async restrictChatMember({
    chatId,
    userId,
    token,
    untilDate,
  }: TelegramModerationInput): Promise<TelegramGatewayResult> {
    return this.callTelegramMethod({
      token,
      method: "restrictChatMember",
      payload: {
        chat_id: chatId.toString(),
        user_id: userId.toString(),
        permissions: {
          can_send_messages: false,
          can_send_audios: false,
          can_send_documents: false,
          can_send_photos: false,
          can_send_videos: false,
          can_send_video_notes: false,
          can_send_voice_notes: false,
          can_send_polls: false,
          can_send_other_messages: false,
          can_add_web_page_previews: false,
        },
        use_independent_chat_permissions: true,
        ...(untilDate
          ? { until_date: Math.floor(untilDate.getTime() / 1000) }
          : {}),
      },
    });
  }

  async setChatPermissions({
    chatId,
    permissions,
    token,
  }: TelegramSetChatPermissionsInput): Promise<TelegramGatewayResult> {
    return this.callTelegramMethod({
      token,
      method: "setChatPermissions",
      payload: {
        chat_id: chatId.toString(),
        permissions,
      },
    });
  }

  async closeForumTopic({
    chatId,
    messageThreadId,
    token,
  }: TelegramForumTopicInput): Promise<TelegramGatewayResult> {
    return this.callTelegramMethod({
      token,
      method: "closeForumTopic",
      payload: {
        chat_id: chatId.toString(),
        message_thread_id: messageThreadId,
      },
    });
  }

  async unbanChatMember({
    chatId,
    userId,
    token,
    onlyIfBanned,
  }: TelegramRevokeInput): Promise<TelegramGatewayResult> {
    return this.callTelegramMethod({
      token,
      method: "unbanChatMember",
      payload: {
        chat_id: chatId.toString(),
        user_id: userId.toString(),
        only_if_banned: onlyIfBanned ?? true,
      },
    });
  }

  async liftRestrictions({
    chatId,
    userId,
    token,
  }: TelegramRevokeInput): Promise<TelegramGatewayResult> {
    return this.callTelegramMethod({
      token,
      method: "restrictChatMember",
      payload: {
        chat_id: chatId.toString(),
        user_id: userId.toString(),
        permissions: {
          can_send_messages: true,
          can_send_audios: true,
          can_send_documents: true,
          can_send_photos: true,
          can_send_videos: true,
          can_send_video_notes: true,
          can_send_voice_notes: true,
          can_send_polls: true,
          can_send_other_messages: true,
          can_add_web_page_previews: true,
        },
        use_independent_chat_permissions: true,
      },
    });
  }

  async deleteMessage({
    chatId,
    messageId,
    token,
  }: TelegramDeleteMessageInput): Promise<TelegramGatewayResult> {
    return this.callTelegramMethod({
      token,
      method: "deleteMessage",
      payload: {
        chat_id: chatId.toString(),
        message_id: messageId,
      },
    });
  }

  async deleteMessageReaction({
    chatId,
    messageId,
    actor,
    token,
  }: TelegramDeleteMessageReactionInput): Promise<TelegramGatewayResult> {
    return this.callTelegramMethod({
      token,
      method: "deleteMessageReaction",
      payload: {
        chat_id: chatId.toString(),
        message_id: messageId,
        ...reactionActorToPayload(actor),
      },
    });
  }

  async deleteAllMessageReactions({
    chatId,
    actor,
    token,
  }: TelegramDeleteAllMessageReactionsInput): Promise<TelegramGatewayResult> {
    return this.callTelegramMethod({
      token,
      method: "deleteAllMessageReactions",
      payload: {
        chat_id: chatId.toString(),
        ...reactionActorToPayload(actor),
      },
    });
  }

  async sendInvoice({
    chatId,
    title,
    description,
    payload,
    currency,
    amount,
    token,
  }: TelegramInvoiceInput): Promise<TelegramGatewayResult> {
    return this.callTelegramMethod({
      token,
      method: "sendInvoice",
      payload: {
        chat_id: chatId.toString(),
        title,
        description,
        payload,
        currency,
        prices: [{ label: title, amount }],
      },
    });
  }

  async createInvoiceLink({
    title,
    description,
    payload,
    currency,
    amount,
    subscriptionPeriodSeconds,
    token,
  }: TelegramInvoiceLinkInput): Promise<TelegramInvoiceLinkResult> {
    const outcome = await this.callTelegramMethodForResult({
      token,
      method: "createInvoiceLink",
      payload: {
        title,
        description,
        payload,
        currency,
        prices: [{ label: title, amount }],
        ...(subscriptionPeriodSeconds
          ? { subscription_period: subscriptionPeriodSeconds }
          : {}),
      },
    });
    if (!outcome.ok) {
      return outcome;
    }
    return {
      ok: true,
      skipped: false,
      ...(typeof outcome.result === "string" ? { url: outcome.result } : {}),
    };
  }

  async editUserStarSubscription({
    userId,
    telegramPaymentChargeId,
    isCanceled,
    token,
  }: TelegramEditStarSubscriptionInput): Promise<TelegramGatewayResult> {
    return this.callTelegramMethod({
      token,
      method: "editUserStarSubscription",
      payload: {
        user_id: userId.toString(),
        telegram_payment_charge_id: telegramPaymentChargeId,
        is_canceled: isCanceled,
      },
    });
  }

  async answerPreCheckoutQuery({
    preCheckoutQueryId,
    ok,
    errorMessage,
    token,
  }: TelegramPreCheckoutAnswer): Promise<TelegramGatewayResult> {
    return this.callTelegramMethod({
      token,
      method: "answerPreCheckoutQuery",
      payload: {
        pre_checkout_query_id: preCheckoutQueryId,
        ok,
        ...(ok ? {} : { error_message: errorMessage ?? "No disponible" }),
      },
    });
  }

  async answerInlineQuery({
    inlineQueryId,
    results,
    cacheTime,
    token,
  }: TelegramInlineAnswer): Promise<TelegramGatewayResult> {
    return this.callTelegramMethod({
      token,
      method: "answerInlineQuery",
      payload: {
        inline_query_id: inlineQueryId,
        results: results.map((result) => ({
          type: "article",
          id: result.id,
          title: result.title,
          ...(result.description ? { description: result.description } : {}),
          ...(result.thumbnailUrl
            ? { thumbnail_url: result.thumbnailUrl }
            : {}),
          input_message_content: { message_text: result.content },
          ...(result.replyMarkup ? { reply_markup: result.replyMarkup } : {}),
        })),
        cache_time: cacheTime ?? 5,
      },
    });
  }

  async answerGuestQuery({
    guestQueryId,
    text,
    token,
  }: TelegramGuestAnswer): Promise<TelegramGatewayResult> {
    return this.callTelegramMethod({
      token,
      method: "answerGuestQuery",
      payload: {
        guest_query_id: guestQueryId,
        result: {
          type: "article",
          id: `guest:${guestQueryId}`,
          title: "Modryva",
          input_message_content: { message_text: text },
        },
      },
    });
  }

  async pinChatMessage({
    chatId,
    messageId,
    token,
  }: TelegramPinMessageInput): Promise<TelegramGatewayResult> {
    return this.callTelegramMethod({
      token,
      method: "pinChatMessage",
      payload: {
        chat_id: chatId.toString(),
        message_id: messageId,
        disable_notification: true,
      },
    });
  }

  async unpinChatMessage({
    chatId,
    token,
  }: {
    chatId: bigint;
    token: string | undefined;
  }): Promise<TelegramGatewayResult> {
    return this.callTelegramMethod({
      token,
      method: "unpinChatMessage",
      payload: { chat_id: chatId.toString() },
    });
  }

  async setChatTitle({
    chatId,
    text,
    token,
  }: TelegramChatTextInput): Promise<TelegramGatewayResult> {
    return this.callTelegramMethod({
      token,
      method: "setChatTitle",
      payload: { chat_id: chatId.toString(), title: text },
    });
  }

  async setChatDescription({
    chatId,
    text,
    token,
  }: TelegramChatTextInput): Promise<TelegramGatewayResult> {
    return this.callTelegramMethod({
      token,
      method: "setChatDescription",
      payload: { chat_id: chatId.toString(), description: text },
    });
  }

  async promoteChatMember({
    chatId,
    userId,
    customTitle,
    token,
  }: TelegramPromoteInput): Promise<TelegramGatewayResult> {
    const promoted = await this.callTelegramMethod({
      token,
      method: "promoteChatMember",
      payload: {
        chat_id: chatId.toString(),
        user_id: userId.toString(),
        can_delete_messages: true,
        can_restrict_members: true,
        can_invite_users: true,
        can_pin_messages: true,
        can_manage_video_chats: true,
      },
    });

    if (promoted.ok && customTitle) {
      await this.callTelegramMethod({
        token,
        method: "setChatAdministratorCustomTitle",
        payload: {
          chat_id: chatId.toString(),
          user_id: userId.toString(),
          custom_title: customTitle,
        },
      });
    }

    return promoted;
  }

  async demoteChatMember({
    chatId,
    userId,
    token,
  }: TelegramRevokeInput): Promise<TelegramGatewayResult> {
    return this.callTelegramMethod({
      token,
      method: "promoteChatMember",
      payload: {
        chat_id: chatId.toString(),
        user_id: userId.toString(),
        can_change_info: false,
        can_delete_messages: false,
        can_restrict_members: false,
        can_invite_users: false,
        can_pin_messages: false,
        can_promote_members: false,
        can_manage_video_chats: false,
        can_post_messages: false,
        can_edit_messages: false,
      },
    });
  }

  async createChatInviteLink({
    chatId,
    token,
  }: {
    chatId: bigint;
    token: string | undefined;
  }): Promise<TelegramInviteLinkResult> {
    const outcome = await this.callTelegramMethodForResult({
      token,
      method: "createChatInviteLink",
      payload: { chat_id: chatId.toString() },
    });

    if (!outcome.ok) {
      return outcome;
    }

    const link =
      typeof outcome.result === "object" &&
      outcome.result !== null &&
      "invite_link" in outcome.result &&
      typeof (outcome.result as { invite_link: unknown }).invite_link ===
        "string"
        ? (outcome.result as { invite_link: string }).invite_link
        : undefined;

    return { ok: true, skipped: false, ...(link ? { inviteLink: link } : {}) };
  }

  async getChatAdministrators({
    chatId,
    token,
  }: {
    chatId: bigint;
    token: string | undefined;
  }): Promise<TelegramAdminsResult> {
    const outcome = await this.callTelegramMethodForResult({
      token,
      method: "getChatAdministrators",
      payload: { chat_id: chatId.toString() },
    });

    if (!outcome.ok) {
      return outcome;
    }

    const admins = Array.isArray(outcome.result)
      ? outcome.result.flatMap((entry): TelegramChatAdminInfo[] => {
          if (typeof entry !== "object" || entry === null) {
            return [];
          }

          const member = entry as {
            status?: unknown;
            custom_title?: unknown;
            user?: {
              id?: unknown;
              username?: unknown;
              first_name?: unknown;
            };
          };

          if (typeof member.user?.id !== "number") {
            return [];
          }

          return [
            {
              userId: BigInt(member.user.id),
              username:
                typeof member.user.username === "string"
                  ? member.user.username
                  : undefined,
              firstName:
                typeof member.user.first_name === "string"
                  ? member.user.first_name
                  : undefined,
              isOwner: member.status === "creator",
              customTitle:
                typeof member.custom_title === "string"
                  ? member.custom_title
                  : undefined,
            },
          ];
        })
      : [];

    return { ok: true, skipped: false, admins };
  }

  async getChat({
    chatId,
    token,
  }: {
    chatId: bigint;
    token: string | undefined;
  }): Promise<TelegramChatResult> {
    const outcome = await this.callTelegramMethodForResult({
      token,
      method: "getChat",
      payload: { chat_id: chatId.toString() },
    });

    if (!outcome.ok) {
      return outcome;
    }

    const chat =
      typeof outcome.result === "object" && outcome.result !== null
        ? (outcome.result as {
            id?: unknown;
            type?: unknown;
            title?: unknown;
            username?: unknown;
            first_name?: unknown;
            last_name?: unknown;
            guard_bot?: unknown;
          })
        : undefined;

    const id =
      typeof chat?.id === "number" || typeof chat?.id === "bigint"
        ? BigInt(chat.id)
        : undefined;

    return {
      ok: true,
      skipped: false,
      chat: {
        chatId: id,
        type: typeof chat?.type === "string" ? chat.type : undefined,
        title: typeof chat?.title === "string" ? chat.title : undefined,
        username:
          typeof chat?.username === "string" ? chat.username : undefined,
        ...(typeof chat?.first_name === "string"
          ? { firstName: chat.first_name }
          : {}),
        ...(typeof chat?.last_name === "string"
          ? { lastName: chat.last_name }
          : {}),
        ...(typeof chat?.guard_bot === "boolean"
          ? { guardBot: chat.guard_bot }
          : {}),
      },
    };
  }

  /** The bot's own identity (display name + @username) for the given token. */
  async getMe({
    token,
  }: {
    token: string | undefined;
  }): Promise<TelegramGetMeResult> {
    const outcome = await this.callTelegramMethodForResult({
      token,
      method: "getMe",
      payload: {},
    });
    if (!outcome.ok) {
      return {
        ok: false,
        skipped: outcome.skipped,
        ...(outcome.reason ? { reason: outcome.reason } : {}),
      };
    }
    const me = outcome.result as
      | {
          id?: unknown;
          first_name?: unknown;
          username?: unknown;
          supports_guest_queries?: unknown;
          supports_join_request_queries?: unknown;
        }
      | undefined;
    return {
      ok: true,
      skipped: false,
      botUserId:
        typeof me?.id === "number" || typeof me?.id === "bigint"
          ? BigInt(me.id)
          : undefined,
      name: typeof me?.first_name === "string" ? me.first_name : undefined,
      username: typeof me?.username === "string" ? me.username : undefined,
      supportsGuestQueries:
        typeof me?.supports_guest_queries === "boolean"
          ? me.supports_guest_queries
          : undefined,
      supportsJoinRequestQueries:
        typeof me?.supports_join_request_queries === "boolean"
          ? me.supports_join_request_queries
          : undefined,
    };
  }

  async sendDice({
    chatId,
    emoji,
    token,
  }: TelegramDiceInput): Promise<TelegramDiceResult> {
    const outcome = await this.callTelegramMethodForResult({
      token,
      method: "sendDice",
      payload: { chat_id: chatId.toString(), emoji },
    });
    if (!outcome.ok) {
      return outcome;
    }
    const dice = (outcome.result as { dice?: { value?: unknown } } | undefined)
      ?.dice;
    const value = typeof dice?.value === "number" ? dice.value : undefined;
    return {
      ok: true,
      skipped: false,
      ...(value !== undefined ? { value } : {}),
    };
  }

  async answerCallbackQuery({
    callbackQueryId,
    text,
    token,
    showAlert,
  }: TelegramCallbackAnswerInput): Promise<TelegramGatewayResult> {
    return this.callTelegramMethod({
      token,
      method: "answerCallbackQuery",
      payload: {
        callback_query_id: callbackQueryId,
        ...(text ? { text } : {}),
        ...(showAlert ? { show_alert: true } : {}),
      },
    });
  }

  async editMessageReplyMarkup({
    chatId,
    messageId,
    replyMarkup,
    token,
  }: {
    chatId: bigint;
    messageId: number;
    replyMarkup: Record<string, unknown>;
    token: string | undefined;
  }): Promise<TelegramGatewayResult> {
    return this.callTelegramMethod({
      token,
      method: "editMessageReplyMarkup",
      payload: {
        chat_id: chatId.toString(),
        message_id: messageId,
        reply_markup: replyMarkup,
      },
    });
  }

  async approveChatJoinRequest({
    chatId,
    userId,
    token,
  }: TelegramRevokeInput): Promise<TelegramGatewayResult> {
    return this.callTelegramMethod({
      token,
      method: "approveChatJoinRequest",
      payload: { chat_id: chatId.toString(), user_id: userId.toString() },
    });
  }

  async declineChatJoinRequest({
    chatId,
    userId,
    token,
  }: TelegramRevokeInput): Promise<TelegramGatewayResult> {
    return this.callTelegramMethod({
      token,
      method: "declineChatJoinRequest",
      payload: { chat_id: chatId.toString(), user_id: userId.toString() },
    });
  }

  async sendChatJoinRequestWebApp({
    chatJoinRequestQueryId,
    webAppUrl,
    token,
  }: TelegramSendJoinRequestWebAppInput): Promise<TelegramGatewayResult> {
    return this.callTelegramMethod({
      token,
      method: "sendChatJoinRequestWebApp",
      payload: {
        chat_join_request_query_id: chatJoinRequestQueryId,
        // Bot API 10.1 takes a flat `web_app_url` STRING here — NOT a
        // `web_app: { url }` object like inline-keyboard buttons. Verified
        // against live Telegram: the object shape is rejected with 400
        // `parameter "web_app_url" is required`, so the query goes unanswered
        // and the user sees "the admin bot can't process the join request".
        web_app_url: webAppUrl,
      },
    });
  }

  async answerChatJoinRequestQuery({
    chatJoinRequestQueryId,
    result,
    token,
  }: TelegramAnswerJoinRequestQueryInput): Promise<TelegramGatewayResult> {
    return this.callTelegramMethod({
      token,
      method: "answerChatJoinRequestQuery",
      payload: {
        chat_join_request_query_id: chatJoinRequestQueryId,
        result,
      },
    });
  }

  async sendSticker(input: TelegramMediaInput): Promise<TelegramGatewayResult> {
    return this.uploadMedia(input, "sendSticker", "sticker");
  }

  async sendPhoto(
    input: TelegramMediaInput,
  ): Promise<TelegramSendMessageResult> {
    return this.uploadMedia(input, "sendPhoto", "photo");
  }

  private async uploadMedia(
    {
      chatId,
      imageBase64,
      type,
      token,
      caption,
      replyMarkup,
      protectContent,
    }: TelegramMediaInput,
    method: string,
    field: string,
  ): Promise<TelegramSendMessageResult> {
    if (!token) {
      return { ok: false, skipped: true, reason: "missing-token" };
    }

    const bytes = Buffer.from(imageBase64, "base64");
    const mime =
      type === "png"
        ? "image/png"
        : type === "jpg"
          ? "image/jpeg"
          : "image/webp";
    const form = new FormData();
    form.append("chat_id", chatId.toString());
    form.append(field, new Blob([bytes], { type: mime }), `quote.${type}`);
    if (caption !== undefined) {
      form.append("caption", caption);
    }
    if (replyMarkup !== undefined) {
      form.append("reply_markup", JSON.stringify(replyMarkup));
    }
    if (protectContent) {
      form.append("protect_content", "true");
    }

    const response = await this.fetchWithRetry(
      `https://api.telegram.org/bot${token}/${method}`,
      { method: "POST", body: form },
      HIGH_VOLUME_RETRY_POLICY,
    );

    if (!response.ok) {
      throw new Error(
        `Telegram ${method} failed with status ${response.status}`,
      );
    }

    try {
      const body = (await response.json()) as {
        ok?: boolean;
        result?: { message_id?: number };
      };
      const messageId = body.result?.message_id;
      return {
        ok: true,
        skipped: false,
        ...(messageId !== undefined ? { messageId } : {}),
      };
    } catch {
      // Send already succeeded (response.ok above) — just no usable message_id.
      return { ok: true, skipped: false };
    }
  }

  async getChatMember({
    chatId,
    userId,
    token,
  }: {
    chatId: bigint;
    userId: bigint;
    token: string | undefined;
  }): Promise<TelegramChatMemberResult> {
    // A getChatMember lookup can fail (400/403/timeout/429-exhausted). Callers
    // must be able to distinguish "definitely can't delete" (false) from "we
    // don't know" (undefined) WITHOUT catching exceptions, so a failure resolves
    // to { ok: false } (no status, canDeleteMessages absent -> undefined) rather
    // than throwing. Lenient by design: never treat a lookup error as proof.
    let outcome: TelegramGatewayResult & { result?: unknown };
    try {
      outcome = await this.callTelegramMethodForResult({
        token,
        method: "getChatMember",
        payload: { chat_id: chatId.toString(), user_id: userId.toString() },
      });
    } catch {
      return { ok: false, skipped: false };
    }

    if (!outcome.ok) {
      return outcome;
    }

    const member =
      typeof outcome.result === "object" && outcome.result !== null
        ? (outcome.result as {
            status?: unknown;
            can_delete_messages?: unknown;
          })
        : {};
    const status =
      typeof member.status === "string" ? member.status : undefined;
    // Tri-state can_delete_messages for the bot's OWN rights:
    //  - creator/owner        -> true  (can always delete)
    //  - administrator        -> the explicit flag (true/false); a missing flag
    //                            is an incomplete response -> undefined (unknown)
    //  - member/restricted/
    //    left/kicked          -> false (definitively cannot delete)
    //  - unknown/missing status or non-ok response -> undefined (unknown)
    // The caller treats undefined as "don't act, don't cry missing-permission".
    const canDeleteMessages: boolean | undefined = (() => {
      switch (status) {
        case "creator":
          return true;
        case "administrator":
          return typeof member.can_delete_messages === "boolean"
            ? member.can_delete_messages
            : undefined;
        case "member":
        case "restricted":
        case "left":
        case "kicked":
          return false;
        default:
          return undefined;
      }
    })();

    return {
      ok: true,
      skipped: false,
      ...(status ? { status } : {}),
      ...(canDeleteMessages !== undefined ? { canDeleteMessages } : {}),
    };
  }

  async setChatMenuButton(input: {
    url: string;
    text: string;
    token: string | undefined;
  }): Promise<TelegramGatewayResult> {
    // No chat_id -> sets the DEFAULT menu button for all private chats.
    return this.callTelegramMethod({
      token: input.token,
      method: "setChatMenuButton",
      payload: {
        menu_button: {
          type: "web_app",
          text: input.text,
          web_app: { url: input.url },
        },
      },
    });
  }

  async setMyCommands(input: {
    commands: readonly { command: string; description: string }[];
    token: string | undefined;
  }): Promise<TelegramGatewayResult> {
    return this.callTelegramMethod({
      token: input.token,
      method: "setMyCommands",
      payload: { commands: input.commands },
    });
  }

  async setMyDescription(input: {
    description: string;
    token: string | undefined;
  }): Promise<TelegramGatewayResult> {
    return this.callTelegramMethod({
      token: input.token,
      method: "setMyDescription",
      payload: { description: input.description },
    });
  }

  async setMyShortDescription(input: {
    shortDescription: string;
    token: string | undefined;
  }): Promise<TelegramGatewayResult> {
    return this.callTelegramMethod({
      token: input.token,
      method: "setMyShortDescription",
      payload: { short_description: input.shortDescription },
    });
  }

  private async callTelegramMethod(input: {
    readonly token: string | undefined;
    readonly method: string;
    readonly payload: Record<string, unknown>;
  }): Promise<TelegramGatewayResult> {
    if (!input.token) {
      return { ok: false, skipped: true, reason: "missing-token" };
    }

    const response = await this.fetchWithRetry(
      `https://api.telegram.org/bot${input.token}/${input.method}`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(input.payload),
      },
      HIGH_VOLUME_RETRY_POLICY,
    );

    if (!response.ok) {
      // Surface Telegram's own error description (e.g. a malformed-parameter
      // 400) rather than a bare status code. A silent best-effort catch
      // upstream would otherwise hide the real cause — this is what masked the
      // Guardian `web_app_url` shape bug. Body may not be JSON on some errors.
      const description = await response
        .json()
        .then((body) => (body as { description?: string }).description)
        .catch(() => undefined);
      throw new Error(
        `Telegram ${input.method} failed with status ${response.status}${
          description ? `: ${description}` : ""
        }`,
      );
    }

    return { ok: true, skipped: false };
  }

  private async callTelegramMethodForResult(input: {
    readonly token: string | undefined;
    readonly method: string;
    readonly payload: Record<string, unknown>;
  }): Promise<TelegramGatewayResult & { result?: unknown }> {
    if (!input.token) {
      return { ok: false, skipped: true, reason: "missing-token" };
    }

    const response = await this.fetchWithRetry(
      `https://api.telegram.org/bot${input.token}/${input.method}`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(input.payload),
      },
      HIGH_VOLUME_RETRY_POLICY,
    );

    if (!response.ok) {
      throw new Error(
        `Telegram ${input.method} failed with status ${response.status}`,
      );
    }

    try {
      const body = (await response.json()) as { ok?: unknown; result?: unknown };
      return { ok: true, skipped: false, result: body.result };
    } catch {
      // A 2xx whose body isn't parseable JSON (Telegram or an intermediary proxy
      // returning success with an empty/garbled body). response.ok already
      // confirmed the call itself succeeded, so degrade to success-without-result
      // exactly like sendMessage/getChatMember do — never throw. Throwing here was
      // caught by callers like sendDice as if the whole action had FAILED, so a
      // dice roll that Telegram actually launched got the stake refunded and the
      // user told the animation "could not be launched".
      return { ok: true, skipped: false };
    }
  }
}
