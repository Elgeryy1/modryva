import { ForbiddenException, type HttpException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import type { MiniappAdminService } from "./admin.service.js";
import type { MiniappRequest } from "./init-data.guard.js";
import { MiniappTicketsController } from "./tickets.controller.js";

const expectHttpErrorAsync = async (p: Promise<unknown>, code: string) => {
  try {
    await p;
  } catch (e) {
    expect((e as HttpException).getResponse()).toMatchObject({ error: code });
    return;
  }
  throw new Error(`expected an HttpException with error=${code}`);
};

interface FakeTicket {
  id: string;
  number: number;
  tenantId: string;
  chatId: string;
  subject: string;
  status: string;
  priority: string;
  assigneeTelegramId: bigint | null;
  reporterTelegramId: bigint;
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
      number: input.number ?? this.seq,
      tenantId: input.tenantId ?? "t1",
      chatId: input.chatId,
      subject: input.subject ?? "Ayuda",
      status: input.status ?? "open",
      priority: input.priority ?? "normal",
      assigneeTelegramId: input.assigneeTelegramId ?? null,
      reporterTelegramId: input.reporterTelegramId ?? 100n,
      createdAt: input.createdAt ?? new Date(),
    });
    return id;
  }

  async getTicket(tenantId: string, ticketId: string) {
    const ticket = this.tickets.get(ticketId);
    return ticket && ticket.tenantId === tenantId ? ticket : null;
  }

  async listOpen(tenantId: string, chatId: string) {
    return [...this.tickets.values()].filter(
      (t) =>
        t.tenantId === tenantId && t.chatId === chatId && t.status !== "closed",
    );
  }

  async listRecent(tenantId: string, chatId: string) {
    return [...this.tickets.values()].filter(
      (t) => t.tenantId === tenantId && t.chatId === chatId,
    );
  }

  async setStatus(ticketId: string, status: string): Promise<void> {
    const ticket = this.tickets.get(ticketId);
    if (ticket) {
      this.tickets.set(ticketId, { ...ticket, status });
    }
  }

  async setPriority(ticketId: string, priority: string): Promise<void> {
    const ticket = this.tickets.get(ticketId);
    if (ticket) {
      this.tickets.set(ticketId, { ...ticket, priority });
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
  readonly audits: Array<Record<string, unknown>> = [];
  async recordAudit(input: Record<string, unknown>) {
    this.audits.push(input);
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

  const controller = new MiniappTicketsController(admin);
  const tickets = new FakeTickets();
  const foundation = new FakeFoundation();

  Object.assign(controller, { tickets, foundation });

  return { controller, tickets, foundation };
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

describe("MiniappTicketsController", () => {
  it("rejects listing when the user is not a group admin", async () => {
    const { controller } = makeController({
      assertGroupAdmin: async () => {
        throw new ForbiddenException({ error: "not-admin" });
      },
    });
    await expect(
      controller.list(reqWith(ctxFor("42")), "-100"),
    ).rejects.toThrowError(ForbiddenException);
  });

  it("lists open tickets and excludes closed ones", async () => {
    const { controller, tickets } = makeController();
    tickets.addTicket({ chatId: "c1", subject: "abierto" });
    tickets.addTicket({ chatId: "c1", subject: "cerrado", status: "closed" });

    const res = await controller.list(reqWith(ctxFor("42")), "-100");
    expect(res.tickets).toHaveLength(1);
    expect(res.tickets[0]?.subject).toBe("abierto");
  });

  it("lists the full history with scope=all", async () => {
    const { controller, tickets } = makeController();
    tickets.addTicket({ chatId: "c1", subject: "abierto" });
    tickets.addTicket({ chatId: "c1", subject: "cerrado", status: "closed" });

    const res = await controller.list(reqWith(ctxFor("42")), "-100", "all");
    expect(res.tickets).toHaveLength(2);
  });

  it("serialises bigint ids as strings and dates as ISO", async () => {
    const { controller, tickets } = makeController();
    tickets.addTicket({
      chatId: "c1",
      reporterTelegramId: 777n,
      assigneeTelegramId: 888n,
    });
    const res = await controller.list(reqWith(ctxFor("42")), "-100");
    const view = res.tickets[0];
    expect(view?.reporterTelegramId).toBe("777");
    expect(view?.assigneeTelegramId).toBe("888");
    expect(typeof view?.createdAt).toBe("string");
  });

  it("returns a ticket's detail", async () => {
    const { controller, tickets } = makeController();
    const id = tickets.addTicket({ chatId: "c1", subject: "detalle" });

    const res = await controller.detail(reqWith(ctxFor("42")), "-100", id);
    expect(res.ticket.subject).toBe("detalle");
  });

  it("404s a ticket that does not exist", async () => {
    const { controller } = makeController();
    await expectHttpErrorAsync(
      controller.detail(reqWith(ctxFor("42")), "-100", "nope"),
      "ticket-not-found",
    );
  });

  it("404s a ticket from another chat in the same tenant", async () => {
    const { controller, tickets } = makeController();
    const id = tickets.addTicket({ chatId: "c2", subject: "de otro grupo" });
    await expectHttpErrorAsync(
      controller.detail(reqWith(ctxFor("42")), "-100", id),
      "ticket-not-found",
    );
  });

  it("resolves a ticket and records an audit", async () => {
    const { controller, tickets, foundation } = makeController();
    const id = tickets.addTicket({ chatId: "c1" });

    const res = await controller.setStatus(reqWith(ctxFor("42")), "-100", id, {
      status: "resolved",
    });
    expect(res).toEqual({ ok: true });
    expect(tickets.tickets.get(id)?.status).toBe("resolved");
    expect(foundation.audits).toHaveLength(1);
  });

  it("reopens a closed ticket via status=open", async () => {
    const { controller, tickets } = makeController();
    const id = tickets.addTicket({ chatId: "c1", status: "closed" });

    await controller.setStatus(reqWith(ctxFor("42")), "-100", id, {
      status: "open",
    });
    expect(tickets.tickets.get(id)?.status).toBe("open");
  });

  it("rejects an invalid status", async () => {
    const { controller, tickets } = makeController();
    const id = tickets.addTicket({ chatId: "c1" });
    await expectHttpErrorAsync(
      controller.setStatus(reqWith(ctxFor("42")), "-100", id, {
        status: "bogus",
      }),
      "invalid-status",
    );
  });

  it("changes a ticket's priority", async () => {
    const { controller, tickets, foundation } = makeController();
    const id = tickets.addTicket({ chatId: "c1", priority: "normal" });

    await controller.setPriority(reqWith(ctxFor("42")), "-100", id, {
      priority: "urgent",
    });
    expect(tickets.tickets.get(id)?.priority).toBe("urgent");
    expect(foundation.audits).toHaveLength(1);
  });

  it("rejects an invalid priority", async () => {
    const { controller, tickets } = makeController();
    const id = tickets.addTicket({ chatId: "c1" });
    await expectHttpErrorAsync(
      controller.setPriority(reqWith(ctxFor("42")), "-100", id, {
        priority: "critical",
      }),
      "invalid-priority",
    );
  });

  it("assigns a ticket to a staff member", async () => {
    const { controller, tickets, foundation } = makeController();
    const id = tickets.addTicket({ chatId: "c1" });

    const res = await controller.assign(reqWith(ctxFor("42")), "-100", id, {
      assigneeTelegramId: "555",
    });
    expect(res).toEqual({ ok: true });
    expect(tickets.tickets.get(id)?.assigneeTelegramId).toBe(555n);
    expect(tickets.tickets.get(id)?.status).toBe("assigned");
    expect(foundation.audits).toHaveLength(1);
  });

  it("rejects assigning without an assignee", async () => {
    const { controller, tickets } = makeController();
    const id = tickets.addTicket({ chatId: "c1" });
    await expectHttpErrorAsync(
      controller.assign(reqWith(ctxFor("42")), "-100", id, {}),
      "missing-assignee",
    );
  });

  it("rejects assigning a non-numeric assignee", async () => {
    const { controller, tickets } = makeController();
    const id = tickets.addTicket({ chatId: "c1" });
    await expectHttpErrorAsync(
      controller.assign(reqWith(ctxFor("42")), "-100", id, {
        assigneeTelegramId: "not-a-number",
      }),
      "invalid-assignee",
    );
  });

  it("does not mutate a ticket from another chat", async () => {
    const { controller, tickets } = makeController();
    const id = tickets.addTicket({ chatId: "c2" });
    await expectHttpErrorAsync(
      controller.setStatus(reqWith(ctxFor("42")), "-100", id, {
        status: "closed",
      }),
      "ticket-not-found",
    );
    expect(tickets.tickets.get(id)?.status).toBe("open");
  });
});
