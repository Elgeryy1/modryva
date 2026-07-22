import { AuditActorType, Prisma, type PrismaClient } from "@prisma/client";
import type { TelegramUpdateEnvelope } from "@superbot/domain";
import { prisma as defaultPrisma } from "./client.js";

export interface FoundationContext {
  readonly tenantId: string;
  readonly managedBotId: string;
  readonly chatId: string | undefined;
  readonly userId: string | undefined;
  readonly membershipId: string | undefined;
  readonly membershipRole: string | undefined;
}

export interface EnsureFoundationContextInput {
  readonly botUsername: string;
  readonly update: TelegramUpdateEnvelope;
  /** Telegram's stable numeric bot id, when known — best-effort backfilled
   * onto ManagedBot.telegramBotId (only ever null for the primary bot's row
   * today). Phase 1 of decoupling tenant identity from the mutable
   * TELEGRAM_BOT_USERNAME env var: this never changes tenant/managedBot
   * RESOLUTION (still slug-based) — it only records the stable id for a
   * future migration to use. See docs/REVISION-FULL-2026-07-15.md. */
  readonly botTelegramId?: bigint | undefined;
}

export interface ClaimUpdateInput {
  readonly tenantId: string;
  readonly botKey: string;
  readonly updateId: number;
  readonly payload: unknown;
}

/**
 * Outcome of FoundationRepository.claimUpdate for a given (botKey, updateId):
 *  - "claimed": first time this update has been seen — process it normally.
 *  - "retry": a PRIOR attempt already inserted the UpdateInbox row (claimed
 *    it) but crashed/threw before markUpdateProcessed ran — most likely
 *    because Telegram got a non-2xx response and redelivered the exact same
 *    update_id. This is NOT a duplicate: the update was never actually
 *    processed. Callers MUST run the full pipeline again, exactly as for
 *    "claimed".
 *  - "already-processed": a prior attempt claimed AND finished this update.
 *    Safe to skip — this is the genuine duplicate-delivery case.
 */
export type ClaimUpdateOutcome = "claimed" | "retry" | "already-processed";

export interface RecordAuditInput {
  readonly tenantId: string | undefined;
  readonly actorType?: AuditActorType;
  readonly actorId?: string;
  readonly action: string;
  readonly resourceType?: string;
  readonly resourceId?: string;
  readonly payload?: Record<string, unknown>;
}

export interface ResolvedChat {
  readonly chatId: string;
  readonly title: string | undefined;
}

export interface FoundationRepository {
  ensureContext(
    input: EnsureFoundationContextInput,
  ): Promise<FoundationContext>;
  /** See {@link ClaimUpdateOutcome} — a boolean here would collapse "never
   * seen" and "seen but crashed before finishing" into one bit, which is
   * exactly the bug this 3-state return prevents. */
  claimUpdate(input: ClaimUpdateInput): Promise<ClaimUpdateOutcome>;
  markUpdateProcessed(botKey: string, updateId: number): Promise<void>;
  recordAudit(input: RecordAuditInput): Promise<void>;
  /**
   * Resolves an internal chat by its Telegram id within a tenant. Used to
   * configure a group from the bot's private chat: the group must have been
   * seen at least once (its Chat row created by {@link ensureContext}).
   */
  findChatByTelegramId(
    tenantId: string,
    telegramChatId: bigint,
  ): Promise<ResolvedChat | null>;
  /**
   * Resolves a Telegram user id from a public @username (case-insensitive), so
   * moderation can target `@user` instead of a numeric id. Works for any user
   * the bot has recorded. undefined if unknown.
   */
  findTelegramUserIdByUsername(username: string): Promise<bigint | undefined>;
  /**
   * Fecha de alta (`joinedAt`) de una membresia por su id, para modulos como
   * trust-tiers/rookie-ranking que necesitan la antiguedad del miembro en el
   * grupo. undefined si la membresia no existe.
   */
  getMembershipJoinedAt(membershipId: string): Promise<Date | undefined>;
  /**
   * Fecha de alta (`joinedAt`) de la membresia de un usuario de Telegram en un
   * chat, resuelta por chatId + telegramUserId (sin conocer el membershipId
   * de antemano). Usado por rookie-ranking para separar novatos/veteranos en
   * un leaderboard. undefined si el usuario no tiene membresia en ese chat.
   */
  getMembershipJoinedAtByTelegramUser(
    chatId: string,
    telegramUserId: bigint,
  ): Promise<Date | undefined>;
  /**
   * Cuenta las membresias activas (sin `leftAt`) de un chat. Usado por
   * milestones para detectar cuando el grupo cruza un hito de miembros.
   */
  countActiveMemberships(chatId: string): Promise<number>;
  /**
   * Resuelve nombres visibles (displayName, o `@username` si no hay
   * displayName) para un lote de telegramUserId en una sola consulta. Usado
   * por modulos que muestran rankings/coincidencias por id (p.ej.
   * interest-tags) para no exponer ids crudos, mismo patron que
   * reputation-repository.top() y game-repository. Los ids sin AppUser
   * conocido o sin nombre resoluble simplemente no aparecen en el mapa.
   */
  findDisplayNamesByTelegramUserIds(
    telegramUserIds: readonly bigint[],
  ): Promise<Map<string, string>>;
}

