import { ForbiddenException, type HttpException } from "@nestjs/common";
import {
  InMemoryD1Repository,
  InMemoryFederationRepository,
} from "@superbot/data";
import { describe, expect, it } from "vitest";
import type { MiniappAdminService } from "./admin.service.js";
import type { MiniappRequest } from "./init-data.guard.js";
import { MiniappModerationInboxController } from "./moderation-inbox.controller.js";

const expectHttpErrorAsync = async (p: Promise<unknown>, code: string) => {
  try {
    await p;
  } catch (e) {
    expect((e as HttpException).getResponse()).toMatchObject({ error: code });
    return;
  }
  throw new Error(`expected an HttpException with error=${code}`);
};

interface FakeReport {
  id: string;
  tenantId: string;
  chatId: string | undefined;
  reporterUserId: string | undefined;
  subjectTelegramId: bigint;
  reason: string | undefined;
  status: string;
  createdAt: Date;
}

class FakeModerationExtra {
  private seq = 0;
  readonly reports = new Map<string, FakeReport>();

  addReport(input: Partial<FakeReport> & { chatId: string }): string {
    this.seq += 1;
    const id = `report_${this.seq}`;
    this.reports.set(id, {
      id,
      tenantId: "t1",
      chatId: input.chatId,
      reporterUserId: undefined,
      subjectTelegramId: input.subjectTelegramId ?? 1n,
      reason: input.reason ?? "spam",
      status: input.status ?? "open",
      createdAt: input.createdAt ?? new Date(),
    });
    return id;
  }

  async listReports(filter: {
    tenantId: string;
    chatId?: string;
    status?: string;
  }) {
    return [...this.reports.values()].filter(
      (r) =>
        r.tenantId === filter.tenantId &&
        (!filter.chatId || r.chatId === filter.chatId) &&
        (!filter.status || r.status === filter.status),
    );
  }

  async resolveReport(reportId: string, status: string): Promise<boolean> {
    const report = this.reports.get(reportId);
    if (!report) {
      return false;
    }
    this.reports.set(reportId, { ...report, status });
    return true;
  }
}

interface FakeTicket {
  id: string;
  tenantId: string;
  chatId: string;
  subject: string;
  priority: string;
  status: string;
  assigneeTelegramId: bigint | null;
  createdAt: Date;
}

class FakeTickets {
  private seq = 0;
  readonly tickets = new Map<string, FakeTicket>();

  addTicket(input: Partial<FakeTicket> & { chatId: string }): string {
    this.seq += 1;
    const id = `ticket_${this.seq}`;
    this.tickets.set(id, {
      id,
      tenantId: input.tenantId ?? "t1",
      chatId: input.chatId,
      subject: input.subject ?? "Ayuda",
      priority: input.priority ?? "normal",
      status: input.status ?? "open",
      assigneeTelegramId: input.assigneeTelegramId ?? null,
      createdAt: input.createdAt ?? new Date(),
    });
    return id;
  }

  async listOpen(tenantId: string, chatId: string) {
    return [...this.tickets.values()].filter(
      (t) =>
        t.tenantId === tenantId && t.chatId === chatId && t.status !== "closed",
    );
  }

  async setStatus(ticketId: string, status: string): Promise<void> {
    const ticket = this.tickets.get(ticketId);
    if (ticket) {
      this.tickets.set(ticketId, { ...ticket, status });
    }
  }

  async assign(ticketId: string, assigneeTelegramId: bigint): Promise<void> {
    const ticket = this.tickets.get(ticketId);
    if (ticket) {
      this.tickets.set(ticketId, {
        ...ticket,
        assigneeTelegramId,
        status: "assigned",
      });
    }
  }
}

