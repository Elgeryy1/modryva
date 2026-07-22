import { ForbiddenException } from "@nestjs/common";
import type { ChatActivityEntry } from "@superbot/data";
import { describe, expect, it } from "vitest";
import type { MiniappAdminService } from "./admin.service.js";
import type { MiniappRequest } from "./init-data.guard.js";
import { MiniappInsightsController } from "./insights.controller.js";

// Far-past timestamp so "now - t" always exceeds both the 24h ghost grace and
// the 14d dormancy window, regardless of the real clock during the test run.
const OLD = new Date("2020-01-01T00:00:00Z");

class FakeActivity {
  private store = new Map<string, ChatActivityEntry[]>();

  private key(tenantId: string, chatId: string, kind: string): string {
    return `${tenantId}:${chatId}:${kind}`;
  }

  add(
    tenantId: string,
    chatId: string,
    kind: string,
    entry: Partial<ChatActivityEntry>,
  ): void {
    const key = this.key(tenantId, chatId, kind);
    const list = this.store.get(key) ?? [];
    list.push({
      telegramUserId: undefined,
      username: undefined,
      text: undefined,
      topic: undefined,
      messageId: undefined,
      hasLink: false,
      hasMention: false,
      isReply: false,
      repliedToUserId: undefined,
      tensionScore: undefined,
      createdAt: OLD,
      ...entry,
    });
    this.store.set(key, list);
  }

  async listRecent(
    tenantId: string,
    chatId: string,
    kind: string,
    limit = 100,
  ): Promise<ChatActivityEntry[]> {
    return (this.store.get(this.key(tenantId, chatId, kind)) ?? []).slice(
      0,
      limit,
    );
  }
}

const makeController = (adminOverrides: Partial<MiniappAdminService> = {}) => {
  const admin = {
    assertGroupAdmin: async () => {},
    resolveChat: async (gid: string) => ({
      tenantId: "t1",
      chatId: "c1",
      telegramChatId: gid,
      title: "Grupo",
    }),
    ...adminOverrides,
  } as unknown as MiniappAdminService;

  const controller = new MiniappInsightsController(admin);
  const activity = new FakeActivity();
  Object.assign(controller, { activity });
  return { controller, activity };
};

const reqWith = (miniapp: MiniappRequest["miniapp"]): MiniappRequest => ({
  headers: {},
  ...(miniapp ? { miniapp } : {}),
});

const ctxFor = (userId: string) => ({
  userId,
  user: { id: Number(userId) },
  startParam: null,
  botUsername: "modryvabot",
  botToken: "123456:test-token",
});

describe("MiniappInsightsController", () => {
  it("rejects when the user is not a group admin", async () => {
    const { controller } = makeController({
      assertGroupAdmin: async () => {
        throw new ForbiddenException({ error: "not-admin" });
      },
    });
    await expect(
      controller.ghosts(reqWith(ctxFor("42")), "-100"),
    ).rejects.toThrowError(ForbiddenException);
  });

  it("flags a silent newcomer as a ghost and resolves its username", async () => {
    const { controller, activity } = makeController();
    activity.add("t1", "c1", "new_member", {
      telegramUserId: 100n,
      username: "ghosty",
    });
    activity.add("t1", "c1", "new_member", {
      telegramUserId: 200n,
      username: "talker",
    });
    // 200 wrote a message → not a ghost.
    activity.add("t1", "c1", "message", {
      telegramUserId: 200n,
      username: "talker",
    });

    const res = await controller.ghosts(reqWith(ctxFor("42")), "-100");
    expect(res.total).toBe(1);
    expect(res.ghosts).toHaveLength(1);
    expect(res.ghosts[0]?.userId).toBe("100");
    expect(res.ghosts[0]?.username).toBe("ghosty");
    expect(typeof res.ghosts[0]?.joinedAt).toBe("string");
  });

  it("returns no ghosts when there are no joins", async () => {
    const { controller } = makeController();
    const res = await controller.ghosts(reqWith(ctxFor("42")), "-100");
    expect(res.total).toBe(0);
    expect(res.ghosts).toEqual([]);
  });

  it("detects a dormant member and excludes a recently active one", async () => {
    const { controller, activity } = makeController();
    activity.add("t1", "c1", "message", {
      telegramUserId: 300n,
      username: "sleepy",
    });
    // 400's last message is right now → not dormant.
    activity.add("t1", "c1", "message", {
      telegramUserId: 400n,
      username: "awake",
      createdAt: new Date(),
    });

    const res = await controller.inactive(reqWith(ctxFor("42")), "-100");
    const ids = res.inactive.map((m) => m.userId);
    expect(ids).toContain("300");
    expect(ids).not.toContain("400");
    const sleepy = res.inactive.find((m) => m.userId === "300");
    expect(sleepy?.username).toBe("sleepy");
    expect(sleepy?.idleDays).toBeGreaterThanOrEqual(14);
  });

  it("returns no inactive members without messages", async () => {
    const { controller } = makeController();
    const res = await controller.inactive(reqWith(ctxFor("42")), "-100");
    expect(res.total).toBe(0);
    expect(res.inactive).toEqual([]);
  });
});
