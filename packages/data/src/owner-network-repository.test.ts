import type { PrismaClient } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { PrismaOwnerNetworkRepository } from "./owner-network-repository.js";

interface FakeChatRow {
  chatId: string;
  fedId: string;
  telegramChatId: bigint;
}

interface FakeRouteRow {
  id: string;
  tenantId: string;
  fedId: string;
  sourceChatId: string | null;
  sourceKey: string;
  eventKind: string;
  targetChatId: string;
  enabled: boolean;
}

const buildFakeClient = (
  chats: readonly FakeChatRow[],
  routes: readonly FakeRouteRow[],
): PrismaClient =>
  ({
    federationChat: {
      findUnique: async ({ where }: { where: { chatId: string } }) =>
        chats.find((chat) => chat.chatId === where.chatId) ?? null,
    },
    ownerNetworkRoute: {
      findUnique: async ({
        where,
      }: {
        where: {
          fedId_sourceKey_eventKind: {
            fedId: string;
            sourceKey: string;
            eventKind: string;
          };
        };
      }) => {
        const key = where.fedId_sourceKey_eventKind;
        return (
          routes.find(
            (route) =>
              route.fedId === key.fedId &&
              route.sourceKey === key.sourceKey &&
              route.eventKind === key.eventKind,
          ) ?? null
        );
      },
    },
    // biome-ignore lint/suspicious/noExplicitAny: minimal Prisma double for resolveRoute
  }) as any;

describe("PrismaOwnerNetworkRepository.resolveRoute", () => {
  const chats: FakeChatRow[] = [
    { chatId: "chat_source", fedId: "fed_1", telegramChatId: -100n },
    { chatId: "chat_staff", fedId: "fed_1", telegramChatId: -200n },
    { chatId: "chat_other_staff", fedId: "fed_1", telegramChatId: -201n },
    { chatId: "chat_foreign", fedId: "fed_2", telegramChatId: -999n },
  ];

  it("resolves the global (*) route when no override exists", async () => {
    const repo = new PrismaOwnerNetworkRepository(
      buildFakeClient(chats, [
        {
          id: "r1",
          tenantId: "t1",
          fedId: "fed_1",
          sourceChatId: null,
          sourceKey: "*",
          eventKind: "reports",
          targetChatId: "chat_staff",
          enabled: true,
        },
      ]),
    );

    const route = await repo.resolveRoute("chat_source", "reports");
    expect(route).toMatchObject({
      fedId: "fed_1",
      targetChatId: "chat_staff",
      targetTelegramChatId: -200n,
    });
  });

  it("prefers a group-specific override over the global route", async () => {
    const repo = new PrismaOwnerNetworkRepository(
      buildFakeClient(chats, [
        {
          id: "r1",
          tenantId: "t1",
          fedId: "fed_1",
          sourceChatId: null,
          sourceKey: "*",
          eventKind: "reports",
          targetChatId: "chat_staff",
          enabled: true,
        },
        {
          id: "r2",
          tenantId: "t1",
          fedId: "fed_1",
          sourceChatId: "chat_source",
          sourceKey: "chat_source",
          eventKind: "reports",
          targetChatId: "chat_other_staff",
          enabled: true,
        },
      ]),
    );

    const route = await repo.resolveRoute("chat_source", "reports");
    expect(route?.targetChatId).toBe("chat_other_staff");
  });

  it("returns null for a disabled route", async () => {
    const repo = new PrismaOwnerNetworkRepository(
      buildFakeClient(chats, [
        {
          id: "r1",
          tenantId: "t1",
          fedId: "fed_1",
          sourceChatId: null,
          sourceKey: "*",
          eventKind: "reports",
          targetChatId: "chat_staff",
          enabled: false,
        },
      ]),
    );

    const route = await repo.resolveRoute("chat_source", "reports");
    expect(route).toBeNull();
  });

  it("returns null when the source chat is not part of any network", async () => {
    const repo = new PrismaOwnerNetworkRepository(
      buildFakeClient(chats, [
        {
          id: "r1",
          tenantId: "t1",
          fedId: "fed_1",
          sourceChatId: null,
          sourceKey: "*",
          eventKind: "reports",
          targetChatId: "chat_staff",
          enabled: true,
        },
      ]),
    );

    const route = await repo.resolveRoute("chat_not_in_network", "reports");
    expect(route).toBeNull();
  });

  it("returns null when the configured target belongs to a different federation", async () => {
    const repo = new PrismaOwnerNetworkRepository(
      buildFakeClient(chats, [
        {
          id: "r1",
          tenantId: "t1",
          fedId: "fed_1",
          sourceChatId: null,
          sourceKey: "*",
          eventKind: "reports",
          targetChatId: "chat_foreign",
          enabled: true,
        },
      ]),
    );

    const route = await repo.resolveRoute("chat_source", "reports");
    expect(route).toBeNull();
  });

  it("returns null when no route is configured for the event kind", async () => {
    const repo = new PrismaOwnerNetworkRepository(buildFakeClient(chats, []));
    const route = await repo.resolveRoute("chat_source", "logs");
    expect(route).toBeNull();
  });
});
