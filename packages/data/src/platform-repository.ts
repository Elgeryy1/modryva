import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import {
  EntitlementKind,
  EntitlementSource,
  ManagedBotStatus,
  ManagedBotTemplate,
  PlatformRole,
  Prisma,
  type PrismaClient,
} from "@prisma/client";
import { prisma as defaultPrisma } from "./client.js";

export type PlatformRoleName = `${PlatformRole}`;
export type ManagedBotTemplateName = `${ManagedBotTemplate}`;
export type EntitlementKindName = `${EntitlementKind}`;

export interface PlatformPromoRecord {
  readonly id: string;
  readonly codePrefix: string;
  readonly kind: EntitlementKindName;
  readonly template: ManagedBotTemplateName;
  readonly quantity: number;
  readonly maxUses: number;
  readonly usedCount: number;
  readonly expiresAt: Date | null;
  readonly revokedAt: Date | null;
  readonly note: string | null;
}

export interface CreatedPromoRecord extends PlatformPromoRecord {
  readonly code: string;
}

export interface EntitlementRecord {
  readonly id: string;
  readonly ownerTelegramId: bigint;
  readonly kind: EntitlementKindName;
  readonly template: ManagedBotTemplateName;
  readonly quantity: number;
  readonly usedQuantity: number;
  readonly source: string;
  readonly expiresAt: Date | null;
  readonly revokedAt: Date | null;
}

export interface ManagedBotRecord {
  readonly id: string;
  readonly tenantId: string;
  readonly telegramBotId: bigint | null;
  readonly username: string;
  readonly displayName: string;
  readonly ownerTelegramId: bigint | null;
  readonly template: ManagedBotTemplateName;
  readonly status: `${ManagedBotStatus}`;
  readonly entitlementId: string | null;
}

export interface ManagedBotChatRecord {
  readonly chatId: string;
  readonly telegramChatId: bigint;
  readonly type: string;
  readonly title: string | null;
  readonly username: string | null;
  readonly memberCount: number;
  readonly updatedAt: Date;
}

export interface PlatformUserBanRecord {
  readonly telegramUserId: bigint;
  readonly reason: string;
  readonly bannedByTelegramId: bigint;
  readonly bannedAt: Date;
  readonly expiresAt: Date | null;
  readonly revokedAt: Date | null;
}

export type PromoRedeemResult =
  | {
      readonly ok: true;
      readonly entitlement: EntitlementRecord;
      readonly promo: PlatformPromoRecord;
    }
  | {
      readonly ok: false;
      readonly reason:
        | "not-found"
        | "expired"
        | "revoked"
        | "used-up"
        | "already-redeemed";
    };

export type ManagedBotRegistrationResult =
  | {
      readonly ok: true;
      readonly bot: ManagedBotRecord;
      readonly isNew: boolean;
    }
  | { readonly ok: false; readonly reason: "no-slot" };

/** A managed bot surfaced by the expiry/warning sweeps. */
export interface ExpiringBot {
  readonly id: string;
  readonly username: string;
  readonly ownerTelegramId: bigint | null;
  readonly expiresAt: Date | null;
}

export type ReactivationInfo =
  | {
      readonly ok: true;
      readonly token: string;
      readonly entitlementId: string;
      readonly consumesSlot: boolean;
    }
  | {
      readonly ok: false;
      readonly reason:
        | "not-found"
        | "not-owner"
        | "not-suspended"
        | "no-token"
        | "no-slot";
    };

export interface PlatformRepository {
  hasRole(telegramUserId: bigint, role: PlatformRoleName): Promise<boolean>;
  listRoles(
    telegramUserId?: bigint,
  ): Promise<Array<{ telegramUserId: bigint; role: PlatformRoleName }>>;
  grantRole(input: {
    telegramUserId: bigint;
    role: PlatformRoleName;
    grantedByTelegramId: bigint | undefined;
  }): Promise<void>;
  revokeRole(input: {
    telegramUserId: bigint;
    role: PlatformRoleName;
  }): Promise<void>;
  banPlatformUser(input: {
    telegramUserId: bigint;
    reason: string;
    bannedByTelegramId: bigint;
    expiresAt: Date | undefined;
  }): Promise<PlatformUserBanRecord>;
  revokePlatformUserBan(telegramUserId: bigint): Promise<boolean>;
  getActivePlatformUserBan(
    telegramUserId: bigint,
    now?: Date,
  ): Promise<PlatformUserBanRecord | null>;
  listPlatformUserBans(limit?: number): Promise<PlatformUserBanRecord[]>;
  createPromo(input: {
    tenantId: string | undefined;
    template: ManagedBotTemplateName;
    maxUses: number;
    expiresAt: Date | undefined;
    note: string | undefined;
    createdByTelegramId: bigint;
  }): Promise<CreatedPromoRecord>;
  listPromos(limit?: number): Promise<PlatformPromoRecord[]>;
  revokePromo(codeOrId: string): Promise<boolean>;
  redeemPromo(input: {
    code: string;
    redeemedByTelegramId: bigint;
    tenantId: string | undefined;
  }): Promise<PromoRedeemResult>;
  grantManagedBotSlot(input: {
    ownerTelegramId: bigint;
    template: ManagedBotTemplateName;
    expiresAt: Date | undefined;
    createdByTelegramId: bigint | undefined;
    sourceRef?: string | undefined;
  }): Promise<EntitlementRecord>;
  revokeManagedBotSlots(ownerTelegramId: bigint): Promise<number>;
  listEntitlements(ownerTelegramId: bigint): Promise<EntitlementRecord[]>;
  availableManagedBotSlots(ownerTelegramId: bigint): Promise<number>;
  listManagedBots(ownerTelegramId: bigint): Promise<ManagedBotRecord[]>;
  listAllManagedBots(): Promise<ManagedBotRecord[]>;
  findManagedBot(username: string): Promise<ManagedBotRecord | null>;
  listManagedBotChats(username: string): Promise<ManagedBotChatRecord[]>;
  updateManagedBotChatMetadata(input: {
    botUsername: string;
    telegramChatId: bigint;
    title: string | undefined;
    type: string | undefined;
    chatUsername: string | undefined;
  }): Promise<void>;
  registerManagedBot(input: {
    ownerTelegramId: bigint;
    botTelegramId: bigint;
    username: string;
    displayName: string;
  }): Promise<ManagedBotRegistrationResult>;
  activateManagedBot(input: {
    botTelegramId: bigint;
    encryptedToken: string;
    tokenFingerprint: string;
    webhookSecretHash: string;
  }): Promise<ManagedBotRecord | null>;
  markManagedBotFailed(botTelegramId: bigint, error: string): Promise<void>;
  getManagedBotToken(botUsername: string): Promise<string | undefined>;
  /** Active managed bots whose entitlement has expired or been revoked. */
  listExpiredActiveBots(now: Date): Promise<ExpiringBot[]>;
  /**
   * Active managed bots whose entitlement expires within `withinMs` and have not
   * yet been warned (expiryWarnedAt is null). For the pre-expiry heads-up DM.
   */
  listBotsExpiringSoon(now: Date, withinMs: number): Promise<ExpiringBot[]>;
  /** Marks that the owner has been warned about an upcoming expiry. */
  markExpiryWarned(id: string): Promise<void>;
  /** Switches a managed bot off (status suspended) with a reason. */
  suspendManagedBot(id: string, reason: string): Promise<void>;
  /**
   * Prepares reactivation of a suspended bot the owner still controls: returns the
   * decrypted token + the entitlement to use (the bot's own if active again, else a
   * free slot). Does NOT mutate — the caller re-sets the webhook first.
   */
  reactivationInfo(
    username: string,
    ownerTelegramId: bigint,
  ): Promise<ReactivationInfo>;
  /** Commits reactivation after the webhook was re-set (consumes a slot if needed). */
  commitReactivation(input: {
    username: string;
    ownerTelegramId: bigint;
    secretHash: string;
    entitlementId: string;
    consumesSlot: boolean;
  }): Promise<boolean>;
  verifyWebhookSecret(
    botUsername: string,
    secretToken: string | undefined,
  ): Promise<boolean | null>;
  /**
   * Rotates the stored webhook secret hash of an active, non-primary managed bot
   * after its webhook was re-registered (e.g. a bulk refresh that widens
   * allowed_updates). A no-op for unknown/inactive/primary bots.
   */
  updateManagedBotWebhookSecret(input: {
    username: string;
    webhookSecretHash: string;
  }): Promise<void>;
}

