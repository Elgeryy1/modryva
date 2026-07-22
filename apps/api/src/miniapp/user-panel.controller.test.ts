import { ForbiddenException, type HttpException } from "@nestjs/common";
import {
  InMemoryFederationRepository,
  InMemoryInternalRoleRepository,
  InMemoryOwnerNetworkRiskRepository,
} from "@superbot/data";
import { describe, expect, it } from "vitest";
import type { MiniappAdminService } from "./admin.service.js";
import type { MiniappRequest } from "./init-data.guard.js";
import { MiniappUserPanelController } from "./user-panel.controller.js";

const expectHttpErrorAsync = async (p: Promise<unknown>, code: string) => {
  try {
    await p;
  } catch (e) {
    expect((e as HttpException).getResponse()).toMatchObject({ error: code });
    return;
  }
  throw new Error(`expected an HttpException with error=${code}`);
};

class FakeModerationExtra {
  listActiveWarningsCalls: unknown[][] = [];

  async listActiveWarnings(...args: unknown[]) {
    this.listActiveWarningsCalls.push(args);
    return [{ reason: "spam", createdAt: new Date("2026-01-01T00:00:00Z") }];
  }
  async listReports(filter: { tenantId: string }) {
    void filter;
    return [
      {
        id: "r1",
        tenantId: "t1",
        chatId: "c1",
        reporterUserId: undefined,
        subjectTelegramId: 7n,
        reason: "acoso",
        status: "open",
        createdAt: new Date("2026-01-02T00:00:00Z"),
      },
      {
        id: "r2",
        tenantId: "t1",
        chatId: "c1",
        reporterUserId: undefined,
        subjectTelegramId: 999n,
        reason: "otro",
        status: "open",
        createdAt: new Date("2026-01-02T00:00:00Z"),
      },
      {
        // Same subject (7n) but in a DIFFERENT chat of the same tenant, one the
        // caller (admin of c1, network {c1}) has no relationship to. Must never
        // surface in their view of the subject's profile.
        id: "r3",
        tenantId: "t1",
        chatId: "c-other",
        reporterUserId: undefined,
        subjectTelegramId: 7n,
        reason: "en otro grupo",
        status: "open",
        createdAt: new Date("2026-01-02T00:00:00Z"),
      },
    ];
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

  const controller = new MiniappUserPanelController(admin);
  const federation = new InMemoryFederationRepository();
  const moderationExtra = new FakeModerationExtra();
  const internalRole = new InMemoryInternalRoleRepository();
  const risk = new InMemoryOwnerNetworkRiskRepository();

  Object.assign(controller, {
    federation,
    moderationExtra,
    internalRole,
    risk,
  });

  return { controller, federation, internalRole, risk, moderationExtra };
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

describe("MiniappUserPanelController", () => {
  it("aggregates a profile with partial data when the group isn't in a network", async () => {
    const { controller, moderationExtra } = makeController();
    const profile = await controller.profile(
      reqWith(ctxFor("42")),
      "-100",
      "5",
    );
    expect(profile).toMatchObject({
      telegramUserId: "5",
      inNetwork: false,
      networkChats: undefined,
      internalRole: null,
      canManageRole: false,
      risk: null,
    });
    expect(profile.warnings).toHaveLength(1);
    expect(profile.reports).toHaveLength(0);
    // Tenant/chat scoping fix regression guard: must be scoped, not just userId.
    expect(moderationExtra.listActiveWarningsCalls[0]).toEqual([
      "t1",
      "c1",
      5n,
      20,
    ]);
  });

  it("filters reports down to the requested subject", async () => {
    const { controller, federation } = makeController();
    await federation.createFederation({
      tenantId: "t1",
      fedId: "fed_1",
      name: "Red",
      ownerTelegramId: 42n,
    });
    await federation.joinFederation("fed_1", "c1", -100n);

    const profile = await controller.profile(
      reqWith(ctxFor("42")),
      "-100",
      "7",
    );
    expect(profile.reports).toHaveLength(1);
    expect(profile.reports[0]).toMatchObject({ id: "r1" });
  });

  it("does not leak reports about the subject from chats outside the caller's scope", async () => {
    const { controller, federation } = makeController();
    await federation.createFederation({
      tenantId: "t1",
      fedId: "fed_1",
      name: "Red",
      ownerTelegramId: 42n,
    });
    await federation.joinFederation("fed_1", "c1", -100n);

    const profile = await controller.profile(
      reqWith(ctxFor("42")),
      "-100",
      "7",
    );
    const ids = profile.reports.map((report) => report.id);
    // r1 (subject 7, chat c1 — in scope) shows; r3 (subject 7, chat c-other —
    // another group of the same tenant) must NOT. Before the fix both appeared.
    expect(ids).toEqual(["r1"]);
    expect(ids).not.toContain("r3");
  });

  it("rejects reading the panel when the user is not a group admin", async () => {
    const { controller } = makeController({
      assertGroupAdmin: async () => {
        throw new ForbiddenException({ error: "not-admin" });
      },
    });
    await expect(
      controller.profile(reqWith(ctxFor("42")), "-100", "7"),
    ).rejects.toThrowError(ForbiddenException);
  });

  it("gets/sets/lists/removes an internal role via the repository", async () => {
    const { internalRole } = makeController();
    expect(await internalRole.getRole("fed_1", 7n)).toBeNull();
    await internalRole.setRole("t1", "fed_1", 7n, "moderator");
    expect(await internalRole.getRole("fed_1", 7n)).toBe("moderator");
    expect(await internalRole.listRoles("fed_1")).toEqual([
      { telegramUserId: 7n, role: "moderator" },
    ]);
    await internalRole.removeRole("fed_1", 7n);
    expect(await internalRole.getRole("fed_1", 7n)).toBeNull();
  });

  it("allows the network owner to change another user's internal role", async () => {
    const { controller, federation } = makeController();
    await federation.createFederation({
      tenantId: "t1",
      fedId: "fed_1",
      name: "Red",
      ownerTelegramId: 42n,
    });
    await federation.joinFederation("fed_1", "c1", -100n);

    const result = await controller.setRole(
      reqWith(ctxFor("42")),
      "-100",
      "7",
      { role: "moderator" },
    );
    expect(result).toEqual({ telegramUserId: "7", role: "moderator" });
  });

  it("blocks a non-owner from changing another user's internal role", async () => {
    const { controller, federation } = makeController();
    await federation.createFederation({
      tenantId: "t1",
      fedId: "fed_1",
      name: "Red",
      ownerTelegramId: 42n,
    });
    await federation.joinFederation("fed_1", "c1", -100n);

    await expectHttpErrorAsync(
      controller.setRole(reqWith(ctxFor("99")), "-100", "7", {
        role: "moderator",
      }),
      "not-network-owner",
    );
  });

  it("rejects setting an unknown role", async () => {
    const { controller, federation } = makeController();
    await federation.createFederation({
      tenantId: "t1",
      fedId: "fed_1",
      name: "Red",
      ownerTelegramId: 42n,
    });
    await federation.joinFederation("fed_1", "c1", -100n);

    await expectHttpErrorAsync(
      controller.setRole(reqWith(ctxFor("42")), "-100", "7", {
        role: "dictator",
      }),
      "invalid-body",
    );
  });

  it("persists staff notes and returns them in the profile", async () => {
    const { controller, federation } = makeController();
    await federation.createFederation({
      tenantId: "t1",
      fedId: "fed_1",
      name: "Red",
      ownerTelegramId: 42n,
    });
    await federation.joinFederation("fed_1", "c1", -100n);

    const result = await controller.addNote(
      reqWith(ctxFor("42")),
      "-100",
      "7",
      { note: "Vigilar de cerca" },
    );
    expect(result).toEqual({
      telegramUserId: "7",
      id: "note_1",
      note: "Vigilar de cerca",
      createdAt: expect.any(String),
      persisted: true,
    });

    const profile = await controller.profile(
      reqWith(ctxFor("42")),
      "-100",
      "7",
    );
    expect(profile.notes).toEqual([
      {
        id: "note_1",
        authorTelegramUserId: "42",
        note: "Vigilar de cerca",
        createdAt: expect.any(String),
      },
    ]);
  });

  it("rejects staff notes outside an owner network", async () => {
    const { controller } = makeController();
    await expectHttpErrorAsync(
      controller.addNote(reqWith(ctxFor("42")), "-100", "7", {
        note: "Vigilar de cerca",
      }),
      "not-in-network",
    );
  });

  it("rejects an invalid telegram user id", async () => {
    const { controller } = makeController();
    await expectHttpErrorAsync(
      controller.profile(reqWith(ctxFor("42")), "-100", "not-a-number"),
      "invalid-telegram-user-id",
    );
  });
});
