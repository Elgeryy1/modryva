import { BadRequestException, ForbiddenException } from "@nestjs/common";
import type { MemberActivityProfileRow } from "@superbot/data";
import { describe, expect, it } from "vitest";
import type { MiniappAdminService } from "./admin.service.js";
import type { MiniappRequest } from "./init-data.guard.js";
import { MiniappInsightsController } from "./insights.controller.js";

const OLD = new Date("2020-01-01T00:00:00Z");
const NOW = new Date();

const profile = (
  telegramUserId: bigint,
  overrides: Partial<MemberActivityProfileRow> = {},
): MemberActivityProfileRow => ({
  telegramUserId,
  username: undefined,
  membershipObservedAt: OLD,
  historyScannedAt: undefined,
  historicalMessages: 0,
  historicalLastMessageAt: undefined,
  liveMessages: 0,
  liveLastMessageAt: undefined,
  ...overrides,
});

class FakeAnalytics {
  profiles: readonly MemberActivityProfileRow[] = [];

  async getMemberActivityProfiles(): Promise<
    readonly MemberActivityProfileRow[]
  > {
    return this.profiles;
  }
}

class FakeFoundation {
  readonly audits: Array<Record<string, unknown>> = [];

  async recordAudit(input: Record<string, unknown>) {
    this.audits.push(input);
  }
}

const makeController = (adminOverrides: Partial<MiniappAdminService> = {}) => {
  const admin = {
    assertGroupAdmin: async () => {},
    assertGroupAdminForMutation: async () => {},
    assertMemberCanBeKicked: async () => {},
    kickMember: async () => {},
    resolveChat: async (gid: string) => ({
      tenantId: "t1",
      chatId: "c1",
      telegramChatId: gid,
      title: "Grupo",
    }),
    ...adminOverrides,
  } as unknown as MiniappAdminService;

  const controller = new MiniappInsightsController(admin);
  const analytics = new FakeAnalytics();
  const foundation = new FakeFoundation();
  Object.assign(controller, { analytics, foundation });
  return { controller, analytics, foundation };
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

  it("shows a zero-message member from a completed history scan immediately", async () => {
    const { controller, analytics } = makeController();
    analytics.profiles = [
      profile(100n, {
        username: "ghosty",
        membershipObservedAt: NOW,
        historyScannedAt: NOW,
      }),
      profile(200n, {
        username: "talker",
        historyScannedAt: NOW,
        historicalMessages: 1,
        historicalLastMessageAt: OLD,
      }),
    ];

    const res = await controller.ghosts(reqWith(ctxFor("42")), "-100");
    expect(res.total).toBe(1);
    expect(res.ghosts).toHaveLength(1);
    expect(res.ghosts[0]?.userId).toBe("100");
    expect(res.ghosts[0]?.username).toBe("ghosty");
    expect(typeof res.ghosts[0]?.observedAt).toBe("string");
  });

  it("waits 24h before flagging a live-only silent newcomer", async () => {
    const { controller, analytics } = makeController();
    analytics.profiles = [
      profile(100n, { membershipObservedAt: NOW }),
      profile(200n, { membershipObservedAt: OLD }),
    ];

    const res = await controller.ghosts(reqWith(ctxFor("42")), "-100");
    expect(res.ghosts.map((member) => member.userId)).toEqual(["200"]);
  });

  it("detects historical inactivity and excludes a recently active member", async () => {
    const { controller, analytics } = makeController();
    analytics.profiles = [
      profile(300n, {
        username: "sleepy",
        historicalMessages: 5,
        historicalLastMessageAt: OLD,
        historyScannedAt: OLD,
      }),
      profile(400n, {
        username: "awake",
        liveMessages: 1,
        liveLastMessageAt: NOW,
      }),
    ];

    const res = await controller.inactive(reqWith(ctxFor("42")), "-100");
    expect(res.inactive.map((member) => member.userId)).toEqual(["300"]);
    expect(res.inactive[0]?.username).toBe("sleepy");
    expect(res.inactive[0]?.idleDays).toBeGreaterThanOrEqual(14);
  });

  it("returns no inactive members without activity", async () => {
    const { controller } = makeController();
    const res = await controller.inactive(reqWith(ctxFor("42")), "-100");
    expect(res.total).toBe(0);
    expect(res.inactive).toEqual([]);
  });

  it("kicks one currently eligible member and records the individual action", async () => {
    const calls: unknown[] = [];
    const { controller, analytics, foundation } = makeController({
      assertGroupAdminForMutation: async () => {
        calls.push("admin");
      },
      assertMemberCanBeKicked: async (input: unknown) => {
        calls.push(input);
      },
      kickMember: async (input: unknown) => {
        calls.push(input);
      },
    });
    analytics.profiles = [
      profile(100n, { historyScannedAt: NOW, username: "ghosty" }),
    ];

    await expect(
      controller.kick(reqWith(ctxFor("42")), "-100", "100"),
    ).resolves.toEqual({ ok: true, removedUserId: "100" });
    expect(calls).toHaveLength(3);
    expect(foundation.audits).toHaveLength(1);
    expect(foundation.audits[0]).toMatchObject({
      action: "miniapp.insights.member.kick",
      resourceId: "-100:100",
    });
  });

  it("does not kick a member who is no longer eligible", async () => {
    const kickMember = async () => {
      throw new Error("must-not-run");
    };
    const { controller, analytics } = makeController({ kickMember });
    analytics.profiles = [profile(100n, { membershipObservedAt: NOW })];

    await expect(
      controller.kick(reqWith(ctxFor("42")), "-100", "100"),
    ).rejects.toThrowError(BadRequestException);
  });
});
