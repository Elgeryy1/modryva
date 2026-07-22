import type {
  MessageAttachment,
  MessageContentFlags,
  NormalizedCommand,
  NormalizedReaction,
  ReactionContext,
  TelegramUpdateEnvelope,
  UserContext,
} from "@superbot/domain";
import { parseTelegramCommand } from "./parse-command.js";

type TelegramFile = {
  file_id?: string;
  file_unique_id?: string;
  mime_type?: string;
  file_size?: number;
  file_name?: string;
};

const extractAttachment = (
  message: TelegramMessage | undefined,
): MessageAttachment | undefined => {
  if (!message) {
    return undefined;
  }

  const sources: Array<[MessageAttachment["kind"], TelegramFile | undefined]> =
    [
      ["document", message.document as TelegramFile | undefined],
      ["video", message.video as TelegramFile | undefined],
      ["animation", message.animation as TelegramFile | undefined],
      ["audio", message.audio as TelegramFile | undefined],
      ["voice", message.voice as TelegramFile | undefined],
    ];

  for (const [kind, file] of sources) {
    if (file?.file_id && file.file_unique_id) {
      return {
        kind,
        fileId: file.file_id,
        fileUniqueId: file.file_unique_id,
        mimeType: file.mime_type,
        fileSize: file.file_size,
        fileName: file.file_name,
      };
    }
  }

  const photos = message.photo as TelegramFile[] | undefined;
  const largest = photos?.[photos.length - 1];
  if (largest?.file_id && largest.file_unique_id) {
    return {
      kind: "photo",
      fileId: largest.file_id,
      fileUniqueId: largest.file_unique_id,
      mimeType: "image/jpeg",
      fileSize: largest.file_size,
      fileName: undefined,
    };
  }

  return undefined;
};

const emptyContentFlags: MessageContentFlags = {
  hasText: false,
  hasUrl: false,
  hasMention: false,
  isForward: false,
  viaBot: false,
  hasPhoto: false,
  hasVideo: false,
  hasAnimation: false,
  hasSticker: false,
  hasAudio: false,
  hasVoice: false,
  hasDocument: false,
  hasContact: false,
  hasLocation: false,
  hasPoll: false,
};

const extractContentFlags = (
  message: TelegramMessage | undefined,
): MessageContentFlags => {
  if (!message) {
    return emptyContentFlags;
  }

  const entities = [
    ...(message.entities ?? []),
    ...(message.caption_entities ?? []),
  ];
  const hasUrl = entities.some(
    (entity) => entity.type === "url" || entity.type === "text_link",
  );
  const hasMention = entities.some(
    (entity) => entity.type === "mention" || entity.type === "text_mention",
  );

  return {
    hasText: Boolean(message.text ?? message.caption),
    hasUrl,
    hasMention,
    isForward: Boolean(
      message.forward_origin ??
        message.forward_from ??
        message.forward_from_chat,
    ),
    viaBot: Boolean(message.via_bot),
    hasPhoto: Array.isArray(message.photo) && message.photo.length > 0,
    hasVideo: Boolean(message.video),
    hasAnimation: Boolean(message.animation),
    hasSticker: Boolean(message.sticker),
    hasAudio: Boolean(message.audio),
    hasVoice: Boolean(message.voice),
    hasDocument: Boolean(message.document),
    hasContact: Boolean(message.contact),
    hasLocation: Boolean(message.location),
    hasPoll: Boolean(message.poll),
  };
};

type TelegramMember = {
  id: number;
  username?: string;
  first_name?: string;
  is_bot?: boolean;
  language_code?: string;
};

type TelegramEntity = { type?: string };

