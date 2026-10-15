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

/**
 * Una reserva de ejecucion-una-sola-vez.
 *
 * `namespace` separa familias de efectos (`economia.premio`,
 * `moderacion.sancion`) para que dos cosas distintas no compartan clave por
 * accidente. `key` identifica el efecto concreto y **tiene que ser
 * determinista**: si se calcula con la hora o con un aleatorio, el reintento
 * genera otra clave y la proteccion no sirve de nada. Lo habitual es
 * componerla con el `updateId` y aquello sobre lo que se actua.
 */
export interface ReservaIdempotenciaInput {
  readonly tenantId?: string | undefined;
  readonly namespace: string;
  readonly key: string;
  /** Contexto para depurar despues por que se salto un efecto. */
  readonly payload?: unknown;
  /**
   * Cuando caduca la reserva. Sin esto la tabla crece para siempre. Un update
   * que Telegram ya no va a reenviar no necesita proteccion: 24 h cubren de
   * sobra la ventana de reintentos.
   */
  readonly expiraEn?: Date;
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
  /**
   * Reserva una clave de ejecucion-una-sola-vez.
   *
   * Devuelve `true` si esta llamada es la primera y por tanto le toca hacer el
   * trabajo; `false` si alguien ya la reservo y hay que saltarselo.
   *
   * Existe porque `claimUpdate` puede devolver `"retry"`: un intento anterior
   * reclamo el update y murio antes de terminarlo, asi que el pipeline se
   * reejecuta ENTERO, con los efectos ya aplicados por el intento fallido. Para
   * un mensaje repetido eso es feo; para un pago, una sancion o un premio es
   * inaceptable. Envuelve esos efectos con esto.
   *
   * La exclusion la da el indice unico `(namespace, key)` de la tabla, no una
   * lectura previa: comprobar-y-luego-escribir tiene una carrera en medio, y
   * dos reintentos concurrentes la encontrarian.
   */
  reservarEjecucionUnica(input: ReservaIdempotenciaInput): Promise<boolean>;
  recordAudit(input: RecordAuditInput): Promise<void>;
  /**
   * Última acción de moderación (ms) por usuario de Telegram. El criterio de
   * qué es "moderar" lo pone quien llama con `esModeracion`, porque es una
   * decisión de producto, no de acceso a datos. Ausente = nunca ha moderado.
   */
  findLastModerationActionByTelegramUserIds(
    tenantId: string,
    telegramUserIds: readonly bigint[],
    esModeracion: (action: string) => boolean,
  ): Promise<Map<string, number>>;
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
   * Telegram ids of members the bot has actually observed as active in a chat.
   * Telegram's Bot API deliberately has no endpoint for listing every group
   * member, therefore callers must not treat this as a complete roster.
   */
  listActiveMembershipTelegramUserIds(
    chatId: string,
  ): Promise<readonly bigint[]>;
  /**
   * Same members, with a display name, for building @all mentions. Carries the
   * same caveat: it is everyone the bot has SEEN, never a complete roster.
   */
  listActiveMembersWithNames(
    chatId: string,
    limit?: number,
  ): Promise<readonly { telegramUserId: bigint; name: string }[]>;
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

  /**
   * Active members WITH a name, for building @all mentions.
   *
   * Only people the bot has actually seen — Telegram has no endpoint to list a
   * chat's members, so this is everyone whose update ever passed through
   * ensureContext. Silent lurkers are therefore invisible here, and any caller
   * must say so rather than implying it reached the whole group.
   */
  async listActiveMembersWithNames(
    chatId: string,
    limit = 500,
  ): Promise<readonly { telegramUserId: bigint; name: string }[]> {
    const memberships = await this.client.membership.findMany({
      where: { chatId, leftAt: null },
      select: {
        user: {
          select: { telegramUserId: true, username: true, displayName: true },
        },
      },
      take: limit,
    });
    return memberships.map((m) => ({
      telegramUserId: m.user.telegramUserId,
      name:
        m.user.displayName?.trim() ||
        m.user.username ||
        m.user.telegramUserId.toString(),
    }));
  }

  async listActiveMembershipTelegramUserIds(
    chatId: string,
  ): Promise<readonly bigint[]> {
    const memberships = await this.client.membership.findMany({
      where: { chatId, leftAt: null },
      select: { user: { select: { telegramUserId: true } } },
    });
    return memberships.map((membership) => membership.user.telegramUserId);
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

  /**
   * Cuándo moderó por última vez cada uno de esos usuarios de Telegram, en ms.
   *
   * Filtrar QUÉ cuenta como moderar no se hace aquí sino en
   * `isModerationAction` (module-security): la lista de acciones es una
   * decisión de producto discutible y probada, no un detalle de acceso a datos
   * escondido en un `WHERE`. Aquí se traen las filas candidatas y se criban con
   * esa función, que es la única que manda.
   *
   * Devuelve el mapa solo con quienes tienen alguna: la ausencia significa
   * "nunca ha moderado", que el auditor ya sabe tratar (y que NO es lo mismo
   * que "no lo sé").
   */
  async findLastModerationActionByTelegramUserIds(
    tenantId: string,
    telegramUserIds: readonly bigint[],
    esModeracion: (action: string) => boolean,
  ): Promise<Map<string, number>> {
    if (telegramUserIds.length === 0) {
      return new Map();
    }

    const users = await this.client.appUser.findMany({
      where: { tenantId, telegramUserId: { in: [...telegramUserIds] } },
      select: { id: true, telegramUserId: true },
    });
    if (users.length === 0) {
      return new Map();
    }

    const porId = new Map(users.map((user) => [user.id, user.telegramUserId]));
    const filas = await this.client.auditLog.findMany({
      where: {
        tenantId,
        actorType: "user",
        actorId: { in: users.map((user) => user.id) },
      },
      select: { actorId: true, action: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      // Techo: sin él, un grupo con mucho historial se trae la tabla entera a
      // memoria para responder a un comando. Las de moderación son una minoría
      // diminuta frente a los `telegram.update.received`, así que se mira una
      // ventana reciente generosa y quien no aparezca cuenta como "hace mucho"
      // — que para este informe es la respuesta correcta de todos modos.
      take: 5000,
    });

    const ultima = new Map<string, number>();
    for (const fila of filas) {
      if (!fila.actorId || !esModeracion(fila.action)) {
        continue;
      }
      const telegramUserId = porId.get(fila.actorId);
      if (telegramUserId === undefined) {
        continue;
      }
      const clave = telegramUserId.toString();
      const ms = fila.createdAt.getTime();
      const previa = ultima.get(clave);
      if (previa === undefined || ms > previa) {
        ultima.set(clave, ms);
      }
    }
    return ultima;
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

  async reservarEjecucionUnica({
    tenantId,
    namespace,
    key,
    payload,
    expiraEn,
  }: ReservaIdempotenciaInput): Promise<boolean> {
    try {
      await this.client.idempotencyKey.create({
        data: {
          ...(tenantId ? { tenantId } : {}),
          namespace,
          key,
          ...(payload === undefined ? {} : { payload: toJson(payload) }),
          ...(expiraEn ? { expiresAt: expiraEn } : {}),
        },
      });
      return true;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        // Ya reservada: este efecto se hizo (o lo esta haciendo alguien ahora
        // mismo). En los dos casos la respuesta correcta es no repetirlo.
        return false;
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