const toBotKey = (botUsername: string): string =>
  botUsername.replace(/^@/u, "").toLowerCase();

const toJson = (value: unknown): Prisma.InputJsonValue =>
  value as Prisma.InputJsonValue;

export class PrismaFoundationRepository implements FoundationRepository {
  constructor(private readonly client: PrismaClient = defaultPrisma) {}

  async ensureContext({
    botUsername,
    update,
    botTelegramId,
  }: EnsureFoundationContextInput): Promise<FoundationContext> {
    const botKey = toBotKey(botUsername);
    const tenant = await this.client.tenant.upsert({
      where: { slug: `telegram-${botKey}` },
      create: {
        slug: `telegram-${botKey}`,
        name: `Telegram @${botKey}`,
      },
      update: {},
    });

    const managedBot = await this.client.managedBot.upsert({
      where: { username: botKey },
      create: {
        tenantId: tenant.id,
        username: botKey,
        displayName: `@${botKey}`,
        isPrimary: true,
      },
      update: {
        tenantId: tenant.id,
        displayName: `@${botKey}`,
      },
    });

    if (botTelegramId !== undefined && managedBot.telegramBotId === null) {
      try {
        await this.client.managedBot.update({
          where: { id: managedBot.id },
          data: { telegramBotId: botTelegramId },
        });
      } catch {
        // Best-effort backfill only. A telegramBotId unique-constraint clash
        // here (should never happen in normal operation — Telegram bot ids
        // are globally unique) must never break update processing; surfaced
        // separately via manual DB inspection, not by throwing here.
      }
    }

    const chat = update.chat.chatId
      ? await this.client.chat.upsert({
          where: {
            tenantId_telegramChatId: {
              tenantId: tenant.id,
              telegramChatId: update.chat.chatId,
            },
          },
          create: {
            tenantId: tenant.id,
            telegramChatId: update.chat.chatId,
            type: update.chat.chatType ?? "unknown",
            ...(update.chat.chatTitle ? { title: update.chat.chatTitle } : {}),
          },
          update: {
            type: update.chat.chatType ?? "unknown",
            ...(update.chat.chatTitle ? { title: update.chat.chatTitle } : {}),
          },
        })
      : undefined;

    const user = update.user.userId
      ? await this.upsertUser(tenant.id, update)
      : undefined;

    const membership =
      chat && user
        ? await this.ensureMembership({
            tenantId: tenant.id,
            chatId: chat.id,
            userId: user.id,
          })
        : undefined;

    return {
      tenantId: tenant.id,
      managedBotId: managedBot.id,
      chatId: chat?.id,
      userId: user?.id,
      membershipId: membership?.id,
      membershipRole: membership?.role,
    };
  }

  async findChatByTelegramId(
    tenantId: string,
    telegramChatId: bigint,
  ): Promise<ResolvedChat | null> {
    const chat = await this.client.chat.findUnique({
      where: {
        tenantId_telegramChatId: { tenantId, telegramChatId },
      },
    });

    if (!chat) {
      return null;
    }

    return { chatId: chat.id, title: chat.title ?? undefined };
  }

  async findTelegramUserIdByUsername(
    username: string,
  ): Promise<bigint | undefined> {
    const clean = username.replace(/^@/u, "");
    if (!clean) {
      return undefined;
    }
    const user = await this.client.appUser.findFirst({
      where: { username: { equals: clean, mode: "insensitive" } },
    });
    return user?.telegramUserId ?? undefined;
  }

  async getMembershipJoinedAt(membershipId: string): Promise<Date | undefined> {
    const membership = await this.client.membership.findUnique({
      where: { id: membershipId },
    });
    return membership?.joinedAt ?? undefined;
  }

  async getMembershipJoinedAtByTelegramUser(
    chatId: string,
    telegramUserId: bigint,
  ): Promise<Date | undefined> {
    const user = await this.client.appUser.findUnique({
      where: { telegramUserId },
    });
    if (!user) {
      return undefined;
    }
    const membership = await this.client.membership.findFirst({
      where: { chatId, userId: user.id },
      orderBy: { joinedAt: "asc" },
    });
    return membership?.joinedAt ?? undefined;
  }

  async countActiveMemberships(chatId: string): Promise<number> {
    return this.client.membership.count({
      where: { chatId, leftAt: null },
    });
  }