type TelegramMessage = {
  message_id: number;
  date: number;
  text?: string;
  guest_query_id?: string;
  caption?: string;
  entities?: TelegramEntity[];
  caption_entities?: TelegramEntity[];
  chat?: { id: number; type?: string; title?: string };
  from?: {
    id: number;
    username?: string;
    first_name?: string;
    language_code?: string;
  };
  message_thread_id?: number;
  new_chat_members?: TelegramMember[];
  left_chat_member?: TelegramMember;
  forward_origin?: unknown;
  forward_from?: unknown;
  forward_from_chat?: unknown;
  via_bot?: unknown;
  photo?: unknown[];
  video?: unknown;
  animation?: unknown;
  sticker?: unknown;
  audio?: unknown;
  voice?: unknown;
  document?: unknown;
  contact?: unknown;
  location?: unknown;
  poll?: unknown;
  managed_bot_created?: { bot?: TelegramMember & { first_name?: string } };
};

type TelegramCallbackQuery = {
  id: string;
  data?: string;
  inline_message_id?: string;
  chat_instance?: string;
  from?: {
    id: number;
    username?: string;
    first_name?: string;
    language_code?: string;
  };
  message?: TelegramMessage;
};

type TelegramPreCheckout = {
  id?: string;
  invoice_payload?: string;
  currency?: string;
  total_amount?: number;
};

type TelegramSuccessfulPayment = {
  telegram_payment_charge_id?: string;
  invoice_payload?: string;
  currency?: string;
  total_amount?: number;
  is_recurring?: boolean;
  is_first_recurring?: boolean;
  subscription_expiration_date?: number;
};

type TelegramJoinRequest = {
  chat?: { id: number; type?: string; title?: string };
  from?: {
    id: number;
    username?: string;
    first_name?: string;
    last_name?: string;
    language_code?: string;
  };
  // Bot API 6.0+: the private chat id with the requester, usable to DM them.
  user_chat_id?: number;
  // Bot API 10.1 (Guardian Bots / join request queries): present when the
  // request can be answered interactively via sendChatJoinRequestWebApp +
  // answerChatJoinRequestQuery instead of only approve/declineChatJoinRequest.
  query_id?: string;
  invite_link?: { name?: string; invite_link?: string };
};

type TelegramChatMemberInfo = { status?: string; user?: TelegramMember };

type TelegramMyChatMember = {
  chat?: { id: number; type?: string; title?: string };
  from?: {
    id: number;
    username?: string;
    first_name?: string;
    language_code?: string;
  };
  old_chat_member?: TelegramChatMemberInfo;
  new_chat_member?: TelegramChatMemberInfo;
};

type TelegramUpdate = {
  update_id: number;
  message?: TelegramMessage & {
    successful_payment?: TelegramSuccessfulPayment;
  };
  guest_message?: TelegramMessage;
  edited_message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
  inline_query?: {
    id?: string;
    query?: string;
    from?: {
      id?: number;
      username?: string;
      first_name?: string;
      language_code?: string;
    };
  };
  chat_join_request?: TelegramJoinRequest;
  managed_bot?: {
    user?: {
      id: number;
      username?: string;
      first_name?: string;
      language_code?: string;
    };
    bot?: TelegramMember & { first_name?: string };
  };
  my_chat_member?: TelegramMyChatMember;
  chat_member?: TelegramMyChatMember;
  pre_checkout_query?: TelegramPreCheckout;
  message_reaction?: {
    chat?: { id?: number; type?: string };
    message_id?: number;
    user?: { id?: number; username?: string };
    actor_chat?: { id?: number };
    old_reaction?: {
      type?: string;
      emoji?: string;
      custom_emoji_id?: string;
    }[];
    new_reaction?: {
      type?: string;
      emoji?: string;
      custom_emoji_id?: string;
    }[];
  };
};

const toBigIntId = (value: number | string | undefined): bigint | undefined =>
  value === undefined ? undefined : BigInt(value);

const sameTelegramUsername = (
  left: string | undefined,
  right: string | undefined,
): boolean =>
  left !== undefined &&
  right !== undefined &&
  left.replace(/^@/u, "").toLowerCase() ===
    right.replace(/^@/u, "").toLowerCase();

