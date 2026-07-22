import type {
  CaptchaRepository,
  ExpirationRepository,
  ExpiringBot,
  ProductivityRepository,
  ScheduledPostRepository,
} from "@superbot/data";
import type { BotReply } from "@superbot/domain";
import type { TelegramGatewayResult } from "@superbot/telegram";

export interface ExpirationGateway {
  unbanChatMember(input: {
    chatId: bigint;
    userId: bigint;
    token: string | undefined;
  }): Promise<TelegramGatewayResult>;
  liftRestrictions(input: {
    chatId: bigint;
    userId: bigint;
    token: string | undefined;
  }): Promise<TelegramGatewayResult>;
  banChatMember(input: {
    chatId: bigint;
    userId: bigint;
    token: string | undefined;
    untilDate: Date | undefined;
  }): Promise<TelegramGatewayResult>;
  restrictChatMember(input: {
    chatId: bigint;
    userId: bigint;
    token: string | undefined;
    untilDate: Date | undefined;
  }): Promise<TelegramGatewayResult>;
}

export interface PublishGateway {
  sendMessage(input: {
    chatId: bigint;
    reply: BotReply;
    token: string | undefined;
  }): Promise<TelegramGatewayResult>;
}

export interface ScheduledPostContext {
  readonly posts: ScheduledPostRepository;
  readonly gateway: PublishGateway;
  readonly resolveBotToken: (tenantId: string) => Promise<string | undefined>;
  readonly now: Date;
}

/**
 * post.publish.due — sends scheduled posts whose run time has passed and marks
 * them sent (or failed if Telegram rejects them).
 */
export const processScheduledPosts = async (
  context: ScheduledPostContext,
): Promise<ExpirationSummary> => {
  const due = await context.posts.listDue(context.now);
  let reverted = 0;
  let errors = 0;

  for (const post of due) {
    try {
      const token = await context.resolveBotToken(post.tenantId);
      const result = await context.gateway.sendMessage({
        chatId: post.telegramChatId,
        reply: { text: post.text },
        token,
      });
      if (result.ok) {
        reverted += 1;
        await context.posts.markSent(post.id);
      } else {
        await context.posts.markFailed(post.id);
        errors += 1;
      }
    } catch {
      await context.posts.markFailed(post.id);
      errors += 1;
    }
  }

  return { processed: due.length, reverted, errors };
};

export interface ExpirationContext {
  readonly expirations: ExpirationRepository;
  readonly captcha: CaptchaRepository;
  readonly gateway: ExpirationGateway;
  readonly token: string | undefined;
  readonly now: Date;
  /**
   * Resolves the internal chat id to a Telegram chat id so captcha fail actions
   * can reach Telegram. When omitted, the DB transition still happens but the
   * Telegram side-effect is skipped.
   */
  readonly resolveChatTelegramId?: (
    chatId: string,
  ) => Promise<bigint | undefined>;
  /** Resolves the bot token for a given tenant (primary or active managed child).
   *  Used by the per-tenant jobs (post/reminder/rss/recap); sanction/captcha/
   *  warning/managedbot expirations keep using the flat `token` above. */
  readonly resolveBotToken: (tenantId: string) => Promise<string | undefined>;
}

export interface ExpirationSummary {
  readonly processed: number;
  readonly reverted: number;
  readonly errors: number;
}

/**
 * moderation.sanction.expire — finds active temporary sanctions whose end date
 * has passed, lifts the corresponding Telegram restriction/ban and marks the
 * sanction as expired. Telegram failures never block the database transition.
 */
export const processSanctionExpirations = async (
  context: ExpirationContext,
): Promise<ExpirationSummary> => {
  const due = await context.expirations.listDueSanctions(context.now);
  let reverted = 0;
  let errors = 0;

  for (const sanction of due) {
    if (sanction.telegramChatId && sanction.telegramUserId) {
      try {
        const result =
          sanction.kind === "ban"
            ? await context.gateway.unbanChatMember({
                chatId: sanction.telegramChatId,
                userId: sanction.telegramUserId,
                token: context.token,
              })
            : await context.gateway.liftRestrictions({
                chatId: sanction.telegramChatId,
                userId: sanction.telegramUserId,
                token: context.token,
              });

        if (result.ok) {
          reverted += 1;
        }
      } catch {
        errors += 1;
      }
    }

    await context.expirations.markSanctionExpired(sanction.id);
  }

  return { processed: due.length, reverted, errors };
};

/**
 * captcha.challenge.expire — expires pending captcha sessions past their timeout
 * and applies the configured fail action against the unverified member.
 */
export const processCaptchaExpirations = async (
  context: ExpirationContext,
): Promise<ExpirationSummary> => {
  const due = await context.captcha.listExpiredPending(context.now);
  let reverted = 0;
  let errors = 0;

  for (const session of due) {
    await context.captcha.recordAttempt(session.id, "expired");

    const chatId = context.resolveChatTelegramId
      ? await context.resolveChatTelegramId(session.chatId)
      : undefined;
    if (chatId) {
      try {
        const result =
          session.failAction === "ban"
            ? await context.gateway.banChatMember({
                chatId,
                userId: session.telegramUserId,
                token: context.token,
                untilDate: undefined,
              })
            : await context.gateway.restrictChatMember({
                chatId,
                userId: session.telegramUserId,
                token: context.token,
                untilDate: undefined,
              });

        if (result.ok) {
          reverted += 1;
        }
      } catch {
        errors += 1;
      }
    }
  }

  return { processed: due.length, reverted, errors };
};