class FakeFoundation {
  readonly audits: unknown[] = [];
  async recordAudit(input: unknown) {
    this.audits.push(input);
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

  const controller = new MiniappModerationInboxController(admin);
  const federation = new InMemoryFederationRepository();
  const d1 = new InMemoryD1Repository();
  const moderationExtra = new FakeModerationExtra();
  const tickets = new FakeTickets();
  const foundation = new FakeFoundation();

  Object.assign(controller, {
    federation,
    d1,
    moderationExtra,
    tickets,
    foundation,
  });

  return { controller, federation, d1, moderationExtra, tickets, foundation };
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

describe("MiniappModerationInboxController", () => {
  it("rejects listing the inbox when the user is not a group admin", async () => {
    const { controller } = makeController({
      assertGroupAdmin: async () => {
        throw new ForbiddenException({ error: "not-admin" });
      },
    });
    await expect(
      controller.list(reqWith(ctxFor("42")), "-100"),
    ).rejects.toThrowError(ForbiddenException);
  });

  it("rejects resolving when the user is not a group admin", async () => {
    const { controller, moderationExtra } = makeController({
      assertGroupAdmin: async () => {
        throw new ForbiddenException({ error: "not-admin" });
      },
    });
    const reportId = moderationExtra.addReport({ chatId: "c1" });
    await expect(
      controller.resolve(reqWith(ctxFor("42")), "-100", "report", reportId, {
        action: "approve",
      }),
    ).rejects.toThrowError(ForbiddenException);
  });

  it("aggregates reports, quarantine, appeals and tickets from the group's own chat", async () => {
    const { controller, moderationExtra, d1, tickets } = makeController();
    moderationExtra.addReport({ chatId: "c1", reason: "insulto" });
    await d1.createQuarantineItem({
      tenantId: "t1",
      chatId: "c1",
      telegramChatId: -100n,
      messageId: 1,
      actorTelegramId: 55n,
      username: "spammer",
      text: "buy now",
      reason: "link-spam",
    });
    await d1.createAppeal({
      tenantId: "t1",
      chatId: "c1",
      caseRef: "case1",
      appellantTelegramId: 77n,
      username: "banned_user",
      message: "no fue justo",
    });
    tickets.addTicket({ chatId: "c1", subject: "No puedo entrar" });

    const result = await controller.list(reqWith(ctxFor("42")), "-100");
    const kinds = result.items.map((item) => item.kind).sort();
    expect(kinds).toEqual(["appeal", "quarantine", "report", "ticket"]);
    expect(result.chatIds).toEqual(["c1"]);
  });

  it("aggregates items across every chat in the group's network", async () => {
    const { controller, federation, moderationExtra, d1 } = makeController();
    await federation.createFederation({
      tenantId: "t1",
      fedId: "fed1",
      name: "Red",
      ownerTelegramId: 42n,
    });
    await federation.joinFederation("fed1", "c1", -100n);
    await federation.joinFederation("fed1", "c2", -200n);

    moderationExtra.addReport({ chatId: "c1", reason: "en c1" });
    moderationExtra.addReport({ chatId: "c2", reason: "en c2" });
    await d1.createQuarantineItem({
      tenantId: "t1",
      chatId: "c2",
      telegramChatId: -200n,
      messageId: 2,
      actorTelegramId: 99n,
      username: "otro",
      text: "spam",
      reason: "flood",
    });

    const result = await controller.list(reqWith(ctxFor("42")), "-100");
    expect(result.chatIds.sort()).toEqual(["c1", "c2"]);
    expect(result.items.filter((i) => i.kind === "report")).toHaveLength(2);
    expect(result.items.filter((i) => i.kind === "quarantine")).toHaveLength(1);
  });

  it("filters by chatId", async () => {
    const { controller, federation, moderationExtra } = makeController();
    await federation.createFederation({
      tenantId: "t1",
      fedId: "fed1",
      name: "Red",
      ownerTelegramId: 42n,
    });
    await federation.joinFederation("fed1", "c1", -100n);
    await federation.joinFederation("fed1", "c2", -200n);
    moderationExtra.addReport({ chatId: "c1" });
    moderationExtra.addReport({ chatId: "c2" });

    const result = await controller.list(reqWith(ctxFor("42")), "-100", "c2");
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.chatId).toBe("c2");
  });

  it("filters by kind", async () => {
    const { controller, moderationExtra, tickets } = makeController();
    moderationExtra.addReport({ chatId: "c1" });
    tickets.addTicket({ chatId: "c1" });

    const result = await controller.list(
      reqWith(ctxFor("42")),
      "-100",
      undefined,
      "ticket",
    );
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.kind).toBe("ticket");
  });

  it("filters by status", async () => {
    const { controller, moderationExtra } = makeController();
    moderationExtra.addReport({ chatId: "c1", status: "open" });
    moderationExtra.addReport({ chatId: "c1", status: "resolved" });

    const result = await controller.list(
      reqWith(ctxFor("42")),
      "-100",
      undefined,
      undefined,
      "resolved",
    );
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.status).toBe("resolved");
  });

  it("rejects an invalid kind filter", async () => {
    const { controller } = makeController();
    await expectHttpErrorAsync(
      controller.list(reqWith(ctxFor("42")), "-100", undefined, "not-a-kind"),
      "invalid-kind",
    );
  });

  it("resolves a report and records an audit entry", async () => {
    const { controller, moderationExtra, foundation } = makeController();
    const reportId = moderationExtra.addReport({ chatId: "c1" });

    const result = await controller.resolve(
      reqWith(ctxFor("42")),
      "-100",
      "report",
      reportId,
      { action: "approve" },
    );
    expect(result).toEqual({ ok: true });
    expect(moderationExtra.reports.get(reportId)?.status).toBe("resolved");
    expect(foundation.audits).toHaveLength(1);
  });

  it("resolves a quarantine item", async () => {
    const { controller, d1 } = makeController();
    const item = await d1.createQuarantineItem({
      tenantId: "t1",
      chatId: "c1",
      telegramChatId: -100n,
      messageId: 3,
      actorTelegramId: 12n,
      username: "u",
      text: "hola",
      reason: "flood",
    });

    const result = await controller.resolve(
      reqWith(ctxFor("42")),
      "-100",
      "quarantine",
      item.id,
      { action: "reject" },
    );
    expect(result).toEqual({ ok: true });
    const pending = await d1.listPendingQuarantine("c1");
    expect(pending).toHaveLength(0);
  });

