import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "./client.js";

export interface RecordFileInput {
  readonly tenantId: string;
  readonly chatId: string;
  readonly telegramUserId: bigint;
  readonly fileUniqueId: string;
  readonly fileId: string;
  readonly kind: string;
  readonly mimeType: string | undefined;
  readonly fileSize: number | undefined;
  readonly fileName: string | undefined;
}

export interface RecordFileResult {
  readonly deduped: boolean;
  readonly fileAssetId: string;
}

export interface FileAssetSummary {
  readonly fileUniqueId: string;
  readonly kind: string;
  readonly fileSize: number;
  readonly fileName: string | null;
}

export interface FileRepository {
  recordFile(input: RecordFileInput): Promise<RecordFileResult>;
  listFiles(
    tenantId: string,
    chatId: string,
    limit?: number,
  ): Promise<FileAssetSummary[]>;
  quotaUsageBytes(tenantId: string, chatId: string): Promise<number>;
}

export class PrismaFileRepository implements FileRepository {
  constructor(private readonly client: PrismaClient = defaultPrisma) {}

  async recordFile(input: RecordFileInput): Promise<RecordFileResult> {
    const existing = await this.client.fileAsset.findUnique({
      where: {
        tenantId_fileUniqueId: {
          tenantId: input.tenantId,
          fileUniqueId: input.fileUniqueId,
        },
      },
    });

    if (existing) {
      return { deduped: true, fileAssetId: existing.id };
    }

    try {
      const created = await this.client.fileAsset.create({
        data: {
          tenantId: input.tenantId,
          chatId: input.chatId,
          telegramUserId: input.telegramUserId,
          fileUniqueId: input.fileUniqueId,
          fileId: input.fileId,
          kind: input.kind,
          fileSize: input.fileSize ?? 0,
          ...(input.mimeType ? { mimeType: input.mimeType } : {}),
          ...(input.fileName ? { fileName: input.fileName } : {}),
        },
      });
      return { deduped: false, fileAssetId: created.id };
    } catch (error) {
      // Concurrent insert of the same unique id collapses to a dedup hit.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const winner = await this.client.fileAsset.findUnique({
          where: {
            tenantId_fileUniqueId: {
              tenantId: input.tenantId,
              fileUniqueId: input.fileUniqueId,
            },
          },
        });
        return { deduped: true, fileAssetId: winner?.id ?? "" };
      }
      throw error;
    }
  }

  async listFiles(
    tenantId: string,
    chatId: string,
    limit = 20,
  ): Promise<FileAssetSummary[]> {
    const files = await this.client.fileAsset.findMany({
      where: { tenantId, chatId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return files.map((file) => ({
      fileUniqueId: file.fileUniqueId,
      kind: file.kind,
      fileSize: file.fileSize,
      fileName: file.fileName,
    }));
  }

  async quotaUsageBytes(tenantId: string, chatId: string): Promise<number> {
    const result = await this.client.fileAsset.aggregate({
      where: { tenantId, chatId },
      _sum: { fileSize: true },
    });

    return result._sum.fileSize ?? 0;
  }
}
