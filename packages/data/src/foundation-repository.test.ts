import { Prisma, type PrismaClient } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { PrismaFoundationRepository } from "./foundation-repository.js";

interface FakeUpdateInboxRow {
  botKey: string;
  updateId: bigint;
  processedAt: Date | null;
}

const p2002 = (): Prisma.PrismaClientKnownRequestError =>
  new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "test",
  });

const buildFakeClient = (rows: FakeUpdateInboxRow[]): PrismaClient =>
  ({
    updateInbox: {
      create: async ({
        data,
      }: {
        data: { botKey: string; updateId: bigint };
      }) => {
        if (
          rows.some(
            (r) => r.botKey === data.botKey && r.updateId === data.updateId,
          )
        ) {
          throw p2002();
        }
        rows.push({
          botKey: data.botKey,
          updateId: data.updateId,
          processedAt: null,
        });
      },
      findUnique: async ({
        where,
      }: {
        where: { botKey_updateId: { botKey: string; updateId: bigint } };
      }) => {
        const key = where.botKey_updateId;
        return (
          rows.find(
            (r) => r.botKey === key.botKey && r.updateId === key.updateId,
          ) ?? null
        );
      },
    },
    // biome-ignore lint/suspicious/noExplicitAny: minimal Prisma double for claimUpdate
  }) as any;

describe("PrismaFoundationRepository.claimUpdate", () => {
  it("returns 'claimed' on a brand-new (botKey, updateId)", async () => {
    const repo = new PrismaFoundationRepository(buildFakeClient([]));
    const outcome = await repo.claimUpdate({
      tenantId: "t1",
      botKey: "bot",
      updateId: 1,
      payload: {},
    });
    expect(outcome).toBe("claimed");
  });

  it("returns 'retry' when the row exists but was never marked processed", async () => {
    const rows: FakeUpdateInboxRow[] = [
      { botKey: "bot", updateId: 1n, processedAt: null },
    ];
    const repo = new PrismaFoundationRepository(buildFakeClient(rows));
    const outcome = await repo.claimUpdate({
      tenantId: "t1",
      botKey: "bot",
      updateId: 1,
      payload: {},
    });
    expect(outcome).toBe("retry");
  });

  it("returns 'already-processed' when the row is finished", async () => {
    const rows: FakeUpdateInboxRow[] = [
      { botKey: "bot", updateId: 1n, processedAt: new Date() },
    ];
    const repo = new PrismaFoundationRepository(buildFakeClient(rows));
    const outcome = await repo.claimUpdate({
      tenantId: "t1",
      botKey: "bot",
      updateId: 1,
      payload: {},
    });
    expect(outcome).toBe("already-processed");
  });

  it("lowercases botKey consistently between the claim attempt and the retry lookup", async () => {
    const rows: FakeUpdateInboxRow[] = [
      { botKey: "mybot", updateId: 1n, processedAt: null },
    ];
    const repo = new PrismaFoundationRepository(buildFakeClient(rows));
    const outcome = await repo.claimUpdate({
      tenantId: "t1",
      botKey: "MyBot",
      updateId: 1,
      payload: {},
    });
    expect(outcome).toBe("retry");
  });
});

describe("PrismaFoundationRepository.upsertUser concurrent first-contact race", () => {
  const envelope = (userId: bigint) =>
    ({ user: { userId } }) as unknown as Parameters<
      PrismaFoundationRepository["ensureContext"]
    >[0];

  it("returns the winner's row instead of throwing when a concurrent create hits P2002", async () => {
    const raced = {
      id: "u1",
      tenantId: "t1",
      telegramUserId: 7n,
      username: null,
      displayName: null,
      languageCode: null,
    };
    let findCalls = 0;
    let createCalls = 0;
    const client = {
      appUser: {
        findUnique: async () => {
          findCalls += 1;
          // First lookup (before create) sees nothing; the post-P2002 re-read
          // returns the row the concurrent winner committed.
          return findCalls === 1 ? null : raced;
        },
        create: async () => {
          createCalls += 1;
          throw p2002();
        },
      },
    } as unknown as PrismaClient;

    const repo = new PrismaFoundationRepository(client);
    const result = await (
      repo as unknown as {
        upsertUser: (t: string, u: unknown) => Promise<unknown>;
      }
    ).upsertUser("t1", envelope(7n));

    expect(result).toEqual(raced);
    expect(createCalls).toBe(1);
    expect(findCalls).toBe(2);
  });
});