  it("resolves an appeal", async () => {
    const { controller, d1 } = makeController();
    const appeal = await d1.createAppeal({
      tenantId: "t1",
      chatId: "c1",
      caseRef: "case2",
      appellantTelegramId: 88n,
      username: "u2",
      message: "revisen mi caso",
    });

    const result = await controller.resolve(
      reqWith(ctxFor("42")),
      "-100",
      "appeal",
      appeal.id,
      { action: "approve" },
    );
    expect(result).toEqual({ ok: true });
    const open = await d1.listOpenAppeals("t1", "c1");
    expect(open).toHaveLength(0);
  });

  it("closes a ticket", async () => {
    const { controller, tickets } = makeController();
    const ticketId = tickets.addTicket({ chatId: "c1" });

    const result = await controller.resolve(
      reqWith(ctxFor("42")),
      "-100",
      "ticket",
      ticketId,
      { action: "close" },
    );
    expect(result).toEqual({ ok: true });
    expect(tickets.tickets.get(ticketId)?.status).toBe("closed");
  });

  it("assigns a ticket to a moderator", async () => {
    const { controller, tickets } = makeController();
    const ticketId = tickets.addTicket({ chatId: "c1" });

    const result = await controller.resolve(
      reqWith(ctxFor("42")),
      "-100",
      "ticket",
      ticketId,
      { action: "assign", assigneeTelegramId: "555" },
    );
    expect(result).toEqual({ ok: true });
    expect(tickets.tickets.get(ticketId)?.assigneeTelegramId).toBe(555n);
    expect(tickets.tickets.get(ticketId)?.status).toBe("assigned");
  });

  it("rejects assigning a ticket without an assigneeTelegramId", async () => {
    const { controller, tickets } = makeController();
    const ticketId = tickets.addTicket({ chatId: "c1" });

    await expectHttpErrorAsync(
      controller.resolve(reqWith(ctxFor("42")), "-100", "ticket", ticketId, {
        action: "assign",
      }),
      "missing-assignee",
    );
  });

  it("rejects an unknown kind on resolve", async () => {
    const { controller } = makeController();
    await expectHttpErrorAsync(
      controller.resolve(reqWith(ctxFor("42")), "-100", "bogus", "id1", {
        action: "approve",
      }),
      "invalid-kind",
    );
  });

  it("fails resolving a report that does not exist", async () => {
    const { controller } = makeController();
    await expectHttpErrorAsync(
      controller.resolve(reqWith(ctxFor("42")), "-100", "report", "nope", {
        action: "approve",
      }),
      "resolve-failed",
    );
  });

  // --- Cross-tenant / cross-chat IDOR guards ---
  // The caller is admin of c1 with no federation (network = [c1] only), so an
  // item living in c2 is outside their scope. Every kind must be REJECTED and,
  // crucially, left UNMUTATED — before the pre-dispatch scope check, report/ticket
  // mutated by id regardless and quarantine/appeal mutated first then errored.

  it("refuses to resolve a report in a chat outside the caller's scope, and does not mutate it", async () => {
    const { controller, moderationExtra } = makeController();
    const foreignReport = moderationExtra.addReport({ chatId: "c2" });

    await expectHttpErrorAsync(
      controller.resolve(
        reqWith(ctxFor("42")),
        "-100",
        "report",
        foreignReport,
        { action: "approve" },
      ),
      "resolve-failed",
    );
    // Untouched — no cross-chat write slipped through.
    expect(moderationExtra.reports.get(foreignReport)?.status).toBe("open");
  });

  it("refuses to resolve an out-of-scope quarantine item WITHOUT mutating it first (mutate-then-authorize)", async () => {
    const { controller, d1 } = makeController();
    const foreign = await d1.createQuarantineItem({
      tenantId: "t2",
      chatId: "c2",
      telegramChatId: -200n,
      messageId: 9,
      actorTelegramId: 66n,
      username: "spam",
      text: "x",
      reason: "flood",
    });

    await expectHttpErrorAsync(
      controller.resolve(
        reqWith(ctxFor("42")),
        "-100",
        "quarantine",
        foreign.id,
        {
          action: "reject",
        },
      ),
      "resolve-failed",
    );
    // Still pending: the cross-chat mutation never ran.
    const pending = await d1.listPendingQuarantine("c2");
    expect(pending).toHaveLength(1);
  });

  it("refuses to close a ticket in a chat outside the caller's scope, and does not mutate it", async () => {
    const { controller, tickets } = makeController();
    const foreignTicket = tickets.addTicket({ tenantId: "t2", chatId: "c2" });

    await expectHttpErrorAsync(
      controller.resolve(
        reqWith(ctxFor("42")),
        "-100",
        "ticket",
        foreignTicket,
        { action: "close" },
      ),
      "resolve-failed",
    );
    expect(tickets.tickets.get(foreignTicket)?.status).toBe("open");
  });
});