const userContextFromMember = (
  member: TelegramMember | undefined,
): UserContext | undefined =>
  member
    ? {
        userId: BigInt(member.id),
        username: member.username,
        ...(member.first_name !== undefined
          ? { firstName: member.first_name }
          : {}),
        languageCode: member.language_code,
      }
    : undefined;

const normalizeCommand = (
  text: string | undefined,
  botUsername?: string,
): NormalizedCommand | undefined => {
  if (!text) {
    return undefined;
  }

  const command = parseTelegramCommand(text, botUsername);

  if (!command) {
    return undefined;
  }

  return command;
};

/**
 * Maps a raw Telegram reaction list to {@link NormalizedReaction}s, keeping both
 * standard emoji and custom_emoji (so moderation can match either). Unknown or
 * `paid` reaction types are dropped.
 */
const normalizedReactions = (
  list:
    | { type?: string; emoji?: string; custom_emoji_id?: string }[]
    | undefined,
): NormalizedReaction[] => {
  const out: NormalizedReaction[] = [];
  for (const item of list ?? []) {
    if (item.type === "emoji" && typeof item.emoji === "string") {
      out.push({ type: "emoji", emoji: item.emoji });
    } else if (
      item.type === "custom_emoji" &&
      typeof item.custom_emoji_id === "string"
    ) {
      out.push({ type: "custom_emoji", customEmojiId: item.custom_emoji_id });
    }
  }
  return out;
};

/** Stable identity for a reaction, so new-vs-old diffs dedupe correctly. */
const reactionKey = (reaction: NormalizedReaction): string =>
  reaction.type === "emoji"
    ? `e:${reaction.emoji}`
    : `c:${reaction.customEmojiId}`;

