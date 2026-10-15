import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "./client.js";

export interface TicketRecord {
  readonly id: string;
  readonly number: number;
  readonly chatId: string;
  readonly subject: string;
  readonly status: string;
  readonly priority: string;
  readonly assigneeTelegramId: bigint | null;
  readonly reporterTelegramId: bigint;
  readonly createdAt: Date;
}

export interface CreateTicketInput {
  readonly tenantId: string;
  readonly chatId: string;
  readonly reporterTelegramId: bigint;
  readonly subject: string;
  readonly priority: string;
}

export interface TicketRepository {
  createTicket(input: CreateTicketInput): Promise<TicketRecord>;
  getTicket(tenantId: string, ticketId: string): Promise<TicketRecord | null>;
  listOpen(
    tenantId: string,
    chatId: string,
    limit?: number,
  ): Promise<TicketRecord[]>;
  /** All tickets for the chat regardless of status, for the case-board view. */
  listRecent(
    tenantId: string,
    chatId: string,
    limit?: number,
  ): Promise<TicketRecord[]>;
  listByReporter(
    tenantId: string,
    reporterTelegramId: bigint,
    limit?: number,
  ): Promise<TicketRecord[]>;
  setStatus(ticketId: string, status: string): Promise<void>;
  setPriority(ticketId: string, priority: string): Promise<void>;
  assign(ticketId: string, assigneeTelegramId: bigint): Promise<void>;
}

const toRecord = (ticket: {
  id: string;
  number: number;
  chatId: string;
  subject: string;
  status: string;
  priority: string;
  assigneeTelegramId: bigint | null;
  reporterTelegramId: bigint;
  createdAt: Date;
}): TicketRecord => ({
  id: ticket.id,
  number: ticket.number,
  chatId: ticket.chatId,
  subject: ticket.subject,
  status: ticket.status,
  priority: ticket.priority,
  assigneeTelegramId: ticket.assigneeTelegramId,
  reporterTelegramId: ticket.reporterTelegramId,
  createdAt: ticket.createdAt,
});

export class PrismaTicketRepository implements TicketRepository {
  constructor(private readonly client: PrismaClient = defaultPrisma) {}

  async createTicket(input: CreateTicketInput): Promise<TicketRecord> {
    const latest = await this.client.ticket.aggregate({
      where: { tenantId: input.tenantId },
      _max: { number: true },
    });
    const number = (latest._max.number ?? 0) + 1;
    const ticket = await this.client.ticket.create({
      data: {
        tenantId: input.tenantId,
        chatId: input.chatId,
        reporterTelegramId: input.reporterTelegramId,
        subject: input.subject,
        priority: input.priority,
        number,
      },
    });

    return toRecord(ticket);
  }

  async getTicket(
    tenantId: string,
    ticketId: string,
  ): Promise<TicketRecord | null> {
    const ticket = await this.client.ticket.findFirst({
      where: { id: ticketId, tenantId },
    });

    return ticket ? toRecord(ticket) : null;
  }

  async listOpen(
    tenantId: string,
    chatId: string,
    limit = 20,
  ): Promise<TicketRecord[]> {
    const tickets = await this.client.ticket.findMany({
      where: { tenantId, chatId, status: { not: "closed" } },
      orderBy: { number: "desc" },
      take: limit,
    });

    return tickets.map(toRecord);
  }

  async listRecent(
    tenantId: string,
    chatId: string,
    limit = 50,
  ): Promise<TicketRecord[]> {
    const tickets = await this.client.ticket.findMany({
      where: { tenantId, chatId },
      orderBy: { number: "desc" },
      take: limit,
    });

    return tickets.map(toRecord);
  }

  async listByReporter(
    tenantId: string,
    reporterTelegramId: bigint,
    limit = 20,
  ): Promise<TicketRecord[]> {
    const tickets = await this.client.ticket.findMany({
      where: { tenantId, reporterTelegramId },
      orderBy: { number: "desc" },
      take: limit,
    });

    return tickets.map(toRecord);
  }

  async setStatus(ticketId: string, status: string): Promise<void> {
    await this.client.ticket.update({
      where: { id: ticketId },
      data: {
        status,
        ...(status === "closed" ? { closedAt: new Date() } : {}),
      },
    });
  }

  async setPriority(ticketId: string, priority: string): Promise<void> {
    await this.client.ticket.update({
      where: { id: ticketId },
      data: { priority },
    });
  }

  async assign(ticketId: string, assigneeTelegramId: bigint): Promise<void> {
    await this.client.ticket.update({
      where: { id: ticketId },
      data: { assigneeTelegramId, status: "assigned" },
    });
  }
}