export interface ReminderContext {
  readonly productivity: ProductivityRepository;
  readonly gateway: PublishGateway;
  readonly resolveBotToken: (tenantId: string) => Promise<string | undefined>;
  readonly now: Date;
}

/**
 * reminder.fire.due — delivers reminders whose run time has passed and marks them
 * fired. Telegram failures still mark the reminder fired to avoid re-delivery loops.
 */
export const processReminders = async (
  context: ReminderContext,
): Promise<ExpirationSummary> => {
  const due = await context.productivity.listDueReminders(context.now);
  let reverted = 0;
  let errors = 0;

  for (const reminder of due) {
    try {
      const token = await context.resolveBotToken(reminder.tenantId);
      const result = await context.gateway.sendMessage({
        chatId: reminder.telegramChatId,
        reply: { text: `⏰ Recordatorio: ${reminder.text}` },
        token,
      });
      if (result.ok) {
        reverted += 1;
      } else {
        errors += 1;
      }
    } catch {
      errors += 1;
    }
    await context.productivity.markReminderFired(reminder.id);
  }

  return { processed: due.length, reverted, errors };
};

/**
 * warning.expire — marks warnings whose expiry date has passed so they stop
 * counting towards escalation thresholds.
 */
export const processWarningExpirations = async (
  context: ExpirationContext,
): Promise<ExpirationSummary> => {
  const due = await context.expirations.listDueWarnings(context.now);

  for (const warning of due) {
    await context.expirations.markWarningExpired(warning.id);
  }

  return { processed: due.length, reverted: 0, errors: 0 };
};

export interface ManagedBotExpiryGateway {
  deleteWebhook(input: {
    token: string | undefined;
  }): Promise<TelegramGatewayResult>;
  sendMessage(input: {
    chatId: bigint;
    reply: BotReply;
    token: string | undefined;
  }): Promise<TelegramGatewayResult>;
}

export interface ManagedBotExpiryRepository {
  listExpiredActiveBots(now: Date): Promise<ExpiringBot[]>;
  listBotsExpiringSoon(now: Date, withinMs: number): Promise<ExpiringBot[]>;
  markExpiryWarned(id: string): Promise<void>;
  getManagedBotToken(botUsername: string): Promise<string | undefined>;
  suspendManagedBot(id: string, reason: string): Promise<void>;
}

export interface ManagedBotExpiryContext {
  readonly platform: ManagedBotExpiryRepository;
  readonly gateway: ManagedBotExpiryGateway;
  /** Parent bot token — the owner is DM'd FROM the parent bot they know. */
  readonly parentToken: string | undefined;
  /** How far ahead to warn owners about an upcoming expiry (ms). */
  readonly warnWithinMs: number;
  readonly now: Date;
}

const dmOwner = async (
  context: ManagedBotExpiryContext,
  ownerTelegramId: bigint | null,
  text: string,
): Promise<boolean> => {
  if (!ownerTelegramId) {
    return true;
  }
  try {
    await context.gateway.sendMessage({
      chatId: ownerTelegramId,
      reply: { text },
      token: context.parentToken,
    });
    return true;
  } catch {
    return false;
  }
};

/**
 * managedbot.expire — the child-bot lifecycle sweep:
 *  1. WARNS owners (once) whose access expires soon, via a DM from the parent bot.
 *  2. SWITCHES OFF bots whose entitlement expired/was revoked: removes the child
 *     webhook, marks it suspended, and DMs the owner how to reactivate.
 * Idempotent — a suspended bot is no longer active and a warned bot is skipped.
 */
export const processExpiredManagedBots = async (
  context: ManagedBotExpiryContext,
): Promise<ExpirationSummary> => {
  let processed = 0;
  let reverted = 0;
  let errors = 0;

  const soon = await context.platform.listBotsExpiringSoon(
    context.now,
    context.warnWithinMs,
  );
  for (const bot of soon) {
    processed += 1;
    const when = bot.expiresAt
      ? bot.expiresAt.toISOString().slice(0, 10)
      : "pronto";
    const ok = await dmOwner(
      context,
      bot.ownerTelegramId,
      `⏳ Tu bot @${bot.username} se apagará el ${when}, cuando caduque tu acceso. Renueva para mantenerlo activo.`,
    );
    if (!ok) {
      errors += 1;
    }
    await context.platform.markExpiryWarned(bot.id);
  }

  const expired = await context.platform.listExpiredActiveBots(context.now);
  for (const bot of expired) {
    processed += 1;
    // Fetch the token WHILE the bot is still active (decrypt requires active).
    const token = await context.platform
      .getManagedBotToken(bot.username)
      .catch(() => undefined);
    if (token) {
      try {
        await context.gateway.deleteWebhook({ token });
        reverted += 1;
      } catch {
        errors += 1;
      }
    }
    await context.platform.suspendManagedBot(bot.id, "entitlement expired");
    const ok = await dmOwner(
      context,
      bot.ownerTelegramId,
      `🔕 Tu bot @${bot.username} se ha pausado porque tu acceso caducó. Renueva tu acceso para reactivarlo.`,
    );
    if (!ok) {
      errors += 1;
    }
  }

  return { processed, reverted, errors };
};
