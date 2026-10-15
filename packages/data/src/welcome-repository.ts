import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "./client.js";

/**
 * One stored welcome inline button. The data layer stays deliberately dumb about
 * button *semantics* (which type does what) — it only persists/returns the raw
 * shape. The bot (modules/community) validates and renders these.
 */
export interface WelcomeButtonRecord {
  readonly type: string;
  readonly text: string;
  readonly url?: string | null;
}

export interface WelcomeConfigState {
  readonly welcomeText: string | null;
  readonly goodbyeText: string | null;
  readonly rulesText: string | null;
  /** null = no photo; otherwise the sendPhoto type ("jpg" | "png" | "webp"). */
  readonly welcomeMediaType: string | null;
  readonly welcomeButtons: readonly WelcomeButtonRecord[] | null;
}

export interface WelcomeConfigUpdate {
  readonly welcomeText?: string | null;
  readonly goodbyeText?: string | null;
  readonly rulesText?: string | null;
  readonly welcomeButtons?: readonly WelcomeButtonRecord[];
}

export interface WelcomeMediaState {
  readonly mimeType: string;
  /** base64-encoded image bytes, ready to hand to Telegram sendPhoto. */
  readonly data: string;
}

export interface WelcomeRepository {
  getConfig(chatId: string): Promise<WelcomeConfigState | null>;
  upsertConfig(
    tenantId: string,
    chatId: string,
    update: WelcomeConfigUpdate,
  ): Promise<WelcomeConfigState>;
  getMedia(chatId: string): Promise<WelcomeMediaState | null>;
  setMedia(
    tenantId: string,
    chatId: string,
    mimeType: string,
    mediaType: string,
    data: string,
  ): Promise<void>;
  clearMedia(chatId: string): Promise<void>;
}

const toButtonRecords = (
  value: Prisma.JsonValue | null,
): readonly WelcomeButtonRecord[] | null =>
  Array.isArray(value) ? (value as unknown as WelcomeButtonRecord[]) : null;

export class PrismaWelcomeRepository implements WelcomeRepository {
  constructor(private readonly client: PrismaClient = defaultPrisma) {}

  async getConfig(chatId: string): Promise<WelcomeConfigState | null> {
    const config = await this.client.welcomeConfig.findUnique({
      where: { chatId },
    });

    if (!config) {
      return null;
    }

    return {
      welcomeText: config.welcomeText,
      goodbyeText: config.goodbyeText,
      rulesText: config.rulesText,
      welcomeMediaType: config.welcomeMediaType,
      welcomeButtons: toButtonRecords(config.welcomeButtons),
    };
  }

  async upsertConfig(
    tenantId: string,
    chatId: string,
    update: WelcomeConfigUpdate,
  ): Promise<WelcomeConfigState> {
    const data = {
      ...(update.welcomeText !== undefined
        ? { welcomeText: update.welcomeText }
        : {}),
      ...(update.goodbyeText !== undefined
        ? { goodbyeText: update.goodbyeText }
        : {}),
      ...(update.rulesText !== undefined
        ? { rulesText: update.rulesText }
        : {}),
      ...(update.welcomeButtons !== undefined
        ? {
            welcomeButtons:
              update.welcomeButtons as unknown as Prisma.InputJsonValue,
          }
        : {}),
    };
    const config = await this.client.welcomeConfig.upsert({
      where: { chatId },
      create: { tenantId, chatId, ...data },
      update: data,
    });

    return {
      welcomeText: config.welcomeText,
      goodbyeText: config.goodbyeText,
      rulesText: config.rulesText,
      welcomeMediaType: config.welcomeMediaType,
      welcomeButtons: toButtonRecords(config.welcomeButtons),
    };
  }

  async getMedia(chatId: string): Promise<WelcomeMediaState | null> {
    const media = await this.client.welcomeMedia.findUnique({
      where: { chatId },
    });

    return media ? { mimeType: media.mimeType, data: media.data } : null;
  }

  async setMedia(
    tenantId: string,
    chatId: string,
    mimeType: string,
    mediaType: string,
    data: string,
  ): Promise<void> {
    // Two tables kept consistent: the bytes live in welcome_media, while the
    // frequently-read welcome_configs row carries only the "has media" signal
    // (welcomeMediaType) so a welcome send never drags the image bytes along.
    await this.client.$transaction([
      this.client.welcomeMedia.upsert({
        where: { chatId },
        create: { tenantId, chatId, mimeType, data },
        update: { mimeType, data },
      }),
      this.client.welcomeConfig.upsert({
        where: { chatId },
        create: { tenantId, chatId, welcomeMediaType: mediaType },
        update: { welcomeMediaType: mediaType },
      }),
    ]);
  }

  async clearMedia(chatId: string): Promise<void> {
    await this.client.$transaction([
      this.client.welcomeMedia.deleteMany({ where: { chatId } }),
      this.client.welcomeConfig.updateMany({
        where: { chatId },
        data: { welcomeMediaType: null },
      }),
    ]);
  }
}