const toTemplate = (value: ManagedBotTemplateName): ManagedBotTemplate =>
  value as ManagedBotTemplate;

const toRole = (value: PlatformRoleName): PlatformRole => value as PlatformRole;

const toPromoRecord = (promo: {
  id: string;
  codePrefix: string;
  kind: EntitlementKind;
  template: ManagedBotTemplate;
  quantity: number;
  maxUses: number;
  usedCount: number;
  expiresAt: Date | null;
  revokedAt: Date | null;
  note: string | null;
}): PlatformPromoRecord => ({
  id: promo.id,
  codePrefix: promo.codePrefix,
  kind: promo.kind,
  template: promo.template,
  quantity: promo.quantity,
  maxUses: promo.maxUses,
  usedCount: promo.usedCount,
  expiresAt: promo.expiresAt,
  revokedAt: promo.revokedAt,
  note: promo.note,
});

const toEntitlementRecord = (entitlement: {
  id: string;
  ownerTelegramId: bigint;
  kind: EntitlementKind;
  template: ManagedBotTemplate;
  quantity: number;
  usedQuantity: number;
  source: EntitlementSource;
  expiresAt: Date | null;
  revokedAt: Date | null;
}): EntitlementRecord => ({
  id: entitlement.id,
  ownerTelegramId: entitlement.ownerTelegramId,
  kind: entitlement.kind,
  template: entitlement.template,
  quantity: entitlement.quantity,
  usedQuantity: entitlement.usedQuantity,
  source: entitlement.source,
  expiresAt: entitlement.expiresAt,
  revokedAt: entitlement.revokedAt,
});

const toManagedBotRecord = (bot: {
  id: string;
  tenantId: string;
  telegramBotId: bigint | null;
  username: string;
  displayName: string;
  ownerTelegramId: bigint | null;
  template: ManagedBotTemplate;
  status: ManagedBotStatus;
  entitlementId: string | null;
}): ManagedBotRecord => ({
  id: bot.id,
  tenantId: bot.tenantId,
  telegramBotId: bot.telegramBotId,
  username: bot.username,
  displayName: bot.displayName,
  ownerTelegramId: bot.ownerTelegramId,
  template: bot.template,
  status: bot.status,
  entitlementId: bot.entitlementId,
});

const toManagedBotChatRecord = (chat: {
  id: string;
  telegramChatId: bigint;
  type: string;
  title: string | null;
  username: string | null;
  updatedAt: Date;
  _count?: { memberships: number };
}): ManagedBotChatRecord => ({
  chatId: chat.id,
  telegramChatId: chat.telegramChatId,
  type: chat.type,
  title: chat.title,
  username: chat.username,
  memberCount: chat._count?.memberships ?? 0,
  updatedAt: chat.updatedAt,
});

const toPlatformUserBanRecord = (ban: {
  telegramUserId: bigint;
  reason: string;
  bannedByTelegramId: bigint;
  bannedAt: Date;
  expiresAt: Date | null;
  revokedAt: Date | null;
}): PlatformUserBanRecord => ({
  telegramUserId: ban.telegramUserId,
  reason: ban.reason,
  bannedByTelegramId: ban.bannedByTelegramId,
  bannedAt: ban.bannedAt,
  expiresAt: ban.expiresAt,
  revokedAt: ban.revokedAt,
});

export const normalizePromoCode = (code: string): string =>
  code.trim().toUpperCase();

export const hashPromoCode = (code: string): string =>
  createHash("sha256")
    .update(`promo:${normalizePromoCode(code)}`)
    .digest("hex");

export const hashWebhookSecret = (secret: string): string =>
  createHash("sha256").update(`webhook:${secret}`).digest("hex");

export const tokenFingerprint = (token: string): string =>
  createHash("sha256").update(`managed-token:${token}`).digest("hex");

export const generatePromoCode = (): string => {
  const raw = randomBytes(18).toString("base64url").toUpperCase();
  return `SB-${raw.slice(0, 6)}-${raw.slice(6, 12)}-${raw.slice(12, 18)}`;
};

export const generateWebhookSecret = (): string =>
  randomBytes(32).toString("base64url");

const deriveTokenKey = (key: string): Buffer =>
  createHash("sha256").update(`managed-bot-token:${key}`).digest();

