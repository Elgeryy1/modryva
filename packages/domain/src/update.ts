export type TelegramUpdateKind =
  | "message"
  | "edited_message"
  | "callback_query"
  | "inline_query"
  | "guest_message"
  | "join_request"
  | "managed_bot"
  | "my_chat_member"
  | "chat_member"
  | "message_reaction"
  | "unknown";

/**
 * The bot's own membership change in a chat (Telegram `my_chat_member`). `byUserId`
 * is the admin who added/promoted the bot; `added` is true only on a fresh add.
 */
export interface BotMembershipContext {
  readonly status: string;
  readonly chatId: bigint | undefined;
  readonly byUserId: bigint | undefined;
  readonly added: boolean;
  readonly promotedToAdmin: boolean;
}

/**
 * Someone ELSE's membership change in a chat (Telegram `chat_member`) — only
 * delivered when the bot is an admin there and `chat_member` is in
 * `allowed_updates`. Lets the cross-group membership gate react the moment a
 * person leaves/is removed from a required chat, instead of waiting for them
 * to post in the gated chat.
 */
export interface ChatMemberUpdateContext {
  readonly chatId: bigint | undefined;
  readonly telegramUserId: bigint | undefined;
  readonly oldStatus: string | undefined;
  readonly newStatus: string | undefined;
}

/**
 * A single reaction normalized from Telegram's `ReactionType`. Standard emoji
 * or a custom-emoji id — both kept so moderation can match either. `paid` and
 * unknown reaction types are dropped (nothing to moderate).
 */
export type NormalizedReaction =
  | { readonly type: "emoji"; readonly emoji: string }
  | { readonly type: "custom_emoji"; readonly customEmojiId: string };

/**
 * A native Telegram message reaction change (`message_reaction`), delivered
 * only when the bot is admin and `message_reaction` is in `allowed_updates`.
 * `emojisAdded`/`reactionsAdded` are the reactions newly present versus the
 * prior state (so a removed/unchanged reaction contributes nothing).
 */
export interface ReactionContext {
  readonly chatId: bigint | undefined;
  readonly messageId: number | undefined;
  /** The user who reacted (absent when a channel reacts as `actorChatId`). */
  readonly userId: bigint | undefined;
  /** A channel acting as the reactor (Telegram `actor_chat`), when present. */
  readonly actorChatId: bigint | undefined;
  /**
   * Standard-emoji subset of `reactionsAdded` — kept for the existing
   * activity-log attribution (back-compat).
   */
  readonly emojisAdded: readonly string[];
  /**
   * ALL reactions newly present vs the prior state, incl. custom_emoji, for
   * moderation. `emojisAdded` is the emoji-only subset of this.
   */
  readonly reactionsAdded: readonly NormalizedReaction[];
}

export interface ChatContext {
  readonly chatId: bigint | undefined;
  readonly chatType: string | undefined;
  /** Group/supergroup/channel title (absent for private chats and most fixtures). */
  readonly chatTitle?: string;
  readonly topicId: number | undefined;
}

export interface UserContext {
  readonly userId: bigint | undefined;
  readonly username: string | undefined;
  /** Telegram first name — used as the display name when there is no @username. */
  readonly firstName?: string;
  readonly languageCode: string | undefined;
}

export interface NormalizedCommand {
  readonly name: string;
  readonly raw: string;
  readonly args: readonly string[];
  readonly alias?: string;
}

export interface MessageContentFlags {
  readonly hasText: boolean;
  readonly hasUrl: boolean;
  readonly hasMention: boolean;
  readonly isForward: boolean;
  readonly viaBot: boolean;
  readonly hasPhoto: boolean;
  readonly hasVideo: boolean;
  readonly hasAnimation: boolean;
  readonly hasSticker: boolean;
  readonly hasAudio: boolean;
  readonly hasVoice: boolean;
  readonly hasDocument: boolean;
  readonly hasContact: boolean;
  readonly hasLocation: boolean;
  readonly hasPoll: boolean;
}

export type AttachmentKind =
  | "document"
  | "photo"
  | "video"
  | "audio"
  | "voice"
  | "animation";

export interface MessageAttachment {
  readonly kind: AttachmentKind;
  readonly fileId: string;
  readonly fileUniqueId: string;
  readonly mimeType: string | undefined;
  readonly fileSize: number | undefined;
  readonly fileName: string | undefined;
}

export interface PreCheckoutContext {
  readonly id: string;
  readonly payload: string;
  readonly currency: string;
  readonly totalAmount: number;
}

export interface SuccessfulPaymentContext {
  readonly chargeId: string;
  readonly payload: string;
  readonly currency: string;
  readonly totalAmount: number;
  readonly isRecurring: boolean;
  readonly isFirstRecurring: boolean;
  readonly subscriptionExpirationDate: Date | undefined;
}

export interface InlineQueryContext {
  readonly id: string;
  readonly query: string;
}

export interface GuestMessageContext {
  readonly queryId: string;
}

/**
 * Extra `chat_join_request` fields not covered by the generic chat/user
 * context. `queryId` (Bot API 10.1 Guardian Bots / join request queries) is
 * only present when the request can be answered via
 * sendChatJoinRequestWebApp + answerChatJoinRequestQuery.
 */
export interface JoinRequestContext {
  readonly queryId: string | undefined;
  readonly userChatId: bigint | undefined;
  readonly lastName: string | undefined;
  readonly inviteLinkName: string | undefined;
}

export interface ManagedBotContext {
  readonly ownerUserId: bigint | undefined;
  readonly botUserId: bigint | undefined;
  readonly username: string | undefined;
  readonly firstName: string | undefined;
}

export interface TelegramUpdateEnvelope {
  readonly updateId: number;
  readonly kind: TelegramUpdateKind;
  readonly receivedAt: Date;
  readonly chat: ChatContext;
  readonly user: UserContext;
  readonly command: NormalizedCommand | undefined;
  readonly callbackData: string | undefined;
  readonly callbackInlineMessageId?: string | undefined;
  readonly callbackChatInstance?: string | undefined;
  readonly messageText: string | undefined;
  readonly content: MessageContentFlags;
  readonly attachment: MessageAttachment | undefined;
  readonly preCheckout: PreCheckoutContext | undefined;
  readonly successfulPayment: SuccessfulPaymentContext | undefined;
  readonly inlineQuery: InlineQueryContext | undefined;
  readonly guestMessage?: GuestMessageContext | undefined;
  readonly joinRequest?: JoinRequestContext | undefined;
  readonly managedBot?: ManagedBotContext;
  readonly messageId: number | undefined;
  readonly newChatMemberIds: readonly bigint[];
  readonly leftChatMemberId?: bigint;
  readonly leftChatMember?: UserContext;
  readonly botMembership?: BotMembershipContext;
  readonly chatMemberUpdate?: ChatMemberUpdateContext;
  readonly reaction?: ReactionContext;
  readonly isTextMessage: boolean;
  readonly raw: unknown;
}

export interface UpdateDispatchResult {
  readonly accepted: boolean;
  readonly handledBy?: string;
  readonly queuedJobId?: string;
  readonly responseText?: string;
}