export const normalizeUpdate = (
  update: TelegramUpdate,
  botUsername?: string,
): TelegramUpdateEnvelope => {
  // The webhook body reaches here as `unknown` from @Body(): a literal `null`,
  // array, string or number would make the property access below throw a
  // TypeError — a 500 on the one Telegram-facing surface not fed exclusively by
  // Telegram's own well-formed payloads. Degrade any non-object to the same
  // "unknown" envelope an empty update produces (the {} recurses exactly once,
  // since {} is itself a valid object).
  if (typeof update !== "object" || update === null) {
    return normalizeUpdate({} as TelegramUpdate, botUsername);
  }
  const message =
    update.message ?? update.guest_message ?? update.edited_message;
  // Bot API 10.0 documents `guest_query_id` as a field of the Message object
  // itself, not exclusively of a separate `guest_message` envelope key — a
  // guest interaction may arrive as a populated `update.message` that simply
  // carries `guest_query_id`. Check both shapes so neither is silently missed.
  const guestQueryId =
    update.guest_message?.guest_query_id ?? update.message?.guest_query_id;
  const callback = update.callback_query;
  const inlineQueryUpdate = update.inline_query;
  const joinRequest = update.chat_join_request;
  const managedBot = update.managed_bot;
  const myMember = update.my_chat_member;
  const chatMember = update.chat_member;
  const reactionUpdate = update.message_reaction;
  const reactionContext = reactionUpdate
    ? ((): ReactionContext => {
        const oldKeys = new Set(
          normalizedReactions(reactionUpdate.old_reaction).map(reactionKey),
        );
        const reactionsAdded = normalizedReactions(
          reactionUpdate.new_reaction,
        ).filter((reaction) => !oldKeys.has(reactionKey(reaction)));
        return {
          chatId: toBigIntId(reactionUpdate.chat?.id),
          messageId: reactionUpdate.message_id,
          userId: toBigIntId(reactionUpdate.user?.id),
          actorChatId: toBigIntId(reactionUpdate.actor_chat?.id),
          emojisAdded: reactionsAdded.flatMap((reaction) =>
            reaction.type === "emoji" ? [reaction.emoji] : [],
          ),
          reactionsAdded,
        };
      })()
    : undefined;
  const rawText = message?.text ?? callback?.data ?? undefined;
  const command = normalizeCommand(rawText, botUsername);
  const newChatMemberIds = (message?.new_chat_members ?? [])
    .filter((member) => !member.is_bot)
    .map((member) => BigInt(member.id));

  const leftMember = message?.left_chat_member;
  const leftMemberIsBot =
    Boolean(leftMember?.is_bot) ||
    sameTelegramUsername(leftMember?.username, botUsername);
  const leftChatMemberId =
    leftMember && !leftMemberIsBot ? BigInt(leftMember.id) : undefined;
  const leftChatMember =
    leftMember && !leftMemberIsBot
      ? userContextFromMember(leftMember)
      : undefined;

  // my_chat_member reports the bot's OWN membership changes: `from` is the admin
  // who added/promoted it, `new_chat_member.user` is the bot itself.
  let botMembership:
    | {
        status: string;
        chatId: bigint | undefined;
        byUserId: bigint | undefined;
        added: boolean;
        promotedToAdmin: boolean;
      }
    | undefined;
  if (myMember?.new_chat_member) {
    const newStatus = myMember.new_chat_member.status ?? "";
    const oldStatus = myMember.old_chat_member?.status;
    const activeNow =
      newStatus === "member" ||
      newStatus === "administrator" ||
      newStatus === "creator";
    const wasInactive =
      oldStatus === undefined || oldStatus === "left" || oldStatus === "kicked";
    botMembership = {
      status: newStatus,
      chatId: toBigIntId(myMember.chat?.id),
      byUserId: toBigIntId(myMember.from?.id),
      added: activeNow && wasInactive,
      promotedToAdmin: newStatus === "administrator",
    };
  }

  // chat_member reports ANOTHER member's status change (bot must be admin +
  // subscribed via allowed_updates) — unlike my_chat_member, the affected user
  // is new_chat_member.user, not necessarily the one who triggered the change.
  const chatMemberUpdate = chatMember?.new_chat_member
    ? {
        chatId: toBigIntId(chatMember.chat?.id),
        telegramUserId: toBigIntId(chatMember.new_chat_member.user?.id),
        oldStatus: chatMember.old_chat_member?.status,
        newStatus: chatMember.new_chat_member.status,
      }
    : undefined;

  const chatTitle =
    message?.chat?.title ??
    callback?.message?.chat?.title ??
    joinRequest?.chat?.title ??
    myMember?.chat?.title;

  const firstName =
    message?.from?.first_name ??
    callback?.from?.first_name ??
    joinRequest?.from?.first_name ??
    managedBot?.user?.first_name ??
    myMember?.from?.first_name ??
    inlineQueryUpdate?.from?.first_name;

  const managedBotContext =
    (managedBot?.bot ?? message?.managed_bot_created?.bot)
      ? {
          ownerUserId: toBigIntId(managedBot?.user?.id ?? message?.from?.id),
          botUserId: toBigIntId(
            managedBot?.bot?.id ?? message?.managed_bot_created?.bot?.id,
          ),
          username:
            managedBot?.bot?.username ??
            message?.managed_bot_created?.bot?.username,
          firstName:
            managedBot?.bot?.first_name ??
            message?.managed_bot_created?.bot?.first_name,
        }
      : undefined;

  return {
    updateId: update.update_id,
    kind: guestQueryId
      ? "guest_message"
      : update.message
        ? "message"
        : update.edited_message
          ? "edited_message"
          : update.callback_query
            ? "callback_query"
            : update.inline_query
              ? "inline_query"
              : update.chat_join_request
                ? "join_request"
                : update.managed_bot
                  ? "managed_bot"
                  : update.my_chat_member
                    ? "my_chat_member"
                    : update.chat_member
                      ? "chat_member"
                      : update.message_reaction
                        ? "message_reaction"
                        : "unknown",
    receivedAt: new Date(),
    chat: {
      chatId: toBigIntId(
        message?.chat?.id ??
          callback?.message?.chat?.id ??
          joinRequest?.chat?.id ??
          myMember?.chat?.id ??
          chatMember?.chat?.id ??
          reactionUpdate?.chat?.id,
      ),
      chatType:
        message?.chat?.type ??
        callback?.message?.chat?.type ??
        joinRequest?.chat?.type ??
        myMember?.chat?.type ??
        chatMember?.chat?.type ??
        reactionUpdate?.chat?.type,
      ...(chatTitle !== undefined ? { chatTitle } : {}),
      topicId: message?.message_thread_id,
    },
    user: {
      userId: toBigIntId(
        message?.from?.id ??
          callback?.from?.id ??
          joinRequest?.from?.id ??
          managedBot?.user?.id ??
          myMember?.from?.id ??
          inlineQueryUpdate?.from?.id,
      ),
      username:
        message?.from?.username ??
        callback?.from?.username ??
        joinRequest?.from?.username ??
        managedBot?.user?.username ??
        myMember?.from?.username ??
        inlineQueryUpdate?.from?.username,
      ...(firstName !== undefined ? { firstName } : {}),
      languageCode:
        message?.from?.language_code ??
        callback?.from?.language_code ??
        joinRequest?.from?.language_code ??
        managedBot?.user?.language_code ??
        inlineQueryUpdate?.from?.language_code ??
        myMember?.from?.language_code,
    },
    command,
    callbackData: callback?.data,
    ...(callback?.inline_message_id !== undefined
      ? { callbackInlineMessageId: callback.inline_message_id }
      : {}),
    ...(callback?.chat_instance !== undefined
      ? { callbackChatInstance: callback.chat_instance }
      : {}),
    messageText: message?.text,
    content: extractContentFlags(message),
    attachment: extractAttachment(message),
    preCheckout: update.pre_checkout_query?.id
      ? {
          id: update.pre_checkout_query.id,
          payload: update.pre_checkout_query.invoice_payload ?? "",
          currency: update.pre_checkout_query.currency ?? "XTR",
          totalAmount: update.pre_checkout_query.total_amount ?? 0,
        }
      : undefined,
    successfulPayment: update.message?.successful_payment
      ?.telegram_payment_charge_id
      ? {
          chargeId:
            update.message.successful_payment.telegram_payment_charge_id,
          payload: update.message.successful_payment.invoice_payload ?? "",
          currency: update.message.successful_payment.currency ?? "XTR",
          totalAmount: update.message.successful_payment.total_amount ?? 0,
          isRecurring: Boolean(update.message.successful_payment.is_recurring),
          isFirstRecurring: Boolean(
            update.message.successful_payment.is_first_recurring,
          ),
          subscriptionExpirationDate: update.message.successful_payment
            .subscription_expiration_date
            ? new Date(
                update.message.successful_payment.subscription_expiration_date *
                  1000,
              )
            : undefined,
        }
      : undefined,
    inlineQuery: update.inline_query?.id
      ? {
          id: update.inline_query.id,
          query: update.inline_query.query ?? "",
        }
      : undefined,
    guestMessage: guestQueryId ? { queryId: guestQueryId } : undefined,
    messageId: message?.message_id,
    newChatMemberIds,
    ...(leftChatMemberId !== undefined ? { leftChatMemberId } : {}),
    ...(leftChatMember ? { leftChatMember } : {}),
    ...(joinRequest
      ? {
          joinRequest: {
            queryId: joinRequest.query_id,
            userChatId:
              joinRequest.user_chat_id !== undefined
                ? toBigIntId(joinRequest.user_chat_id)
                : undefined,
            lastName: joinRequest.from?.last_name,
            inviteLinkName: joinRequest.invite_link?.name,
          },
        }
      : {}),
    ...(botMembership ? { botMembership } : {}),
    ...(chatMemberUpdate ? { chatMemberUpdate } : {}),
    ...(reactionContext ? { reaction: reactionContext } : {}),
    ...(managedBotContext ? { managedBot: managedBotContext } : {}),
    isTextMessage: Boolean(message?.text) && !command,
    raw: update,
  };
};