export const encryptManagedBotToken = (token: string, key: string): string => {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", deriveTokenKey(key), iv);
  const encrypted = Buffer.concat([
    cipher.update(token, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
};

export const decryptManagedBotToken = (
  encryptedToken: string,
  key: string,
): string => {
  const [version, ivRaw, tagRaw, ciphertextRaw] = encryptedToken.split(".");
  if (version !== "v1" || !ivRaw || !tagRaw || !ciphertextRaw) {
    throw new Error("invalid-managed-bot-token-ciphertext");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    deriveTokenKey(key),
    Buffer.from(ivRaw, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextRaw, "base64url")),
    decipher.final(),
  ]).toString("utf8");
};

const isActive = (record: {
  expiresAt: Date | null;
  revokedAt: Date | null;
}): boolean =>
  !record.revokedAt &&
  (!record.expiresAt || record.expiresAt.getTime() > Date.now());

export class PrismaPlatformRepository implements PlatformRepository {
  constructor(
    private readonly client: PrismaClient = defaultPrisma,
    private readonly tokenKey: string | undefined = undefined,
  ) {}

  async hasRole(
    telegramUserId: bigint,
    role: PlatformRoleName,
  ): Promise<boolean> {
    const count = await this.client.platformRoleAssignment.count({
      where: { telegramUserId, role: toRole(role), revokedAt: null },
    });
    return count > 0;
  }

  async listRoles(
    telegramUserId?: bigint,
  ): Promise<Array<{ telegramUserId: bigint; role: PlatformRoleName }>> {
    const roles = await this.client.platformRoleAssignment.findMany({
      where: { revokedAt: null, ...(telegramUserId ? { telegramUserId } : {}) },
      orderBy: [{ telegramUserId: "asc" }, { role: "asc" }],
    });
    return roles.map((role) => ({
      telegramUserId: role.telegramUserId,
      role: role.role,
    }));
  }

  async grantRole(input: {
    telegramUserId: bigint;
    role: PlatformRoleName;
    grantedByTelegramId: bigint | undefined;
  }): Promise<void> {
    const existing = await this.client.platformRoleAssignment.findFirst({
      where: {
        telegramUserId: input.telegramUserId,
        role: toRole(input.role),
        revokedAt: null,
      },
    });
    if (existing) {
      return;
    }
    const data: Prisma.PlatformRoleAssignmentUncheckedCreateInput = {
      telegramUserId: input.telegramUserId,
      role: toRole(input.role),
      ...(input.grantedByTelegramId
        ? { grantedByTelegramId: input.grantedByTelegramId }
        : {}),
    };
    await this.client.platformRoleAssignment.create({
      data,
    });
  }

  async revokeRole(input: {
    telegramUserId: bigint;
    role: PlatformRoleName;
  }): Promise<void> {
    await this.client.platformRoleAssignment.updateMany({
      where: {
        telegramUserId: input.telegramUserId,
        role: toRole(input.role),
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
  }

  async banPlatformUser(input: {
    telegramUserId: bigint;
    reason: string;
    bannedByTelegramId: bigint;
    expiresAt: Date | undefined;
  }): Promise<PlatformUserBanRecord> {
    const now = new Date();
    const ban = await this.client.platformUserBan.upsert({
      where: { telegramUserId: input.telegramUserId },
      create: {
        telegramUserId: input.telegramUserId,
        reason: input.reason,
        bannedByTelegramId: input.bannedByTelegramId,
        bannedAt: now,
        ...(input.expiresAt ? { expiresAt: input.expiresAt } : {}),
      },
      update: {
        reason: input.reason,
        bannedByTelegramId: input.bannedByTelegramId,
        bannedAt: now,
        expiresAt: input.expiresAt ?? null,
        revokedAt: null,
      },
    });
    return toPlatformUserBanRecord(ban);
  }

  async revokePlatformUserBan(telegramUserId: bigint): Promise<boolean> {
    const result = await this.client.platformUserBan.updateMany({
      where: { telegramUserId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return result.count > 0;
  }

  async getActivePlatformUserBan(
    telegramUserId: bigint,
    now = new Date(),
  ): Promise<PlatformUserBanRecord | null> {
    const ban = await this.client.platformUserBan.findUnique({
      where: { telegramUserId },
    });
    if (
      !ban ||
      ban.revokedAt ||
      (ban.expiresAt && ban.expiresAt.getTime() <= now.getTime())
    ) {
      return null;
    }
    return toPlatformUserBanRecord(ban);
  }

  async listPlatformUserBans(limit = 100): Promise<PlatformUserBanRecord[]> {
    const now = new Date();
    const bans = await this.client.platformUserBan.findMany({
      where: {
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      orderBy: { bannedAt: "desc" },
      take: limit,
    });
    return bans.map(toPlatformUserBanRecord);
  }

  async createPromo(input: {
    tenantId: string | undefined;
    template: ManagedBotTemplateName;
    maxUses: number;
    expiresAt: Date | undefined;
    note: string | undefined;
    createdByTelegramId: bigint;
  }): Promise<CreatedPromoRecord> {
    const code = generatePromoCode();
    const data: Prisma.PromoCodeUncheckedCreateInput = {
      codeHash: hashPromoCode(code),
      codePrefix: code.slice(0, 10),
      kind: EntitlementKind.managed_bot_slot,
      template: toTemplate(input.template),
      quantity: 1,
      maxUses: input.maxUses,
      createdByTelegramId: input.createdByTelegramId,
      ...(input.tenantId ? { tenantId: input.tenantId } : {}),
      ...(input.expiresAt ? { expiresAt: input.expiresAt } : {}),
      ...(input.note ? { note: input.note } : {}),
    };
    const promo = await this.client.promoCode.create({
      data,
    });
    return { ...toPromoRecord(promo), code };
  }

  async listPromos(limit = 25): Promise<PlatformPromoRecord[]> {
    const promos = await this.client.promoCode.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return promos.map(toPromoRecord);
  }

  async revokePromo(codeOrId: string): Promise<boolean> {
    const normalized = normalizePromoCode(codeOrId);
    const codeHash = hashPromoCode(normalized);
    const result = await this.client.promoCode.updateMany({
      where: {
        OR: [{ id: codeOrId }, { codeHash }],
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
    return result.count > 0;
  }

  async redeemPromo(input: {
    code: string;
    redeemedByTelegramId: bigint;
    tenantId: string | undefined;
  }): Promise<PromoRedeemResult> {
    const codeHash = hashPromoCode(input.code);
    try {
      return await this.client.$transaction(async (tx) => {
        const promo = await tx.promoCode.findUnique({ where: { codeHash } });
        if (!promo) {
          return { ok: false, reason: "not-found" } as const;
        }
        if (promo.revokedAt) {
          return { ok: false, reason: "revoked" } as const;
        }
        if (promo.expiresAt && promo.expiresAt.getTime() <= Date.now()) {
          return { ok: false, reason: "expired" } as const;
        }
        if (promo.usedCount >= promo.maxUses) {
          return { ok: false, reason: "used-up" } as const;
        }

        const previous = await tx.promoRedemption.findUnique({
          where: {
            promoCodeId_redeemedByTelegramId: {
              promoCodeId: promo.id,
              redeemedByTelegramId: input.redeemedByTelegramId,
            },
          },
        });
        if (previous) {
          return { ok: false, reason: "already-redeemed" } as const;
        }

        const incremented = await tx.promoCode.updateMany({
          where: {
            id: promo.id,
            revokedAt: null,
            usedCount: { lt: promo.maxUses },
          },
          data: { usedCount: { increment: 1 } },
        });
        if (incremented.count !== 1) {
          return { ok: false, reason: "used-up" } as const;
        }

        const entitlementData: Prisma.EntitlementUncheckedCreateInput = {
          ownerTelegramId: input.redeemedByTelegramId,
          kind: promo.kind,
          template: promo.template,
          quantity: promo.quantity,
          source: EntitlementSource.promo,
          sourceRef: promo.id,
          createdByTelegramId: promo.createdByTelegramId,
          ...(input.tenantId ? { tenantId: input.tenantId } : {}),
          ...(promo.expiresAt ? { expiresAt: promo.expiresAt } : {}),
        };
        const entitlement = await tx.entitlement.create({
          data: entitlementData,
        });

        await tx.promoRedemption.create({
          data: {
            promoCodeId: promo.id,
            redeemedByTelegramId: input.redeemedByTelegramId,
            entitlementId: entitlement.id,
          },
        });

        return {
          ok: true,
          promo: toPromoRecord({ ...promo, usedCount: promo.usedCount + 1 }),
          entitlement: toEntitlementRecord(entitlement),
        } as const;
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return { ok: false, reason: "already-redeemed" };
      }
      throw error;
    }
  }

  async grantManagedBotSlot(input: {
    ownerTelegramId: bigint;
    template: ManagedBotTemplateName;
    expiresAt: Date | undefined;
    createdByTelegramId: bigint | undefined;
    sourceRef?: string | undefined;
  }): Promise<EntitlementRecord> {
    const data: Prisma.EntitlementUncheckedCreateInput = {
      ownerTelegramId: input.ownerTelegramId,
      kind: EntitlementKind.managed_bot_slot,
      template: toTemplate(input.template),
      quantity: 1,
      source: EntitlementSource.manual,
      ...(input.sourceRef ? { sourceRef: input.sourceRef } : {}),
      ...(input.expiresAt ? { expiresAt: input.expiresAt } : {}),
      ...(input.createdByTelegramId
        ? { createdByTelegramId: input.createdByTelegramId }
        : {}),
    };
    const entitlement = await this.client.entitlement.create({
      data,
    });
    return toEntitlementRecord(entitlement);
  }

  async revokeManagedBotSlots(ownerTelegramId: bigint): Promise<number> {
    const result = await this.client.entitlement.updateMany({
      where: {
        ownerTelegramId,
        kind: EntitlementKind.managed_bot_slot,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
    return result.count;
  }

  async listEntitlements(
    ownerTelegramId: bigint,
  ): Promise<EntitlementRecord[]> {
    const entitlements = await this.client.entitlement.findMany({
      where: { ownerTelegramId },
      orderBy: { createdAt: "desc" },
    });
    return entitlements.map(toEntitlementRecord);
  }

  async availableManagedBotSlots(ownerTelegramId: bigint): Promise<number> {
    const entitlements = await this.client.entitlement.findMany({
      where: {
        ownerTelegramId,
        kind: EntitlementKind.managed_bot_slot,
        revokedAt: null,
      },
    });
    return entitlements
      .filter(isActive)
      .reduce(
        (total, entitlement) =>
          total + Math.max(0, entitlement.quantity - entitlement.usedQuantity),
        0,
      );
  }

  async listManagedBots(ownerTelegramId: bigint): Promise<ManagedBotRecord[]> {
    const bots = await this.client.managedBot.findMany({
      where: { ownerTelegramId, isPrimary: false },
      orderBy: { createdAt: "desc" },
    });
    return bots.map(toManagedBotRecord);
  }

  async listAllManagedBots(): Promise<ManagedBotRecord[]> {
    const bots = await this.client.managedBot.findMany({
      where: { isPrimary: false },
      orderBy: { createdAt: "desc" },
    });
    return bots.map(toManagedBotRecord);
  }

  async findManagedBot(username: string): Promise<ManagedBotRecord | null> {
    const uname = username.replace(/^@/u, "").toLowerCase();
    const bot = await this.client.managedBot.findUnique({
      where: { username: uname },
    });
    return bot ? toManagedBotRecord(bot) : null;
  }

  async listManagedBotChats(username: string): Promise<ManagedBotChatRecord[]> {
    const uname = username.replace(/^@/u, "").toLowerCase();
    const bot = await this.client.managedBot.findUnique({
      where: { username: uname },
      select: { tenantId: true },
    });
    if (!bot) {
      return [];
    }
    const chats = await this.client.chat.findMany({
      where: { tenantId: bot.tenantId },
      include: { _count: { select: { memberships: true } } },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    });
    return chats.map(toManagedBotChatRecord);
  }

  async updateManagedBotChatMetadata(input: {
    botUsername: string;
    telegramChatId: bigint;
    title: string | undefined;
    type: string | undefined;
    chatUsername: string | undefined;
  }): Promise<void> {
    const uname = input.botUsername.replace(/^@/u, "").toLowerCase();
    const bot = await this.client.managedBot.findUnique({
      where: { username: uname },
      select: { tenantId: true },
    });
    if (!bot) {
      return;
    }

    const data: Prisma.ChatUpdateManyMutationInput = {};
    const title = input.title?.trim();
    const type = input.type?.trim();
    const chatUsername = input.chatUsername?.trim();
    if (title) {
      data.title = title;
    }
    if (type) {
      data.type = type;
    }
    if (chatUsername) {
      data.username = chatUsername;
    }
    if (Object.keys(data).length === 0) {
      return;
    }

    await this.client.chat.updateMany({
      where: { tenantId: bot.tenantId, telegramChatId: input.telegramChatId },
      data,
    });
  }

  async registerManagedBot(input: {
    ownerTelegramId: bigint;
    botTelegramId: bigint;
    username: string;
    displayName: string;
  }): Promise<ManagedBotRegistrationResult> {
    return this.client.$transaction(async (tx) => {
      const existing = await tx.managedBot.findFirst({
        where: {
          OR: [
            { telegramBotId: input.botTelegramId },
            { username: input.username.toLowerCase() },
          ],
        },
      });
      if (
        existing?.entitlementId &&
        existing.status === ManagedBotStatus.active
      ) {
        return { ok: true, bot: toManagedBotRecord(existing), isNew: false };
      }
      if (existing?.entitlementId) {
        const sameOwner = existing.ownerTelegramId === input.ownerTelegramId;
        if (!sameOwner) {
          // Never silently move an inactive bot (and its already-consumed
          // slot) to a different claimed owner — that's a free takeover,
          // since the new claimant's own entitlement is never checked or
          // consumed. A genuine hand-off needs an explicit, audited admin
          // action, not an inbound Telegram event.
          return { ok: false, reason: "no-slot" };
        }

        const ownEntitlement = await tx.entitlement.findUnique({
          where: { id: existing.entitlementId },
        });
        if (
          ownEntitlement &&
          isActive(ownEntitlement) &&
          ownEntitlement.kind === EntitlementKind.managed_bot_slot
        ) {
          // Bot's own entitlement is still valid — benign reactivation/
          // retry (e.g. Telegram redelivering the managed_bot update while
          // activation is still pending), so it doesn't consume a slot.
          const updated = await tx.managedBot.update({
            where: { id: existing.id },
            data: {
              telegramBotId: input.botTelegramId,
              username: input.username.toLowerCase(),
              displayName: input.displayName,
              status: ManagedBotStatus.pending,
              lastError: null,
            },
          });
          return { ok: true, bot: toManagedBotRecord(updated), isNew: false };
        }
        // Original entitlement lapsed (revoked/expired) — fall through to
        // the same slot lookup + atomic consumption a brand-new
        // registration goes through below, keyed to this same owner.
      }

      const entitlements = await tx.entitlement.findMany({
        where: {
          ownerTelegramId: input.ownerTelegramId,
          kind: EntitlementKind.managed_bot_slot,
          revokedAt: null,
        },
        orderBy: { createdAt: "asc" },
      });
      const entitlement = entitlements.find(
        (entry) => isActive(entry) && entry.usedQuantity < entry.quantity,
      );

      if (
        !entitlement ||
        !isActive(entitlement) ||
        entitlement.usedQuantity >= entitlement.quantity
      ) {
        return { ok: false, reason: "no-slot" };
      }

      const used = await tx.entitlement.updateMany({
        where: {
          id: entitlement.id,
          revokedAt: null,
          usedQuantity: { lt: entitlement.quantity },
        },
        data: { usedQuantity: { increment: 1 } },
      });
      if (used.count !== 1) {
        return { ok: false, reason: "no-slot" };
      }

      // Best-effort bookkeeping: release the slot this bot used to hold on
      // its now-superseded entitlement (the lapsed same-owner reactivation
      // case above), so the ledger doesn't show a permanently "used" slot
      // for a bot that no longer relies on it. Never blocks the transaction.
      if (
        existing?.entitlementId &&
        existing.entitlementId !== entitlement.id
      ) {
        await tx.entitlement.updateMany({
          where: { id: existing.entitlementId, usedQuantity: { gt: 0 } },
          data: { usedQuantity: { decrement: 1 } },
        });
      }

      const username = input.username.toLowerCase();
      const tenant = await tx.tenant.upsert({
        where: { slug: `telegram-${username}` },
        create: { slug: `telegram-${username}`, name: `Telegram @${username}` },
        update: { name: `Telegram @${username}` },
      });
      const bot = await tx.managedBot.upsert({
        where: { username },
        create: {
          tenantId: tenant.id,
          telegramBotId: input.botTelegramId,
          username,
          displayName: input.displayName,
          ownerTelegramId: input.ownerTelegramId,
          template: entitlement.template,
          status: ManagedBotStatus.pending,
          entitlementId: entitlement.id,
          plan: "custom",
        },
        update: {
          tenantId: tenant.id,
          telegramBotId: input.botTelegramId,
          displayName: input.displayName,
          ownerTelegramId: input.ownerTelegramId,
          template: entitlement.template,
          status: ManagedBotStatus.pending,
          entitlementId: entitlement.id,
          lastError: null,
        },
      });
      return {
        ok: true,
        bot: toManagedBotRecord(bot),
        isNew: existing === null,
      };
    });
  }

  async activateManagedBot(input: {
    botTelegramId: bigint;
    encryptedToken: string;
    tokenFingerprint: string;
    webhookSecretHash: string;
  }): Promise<ManagedBotRecord | null> {
    const bot = await this.client.managedBot.updateMany({
      where: { telegramBotId: input.botTelegramId },
      data: {
        encryptedToken: input.encryptedToken,
        tokenFingerprint: input.tokenFingerprint,
        webhookSecretHash: input.webhookSecretHash,
        tokenLastRotatedAt: new Date(),
        lastActivatedAt: new Date(),
        status: ManagedBotStatus.active,
        lastError: null,
      },
    });
    if (bot.count !== 1) {
      return null;
    }
    const updated = await this.client.managedBot.findUnique({
      where: { telegramBotId: input.botTelegramId },
    });
    return updated ? toManagedBotRecord(updated) : null;
  }

  async markManagedBotFailed(
    botTelegramId: bigint,
    error: string,
  ): Promise<void> {
    await this.client.managedBot.updateMany({
      where: { telegramBotId: botTelegramId },
      data: { status: ManagedBotStatus.failed, lastError: error.slice(0, 500) },
    });
  }

  async getManagedBotToken(botUsername: string): Promise<string | undefined> {
    const username = botUsername.replace(/^@/u, "").toLowerCase();
    const bot = await this.client.managedBot.findUnique({
      where: { username },
    });
    if (
      !bot?.encryptedToken ||
      bot.status !== ManagedBotStatus.active ||
      bot.isPrimary
    ) {
      return undefined;
    }
    if (!this.tokenKey) {
      throw new Error("missing-managed-bot-token-key");
    }
    return decryptManagedBotToken(bot.encryptedToken, this.tokenKey);
  }

  async verifyWebhookSecret(
    botUsername: string,
    secretToken: string | undefined,
  ): Promise<boolean | null> {
    const username = botUsername.replace(/^@/u, "").toLowerCase();
    const bot = await this.client.managedBot.findUnique({
      where: { username },
    });
    if (!bot || bot.isPrimary) {
      return null;
    }
    if (bot.status !== ManagedBotStatus.active) {
      // A suspended/revoked/pending/failed bot must never accept webhook
      // traffic, even if a stale secret hash is still on file — otherwise
      // resolveBotToken()'s primary-token fallback could process a forged
      // request for an inactive child as if it were the primary bot.
      return false;
    }
    if (!bot.webhookSecretHash) {
      return null;
    }
    return secretToken
      ? hashWebhookSecret(secretToken) === bot.webhookSecretHash
      : false;
  }

  async updateManagedBotWebhookSecret(input: {
    username: string;
    webhookSecretHash: string;
  }): Promise<void> {
    const username = input.username.replace(/^@/u, "").toLowerCase();
    await this.client.managedBot.updateMany({
      where: { username, status: ManagedBotStatus.active, isPrimary: false },
      data: { webhookSecretHash: input.webhookSecretHash },
    });
  }

  private async activeBotsWithEntitlement(onlyUnwarned: boolean): Promise<
    Array<{
      id: string;
      username: string;
      ownerTelegramId: bigint | null;
      entitlement: { expiresAt: Date | null; revokedAt: Date | null };
    }>
  > {
    const bots = await this.client.managedBot.findMany({
      where: {
        status: ManagedBotStatus.active,
        entitlementId: { not: null },
        ...(onlyUnwarned ? { expiryWarnedAt: null } : {}),
      },
    });
    if (bots.length === 0) {
      return [];
    }
    const entitlementIds = [
      ...new Set(
        bots
          .map((bot) => bot.entitlementId)
          .filter((id): id is string => id !== null),
      ),
    ];
    const entitlements = await this.client.entitlement.findMany({
      where: { id: { in: entitlementIds } },
    });
    const byId = new Map(entitlements.map((entry) => [entry.id, entry]));
    return bots.flatMap((bot) => {
      const entitlement = bot.entitlementId
        ? byId.get(bot.entitlementId)
        : undefined;
      if (!entitlement) {
        return [];
      }
      return [
        {
          id: bot.id,
          username: bot.username,
          ownerTelegramId: bot.ownerTelegramId,
          entitlement: {
            expiresAt: entitlement.expiresAt,
            revokedAt: entitlement.revokedAt,
          },
        },
      ];
    });
  }

  async listExpiredActiveBots(now: Date): Promise<ExpiringBot[]> {
    const bots = await this.activeBotsWithEntitlement(false);
    return bots
      .filter(
        (bot) =>
          bot.entitlement.revokedAt !== null ||
          (bot.entitlement.expiresAt !== null &&
            bot.entitlement.expiresAt.getTime() <= now.getTime()),
      )
      .map((bot) => ({
        id: bot.id,
        username: bot.username,
        ownerTelegramId: bot.ownerTelegramId,
        expiresAt: bot.entitlement.expiresAt,
      }));
  }

  async listBotsExpiringSoon(
    now: Date,
    withinMs: number,
  ): Promise<ExpiringBot[]> {
    const bots = await this.activeBotsWithEntitlement(true);
    const cutoff = now.getTime() + withinMs;
    return bots
      .filter(
        (bot) =>
          bot.entitlement.revokedAt === null &&
          bot.entitlement.expiresAt !== null &&
          bot.entitlement.expiresAt.getTime() > now.getTime() &&
          bot.entitlement.expiresAt.getTime() <= cutoff,
      )
      .map((bot) => ({
        id: bot.id,
        username: bot.username,
        ownerTelegramId: bot.ownerTelegramId,
        expiresAt: bot.entitlement.expiresAt,
      }));
  }

  async markExpiryWarned(id: string): Promise<void> {
    await this.client.managedBot.updateMany({
      where: { id },
      data: { expiryWarnedAt: new Date() },
    });
  }

  async suspendManagedBot(id: string, reason: string): Promise<void> {
    await this.client.managedBot.updateMany({
      where: { id, status: ManagedBotStatus.active },
      data: {
        status: ManagedBotStatus.suspended,
        lastError: reason.slice(0, 500),
        webhookSecretHash: null,
      },
    });
  }

  async reactivationInfo(
    username: string,
    ownerTelegramId: bigint,
  ): Promise<ReactivationInfo> {
    const uname = username.replace(/^@/u, "").toLowerCase();
    const bot = await this.client.managedBot.findUnique({
      where: { username: uname },
    });
    if (!bot) {
      return { ok: false, reason: "not-found" };
    }
    if (bot.ownerTelegramId !== ownerTelegramId) {
      return { ok: false, reason: "not-owner" };
    }
    if (bot.status !== ManagedBotStatus.suspended) {
      return { ok: false, reason: "not-suspended" };
    }
    if (!bot.encryptedToken || !this.tokenKey) {
      return { ok: false, reason: "no-token" };
    }
    const token = decryptManagedBotToken(bot.encryptedToken, this.tokenKey);
    // If the bot's own entitlement is active again (renewed), no new slot needed.
    const own = bot.entitlementId
      ? await this.client.entitlement.findUnique({
          where: { id: bot.entitlementId },
        })
      : null;
    if (own && isActive(own) && own.kind === EntitlementKind.managed_bot_slot) {
      return { ok: true, token, entitlementId: own.id, consumesSlot: false };
    }
    // Otherwise the owner must spend a fresh slot to bring it back.
    const entitlements = await this.client.entitlement.findMany({
      where: {
        ownerTelegramId,
        kind: EntitlementKind.managed_bot_slot,
        revokedAt: null,
      },
      orderBy: { createdAt: "asc" },
    });
    const free = entitlements.find(
      (entry) => isActive(entry) && entry.usedQuantity < entry.quantity,
    );
    if (!free) {
      return { ok: false, reason: "no-slot" };
    }
    return { ok: true, token, entitlementId: free.id, consumesSlot: true };
  }

  async commitReactivation(input: {
    username: string;
    ownerTelegramId: bigint;
    secretHash: string;
    entitlementId: string;
    consumesSlot: boolean;
  }): Promise<boolean> {
    const uname = input.username.replace(/^@/u, "").toLowerCase();
    return this.client.$transaction(async (tx) => {
      if (input.consumesSlot) {
        const entitlement = await tx.entitlement.findUnique({
          where: { id: input.entitlementId },
        });
        if (!entitlement) {
          return false;
        }
        const used = await tx.entitlement.updateMany({
          where: {
            id: input.entitlementId,
            revokedAt: null,
            usedQuantity: { lt: entitlement.quantity },
          },
          data: { usedQuantity: { increment: 1 } },
        });
        if (used.count !== 1) {
          return false;
        }
      }
      const updated = await tx.managedBot.updateMany({
        where: {
          username: uname,
          ownerTelegramId: input.ownerTelegramId,
          status: ManagedBotStatus.suspended,
        },
        data: {
          status: ManagedBotStatus.active,
          entitlementId: input.entitlementId,
          webhookSecretHash: input.secretHash,
          expiryWarnedAt: null,
          lastError: null,
          lastActivatedAt: new Date(),
        },
      });
      return updated.count === 1;
    });
  }
}

export class InMemoryPlatformRepository implements PlatformRepository {
  private readonly roles = new Map<string, Set<PlatformRoleName>>();
  private readonly promos = new Map<string, CreatedPromoRecord>();
  private readonly redemptions = new Set<string>();
  private readonly entitlements = new Map<string, EntitlementRecord>();
  private readonly platformBans = new Map<string, PlatformUserBanRecord>();
  private readonly bots = new Map<
    string,
    ManagedBotRecord & { token?: string; secretHash?: string }
  >();

  async hasRole(
    telegramUserId: bigint,
    role: PlatformRoleName,
  ): Promise<boolean> {
    return this.roles.get(telegramUserId.toString())?.has(role) ?? false;
  }

  async listRoles(telegramUserId?: bigint) {
    const rows: Array<{ telegramUserId: bigint; role: PlatformRoleName }> = [];
    for (const [id, roles] of this.roles) {
      if (telegramUserId && id !== telegramUserId.toString()) {
        continue;
      }
      for (const role of roles) {
        rows.push({ telegramUserId: BigInt(id), role });
      }
    }
    return rows;
  }

  async grantRole(input: {
    telegramUserId: bigint;
    role: PlatformRoleName;
  }): Promise<void> {
    const key = input.telegramUserId.toString();
    const roles = this.roles.get(key) ?? new Set<PlatformRoleName>();
    roles.add(input.role);
    this.roles.set(key, roles);
  }

  async revokeRole(input: {
    telegramUserId: bigint;
    role: PlatformRoleName;
  }): Promise<void> {
    this.roles.get(input.telegramUserId.toString())?.delete(input.role);
  }

  async banPlatformUser(input: {
    telegramUserId: bigint;
    reason: string;
    bannedByTelegramId: bigint;
    expiresAt: Date | undefined;
  }): Promise<PlatformUserBanRecord> {
    const now = new Date();
    const ban: PlatformUserBanRecord = {
      telegramUserId: input.telegramUserId,
      reason: input.reason,
      bannedByTelegramId: input.bannedByTelegramId,
      bannedAt: now,
      expiresAt: input.expiresAt ?? null,
      revokedAt: null,
    };
    this.platformBans.set(input.telegramUserId.toString(), ban);
    return ban;
  }

  async revokePlatformUserBan(telegramUserId: bigint): Promise<boolean> {
    const key = telegramUserId.toString();
    const ban = this.platformBans.get(key);
    if (!ban || ban.revokedAt) {
      return false;
    }
    this.platformBans.set(key, { ...ban, revokedAt: new Date() });
    return true;
  }

  async getActivePlatformUserBan(
    telegramUserId: bigint,
    now = new Date(),
  ): Promise<PlatformUserBanRecord | null> {
    const ban = this.platformBans.get(telegramUserId.toString());
    if (
      !ban ||
      ban.revokedAt ||
      (ban.expiresAt && ban.expiresAt.getTime() <= now.getTime())
    ) {
      return null;
    }
    return ban;
  }

  async listPlatformUserBans(limit = 100): Promise<PlatformUserBanRecord[]> {
    const now = new Date();
    return [...this.platformBans.values()]
      .filter(
        (ban) =>
          !ban.revokedAt &&
          (!ban.expiresAt || ban.expiresAt.getTime() > now.getTime()),
      )
      .sort((left, right) => right.bannedAt.getTime() - left.bannedAt.getTime())
      .slice(0, limit);
  }

  async createPromo(input: {
    tenantId: string | undefined;
    template: ManagedBotTemplateName;
    maxUses: number;
    expiresAt: Date | undefined;
    note: string | undefined;
    createdByTelegramId: bigint;
  }): Promise<CreatedPromoRecord> {
    const code = generatePromoCode();
    const promo: CreatedPromoRecord = {
      id: `promo_${this.promos.size + 1}`,
      code,
      codePrefix: code.slice(0, 10),
      kind: "managed_bot_slot",
      template: input.template,
      quantity: 1,
      maxUses: input.maxUses,
      usedCount: 0,
      expiresAt: input.expiresAt ?? null,
      revokedAt: null,
      note: input.note ?? null,
    };
    this.promos.set(hashPromoCode(code), promo);
    return promo;
  }

  async listPromos(): Promise<PlatformPromoRecord[]> {
    return [...this.promos.values()];
  }

  async revokePromo(codeOrId: string): Promise<boolean> {
    const key = hashPromoCode(codeOrId);
    const promo =
      this.promos.get(key) ??
      [...this.promos.values()].find((entry) => entry.id === codeOrId);
    if (!promo || promo.revokedAt) {
      return false;
    }
    const revoked = { ...promo, revokedAt: new Date() };
    this.promos.set(hashPromoCode(promo.code), revoked);
    return true;
  }

  async redeemPromo(input: {
    code: string;
    redeemedByTelegramId: bigint;
    tenantId: string | undefined;
  }): Promise<PromoRedeemResult> {
    const key = hashPromoCode(input.code);
    const promo = this.promos.get(key);
    if (!promo) {
      return { ok: false, reason: "not-found" };
    }
    if (promo.revokedAt) {
      return { ok: false, reason: "revoked" };
    }
    if (promo.expiresAt && promo.expiresAt.getTime() <= Date.now()) {
      return { ok: false, reason: "expired" };
    }
    if (promo.usedCount >= promo.maxUses) {
      return { ok: false, reason: "used-up" };
    }
    const redemptionKey = `${promo.id}:${input.redeemedByTelegramId.toString()}`;
    if (this.redemptions.has(redemptionKey)) {
      return { ok: false, reason: "already-redeemed" };
    }
    this.redemptions.add(redemptionKey);
    const entitlement = await this.grantManagedBotSlot({
      ownerTelegramId: input.redeemedByTelegramId,
      template: promo.template,
      expiresAt: promo.expiresAt ?? undefined,
      createdByTelegramId: undefined,
      sourceRef: promo.id,
    });
    const updated = { ...promo, usedCount: promo.usedCount + 1 };
    this.promos.set(key, updated);
    return { ok: true, promo: updated, entitlement };
  }

  async grantManagedBotSlot(input: {
    ownerTelegramId: bigint;
    template: ManagedBotTemplateName;
    expiresAt: Date | undefined;
    createdByTelegramId?: bigint | undefined;
    sourceRef?: string | undefined;
  }): Promise<EntitlementRecord> {
    const entitlement: EntitlementRecord = {
      id: `ent_${this.entitlements.size + 1}`,
      ownerTelegramId: input.ownerTelegramId,
      kind: "managed_bot_slot",
      template: input.template,
      quantity: 1,
      usedQuantity: 0,
      source: "manual",
      expiresAt: input.expiresAt ?? null,
      revokedAt: null,
    };
    this.entitlements.set(entitlement.id, entitlement);
    return entitlement;
  }

  async revokeManagedBotSlots(ownerTelegramId: bigint): Promise<number> {
    let count = 0;
    for (const [id, entitlement] of this.entitlements) {
      if (
        entitlement.ownerTelegramId === ownerTelegramId &&
        entitlement.kind === "managed_bot_slot" &&
        !entitlement.revokedAt
      ) {
        this.entitlements.set(id, { ...entitlement, revokedAt: new Date() });
        count += 1;
      }
    }
    return count;
  }

  async listEntitlements(
    ownerTelegramId: bigint,
  ): Promise<EntitlementRecord[]> {
    return [...this.entitlements.values()].filter(
      (entry) => entry.ownerTelegramId === ownerTelegramId,
    );
  }

  async availableManagedBotSlots(ownerTelegramId: bigint): Promise<number> {
    return [...this.entitlements.values()]
      .filter((entry) => entry.ownerTelegramId === ownerTelegramId)
      .filter(isActive)
      .reduce(
        (total, entry) =>
          total + Math.max(0, entry.quantity - entry.usedQuantity),
        0,
      );
  }

  async listManagedBots(ownerTelegramId: bigint): Promise<ManagedBotRecord[]> {
    return [...this.bots.values()].filter(
      (bot) => bot.ownerTelegramId === ownerTelegramId,
    );
  }

  async listAllManagedBots(): Promise<ManagedBotRecord[]> {
    return [...this.bots.values()];
  }

  async findManagedBot(username: string): Promise<ManagedBotRecord | null> {
    const uname = username.replace(/^@/u, "").toLowerCase();
    return (
      [...this.bots.values()].find((bot) => bot.username === uname) ?? null
    );
  }

  async listManagedBotChats(
    _username: string,
  ): Promise<ManagedBotChatRecord[]> {
    return [];
  }

  async updateManagedBotChatMetadata(): Promise<void> {}

  async registerManagedBot(input: {
    ownerTelegramId: bigint;
    botTelegramId: bigint;
    username: string;
    displayName: string;
  }): Promise<ManagedBotRegistrationResult> {
    const entitlement = [...this.entitlements.values()].find(
      (entry) =>
        entry.ownerTelegramId === input.ownerTelegramId &&
        entry.kind === "managed_bot_slot" &&
        isActive(entry) &&
        entry.usedQuantity < entry.quantity,
    );
    if (!entitlement) {
      return { ok: false, reason: "no-slot" };
    }
    this.entitlements.set(entitlement.id, {
      ...entitlement,
      usedQuantity: entitlement.usedQuantity + 1,
    });
    const bot: ManagedBotRecord = {
      id: `bot_${this.bots.size + 1}`,
      tenantId: `tenant_${input.username.toLowerCase()}`,
      telegramBotId: input.botTelegramId,
      username: input.username.toLowerCase(),
      displayName: input.displayName,
      ownerTelegramId: input.ownerTelegramId,
      template: entitlement.template,
      status: "pending",
      entitlementId: entitlement.id,
    };
    this.bots.set(input.botTelegramId.toString(), bot);
    return { ok: true, bot, isNew: true };
  }

  async activateManagedBot(input: {
    botTelegramId: bigint;
    encryptedToken: string;
    tokenFingerprint: string;
    webhookSecretHash: string;
  }): Promise<ManagedBotRecord | null> {
    const existing = this.bots.get(input.botTelegramId.toString());
    if (!existing) {
      return null;
    }
    const bot = {
      ...existing,
      status: "active" as const,
      token: input.encryptedToken,
      secretHash: input.webhookSecretHash,
    };
    this.bots.set(input.botTelegramId.toString(), bot);
    return bot;
  }

  async markManagedBotFailed(): Promise<void> {}

  async getManagedBotToken(botUsername: string): Promise<string | undefined> {
    const uname = botUsername.replace(/^@/u, "").toLowerCase();
    const bot = [...this.bots.values()].find(
      (entry) => entry.username === uname,
    );
    return bot?.status === "active" ? bot.token : undefined;
  }

  async verifyWebhookSecret(): Promise<boolean | null> {
    return null;
  }

  async updateManagedBotWebhookSecret(input: {
    username: string;
    webhookSecretHash: string;
  }): Promise<void> {
    const uname = input.username.replace(/^@/u, "").toLowerCase();
    for (const [key, bot] of this.bots) {
      if (bot.username === uname && bot.status === "active") {
        this.bots.set(key, { ...bot, secretHash: input.webhookSecretHash });
      }
    }
  }

  private readonly warned = new Set<string>();

  private activeWithEntitlement(bot: ManagedBotRecord) {
    if (bot.status !== "active" || !bot.entitlementId) {
      return undefined;
    }
    return this.entitlements.get(bot.entitlementId);
  }

  async listExpiredActiveBots(now: Date): Promise<ExpiringBot[]> {
    return [...this.bots.values()].flatMap((bot) => {
      const entitlement = this.activeWithEntitlement(bot);
      if (!entitlement) {
        return [];
      }
      const expired =
        entitlement.revokedAt !== null ||
        (entitlement.expiresAt !== null &&
          entitlement.expiresAt.getTime() <= now.getTime());
      return expired
        ? [
            {
              id: bot.id,
              username: bot.username,
              ownerTelegramId: bot.ownerTelegramId ?? null,
              expiresAt: entitlement.expiresAt,
            },
          ]
        : [];
    });
  }

  async listBotsExpiringSoon(
    now: Date,
    withinMs: number,
  ): Promise<ExpiringBot[]> {
    const cutoff = now.getTime() + withinMs;
    return [...this.bots.values()].flatMap((bot) => {
      if (this.warned.has(bot.id)) {
        return [];
      }
      const entitlement = this.activeWithEntitlement(bot);
      if (
        !entitlement ||
        entitlement.revokedAt !== null ||
        entitlement.expiresAt === null ||
        entitlement.expiresAt.getTime() <= now.getTime() ||
        entitlement.expiresAt.getTime() > cutoff
      ) {
        return [];
      }
      return [
        {
          id: bot.id,
          username: bot.username,
          ownerTelegramId: bot.ownerTelegramId ?? null,
          expiresAt: entitlement.expiresAt,
        },
      ];
    });
  }

  async markExpiryWarned(id: string): Promise<void> {
    this.warned.add(id);
  }

  async suspendManagedBot(id: string, _reason: string): Promise<void> {
    for (const [key, bot] of this.bots) {
      if (bot.id === id && bot.status === "active") {
        this.bots.set(key, { ...bot, status: "suspended" });
      }
    }
  }

  async reactivationInfo(
    username: string,
    ownerTelegramId: bigint,
  ): Promise<ReactivationInfo> {
    const uname = username.replace(/^@/u, "").toLowerCase();
    const bot = [...this.bots.values()].find((b) => b.username === uname);
    if (!bot) {
      return { ok: false, reason: "not-found" };
    }
    if (bot.ownerTelegramId !== ownerTelegramId) {
      return { ok: false, reason: "not-owner" };
    }
    if (bot.status !== "suspended") {
      return { ok: false, reason: "not-suspended" };
    }
    if (!bot.token) {
      return { ok: false, reason: "no-token" };
    }
    const own = bot.entitlementId
      ? this.entitlements.get(bot.entitlementId)
      : undefined;
    if (own && isActive(own)) {
      return {
        ok: true,
        token: bot.token,
        entitlementId: own.id,
        consumesSlot: false,
      };
    }
    const free = [...this.entitlements.values()].find(
      (entry) =>
        entry.ownerTelegramId === ownerTelegramId &&
        isActive(entry) &&
        entry.usedQuantity < entry.quantity,
    );
    if (!free) {
      return { ok: false, reason: "no-slot" };
    }
    return {
      ok: true,
      token: bot.token,
      entitlementId: free.id,
      consumesSlot: true,
    };
  }

  async commitReactivation(input: {
    username: string;
    ownerTelegramId: bigint;
    secretHash: string;
    entitlementId: string;
    consumesSlot: boolean;
  }): Promise<boolean> {
    const uname = input.username.replace(/^@/u, "").toLowerCase();
    for (const [key, bot] of this.bots) {
      if (
        bot.username === uname &&
        bot.ownerTelegramId === input.ownerTelegramId &&
        bot.status === "suspended"
      ) {
        if (input.consumesSlot) {
          const entitlement = this.entitlements.get(input.entitlementId);
          if (entitlement) {
            this.entitlements.set(entitlement.id, {
              ...entitlement,
              usedQuantity: entitlement.usedQuantity + 1,
            });
          }
        }
        this.bots.set(key, {
          ...bot,
          status: "active",
          entitlementId: input.entitlementId,
        });
        return true;
      }
    }
    return false;
  }
}
