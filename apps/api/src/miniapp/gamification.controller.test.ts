import { ForbiddenException, type HttpException } from "@nestjs/common";
import {
  InMemoryFederationRepository,
  InMemoryGamificationRepository,
} from "@superbot/data";
import { describe, expect, it } from "vitest";
import type { MiniappAdminService } from "./admin.service.js";
import { MiniappGamificationController } from "./gamification.controller.js";
import type { MiniappRequest } from "./init-data.guard.js";

const expectHttpErrorAsync = async (p: Promise<unknown>, code: string) => {
  try {
    await p;
  } catch (e) {
    expect((e as HttpException).getResponse()).toMatchObject({ error: code });
    return;
  }
  throw new Error(`expected an HttpException with error=${code}`);
};

class FakeReputation {
  private readonly profiles = new Map<
    string,
    { telegramUserId: bigint; points: number; xp: number }
  >();

  async addPoints(
    _tenantId: string,
    chatId: string,
    telegramUserId: bigint,
    delta: number,
  ) {
    const key = `${chatId}:${telegramUserId}`;
    const current = this.profiles.get(key) ?? {
      telegramUserId,
      points: 0,
      xp: 0,
    };
    const next = { ...current, points: current.points + delta };
    this.profiles.set(key, next);
    return next;
  }

  async top(chatId: string, limit: number) {
    return [...this.profiles.entries()]
      .filter(([key]) => key.startsWith(`${chatId}:`))
      .map(([, value]) => value)
      .sort((a, b) => b.points - a.points)
      .slice(0, limit);
  }
}

const makeController = (
  adminOverrides: Partial<MiniappAdminService> = {},
  chatId = "c1",
) => {
  const admin = {
    assertGroupAdmin: async () => {},
    resolveChat: async (gid: string) => ({
      tenantId: "t1",
      chatId,
      telegramChatId: gid,
      title: "Grupo",
    }),
    ...adminOverrides,
  } as unknown as MiniappAdminService;

  const controller = new MiniappGamificationController(admin);
  const federation = new InMemoryFederationRepository();
  const gamification = new InMemoryGamificationRepository();
  const reputation = new FakeReputation();

  Object.assign(controller, { federation, gamification, reputation });

  return { controller, federation, gamification, reputation };
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

describe("MiniappGamificationController", () => {
  it("returns inNetwork:false with only the group ranking when not in a network", async () => {
    const { controller, reputation } = makeController();
    await reputation.addPoints("t1", "c1", 42n, 10);

    const status = await controller.status(reqWith(ctxFor("42")), "-100");
    expect(status).toMatchObject({
      inNetwork: false,
      welcomeButtons: {
        rules: true,
        otherGroups: true,
        support: true,
        verify: false,
      },
    });
    expect((status as { groupRanking: unknown[] }).groupRanking).toHaveLength(
      1,
    );
  });

  it("rejects reading gamification status when the user is not a group admin", async () => {
    const { controller } = makeController({
      assertGroupAdmin: async () => {
        throw new ForbiddenException({ error: "not-admin" });
      },
    });
    await expect(
      controller.status(reqWith(ctxFor("42")), "-100"),
    ).rejects.toThrowError(ForbiddenException);
  });

  it("ensures the 3 fixed missions and returns badges + network ranking when in a network", async () => {
    const { controller, federation } = makeController();
    await federation.createFederation({
      tenantId: "t1",
      fedId: "fed1",
      name: "Red",
      ownerTelegramId: 42n,
    });
    await federation.joinFederation("fed1", "c1", -100n);

    const status = await controller.status(reqWith(ctxFor("42")), "-100");
    expect(status).toMatchObject({ inNetwork: true, fedId: "fed1" });
    const typed = status as {
      missions: { kind: string; completed: boolean }[];
      badges: string[];
      networkRanking: unknown[];
    };
    expect(typed.missions).toHaveLength(3);
    expect(typed.missions.every((m) => !m.completed)).toBe(true);
    expect(typed.badges).toEqual([]);
  });

  it("does not duplicate missions across two status calls", async () => {
    const { controller, federation } = makeController();
    await federation.createFederation({
      tenantId: "t1",
      fedId: "fed1",
      name: "Red",
      ownerTelegramId: 42n,
    });
    await federation.joinFederation("fed1", "c1", -100n);

    await controller.status(reqWith(ctxFor("42")), "-100");
    const second = await controller.status(reqWith(ctxFor("42")), "-100");
    const typed = second as { missions: unknown[] };
    expect(typed.missions).toHaveLength(3);
  });

  it("reflects completed missions and awarded badges in the status view", async () => {
    const { controller, federation, gamification } = makeController();
    await federation.createFederation({
      tenantId: "t1",
      fedId: "fed1",
      name: "Red",
      ownerTelegramId: 42n,
    });
    await federation.joinFederation("fed1", "c1", -100n);

    await gamification.completeMission("t1", "fed1", 42n, "first_message");
    await gamification.awardBadge("t1", "fed1", 42n, "network_verified");

    const status = await controller.status(reqWith(ctxFor("42")), "-100");
    const typed = status as {
      missions: { kind: string; completed: boolean }[];
      badges: string[];
      networkRanking: { telegramUserId: string; badgeCount: number }[];
    };
    expect(
      typed.missions.find((m) => m.kind === "first_message")?.completed,
    ).toBe(true);
    expect(typed.badges).toEqual(["network_verified"]);
    expect(typed.networkRanking).toEqual([
      { telegramUserId: "42", badgeCount: 1 },
    ]);
  });

  it("validates the welcome-buttons body", async () => {
    const { controller } = makeController();
    await expectHttpErrorAsync(
      controller.updateWelcomeButtons(reqWith(ctxFor("42")), "-100", {
        rules: "yes",
      }),
      "invalid-body",
    );
  });

  it("persists valid welcome-buttons input", async () => {
    const { controller } = makeController();
    const result = await controller.updateWelcomeButtons(
      reqWith(ctxFor("42")),
      "-100",
      { rules: true, otherGroups: false, support: true, verify: false },
    );
    expect(result).toEqual({
      persisted: true,
      rules: true,
      otherGroups: false,
      support: true,
      verify: false,
    });

    const status = await controller.status(reqWith(ctxFor("42")), "-100");
    expect(status).toMatchObject({
      welcomeButtons: {
        rules: true,
        otherGroups: false,
        support: true,
        verify: false,
      },
    });
  });

  it("rejects welcome-buttons updates when the user is not a group admin", async () => {
    const { controller } = makeController({
      assertGroupAdmin: async () => {
        throw new ForbiddenException({ error: "not-admin" });
      },
    });
    await expect(
      controller.updateWelcomeButtons(reqWith(ctxFor("42")), "-100", {
        rules: true,
        otherGroups: true,
        support: true,
        verify: true,
      }),
    ).rejects.toThrowError(ForbiddenException);
  });
});