  async findDisplayNamesByTelegramUserIds(
    telegramUserIds: readonly bigint[],
  ): Promise<Map<string, string>> {
    if (telegramUserIds.length === 0) {
      return new Map();
    }

    const users = await this.client.appUser.findMany({
      where: { telegramUserId: { in: [...telegramUserIds] } },
      select: { telegramUserId: true, displayName: true, username: true },
    });

    const names = new Map<string, string>();
    for (const user of users) {
      const name =
        user.displayName ?? (user.username ? `@${user.username}` : null);
      if (name) {
        names.set(user.telegramUserId.toString(), name);
      }
    }
    return names;
  }

  async claimUpdate({
    tenantId,
    botKey,
    updateId,
    payload,
  }: ClaimUpdateInput): Promise<ClaimUpdateOutcome> {
    try {
      await this.client.updateInbox.create({
        data: {
          tenantId,
          botKey: toBotKey(botKey),
          updateId: BigInt(updateId),
          payload: toJson(payload),
        },
      });

      return "claimed";
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        // Someone (possibly this same webhook, redelivered by Telegram after
        // a non-2xx response) already claimed this update. processedAt tells
        // us whether that attempt actually finished.
        const existing = await this.client.updateInbox.findUnique({
          where: {
            botKey_updateId: {
              botKey: toBotKey(botKey),
              updateId: BigInt(updateId),
            },
          },
          select: { processedAt: true },
        });

        // existing should always be found right after a unique-constraint
        // collision; if it somehow isn't (e.g. deleted between the failed
        // insert and this read), treat it as "retry" rather than silently
        // dropping the update — reprocessing is the safe default.
        return existing?.processedAt ? "already-processed" : "retry";
      }

      throw error;
    }
  }

  async markUpdateProcessed(botKey: string, updateId: number): Promise<void> {
    await this.client.updateInbox.updateMany({
      where: {
        botKey: toBotKey(botKey),
        updateId: BigInt(updateId),
      },
      data: {
        processedAt: new Date(),
      },
    });
  }

  async recordAudit(input: RecordAuditInput): Promise<void> {
    const data: Prisma.AuditLogUncheckedCreateInput = {
      actorType: input.actorType ?? AuditActorType.system,
      action: input.action,
      ...(input.tenantId ? { tenantId: input.tenantId } : {}),
      ...(input.actorId ? { actorId: input.actorId } : {}),
      ...(input.resourceType ? { resourceType: input.resourceType } : {}),
      ...(input.resourceId ? { resourceId: input.resourceId } : {}),
      ...(input.payload ? { payload: toJson(input.payload) } : {}),
    };

    await this.client.auditLog.create({
      data,
    });
  }

  private async upsertUser(tenantId: string, update: TelegramUpdateEnvelope) {
    const telegramUserId = update.user.userId;

    if (!telegramUserId) {
      return undefined;
    }

    const existing = await this.client.appUser.findUnique({
      where: { telegramUserId },
    });

    if (existing) {
      const data: Prisma.AppUserUncheckedUpdateInput = {
        tenantId: existing.tenantId ?? tenantId,
        ...(update.user.username ? { username: update.user.username } : {}),
        ...(update.user.firstName
          ? { displayName: update.user.firstName }
          : {}),
        ...(update.user.languageCode
          ? { languageCode: update.user.languageCode }
          : {}),
      };

      return this.client.appUser.update({
        where: { id: existing.id },
        data,
      });
    }

    const data: Prisma.AppUserUncheckedCreateInput = {
      tenantId,
      telegramUserId,
      ...(update.user.username ? { username: update.user.username } : {}),
      ...(update.user.firstName ? { displayName: update.user.firstName } : {}),
      ...(update.user.languageCode
        ? { languageCode: update.user.languageCode }
        : {}),
    };

    try {
      return await this.client.appUser.create({ data });
    } catch (error) {
      // Concurrent first-contact from the same brand-new user: two updates both
      // saw no row in the findUnique above and both reached this create. AppUser
      // .telegramUserId is @unique, so the loser throws P2002 — which, unhandled,
      // would fail ensureContext for that whole update (dropping the message).
      // Mirror ensureWallet's race handling: return the row the winner created.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const raced = await this.client.appUser.findUnique({
          where: { telegramUserId },
        });
        if (raced) {
          return raced;
        }
      }
      throw error;
    }
  }

  private async ensureMembership(input: {
    tenantId: string;
    chatId: string;
    userId: string;
  }) {
    const existing = await this.client.membership.findFirst({
      where: {
        tenantId: input.tenantId,
        chatId: input.chatId,
        userId: input.userId,
        leftAt: null,
      },
    });

    if (existing) {
      return existing;
    }

    return this.client.membership.create({
      data: {
        tenantId: input.tenantId,
        chatId: input.chatId,
        userId: input.userId,
      },
    });
  }
}
