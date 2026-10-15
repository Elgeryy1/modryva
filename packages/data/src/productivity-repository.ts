import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "./client.js";

export interface ReminderRecord {
  readonly id: string;
  readonly tenantId: string;
  readonly telegramChatId: bigint;
  readonly text: string;
  readonly runAt: Date;
}

export interface CreateReminderInput {
  readonly tenantId: string;
  readonly chatId: string;
  readonly telegramChatId: bigint;
  readonly telegramUserId: bigint;
  readonly text: string;
  readonly runAt: Date;
}

export interface TaskRecord {
  readonly id: string;
  readonly number: number;
  readonly title: string;
  readonly done: boolean;
}

export interface AfkRecord {
  readonly telegramUserId: bigint;
  readonly username: string | undefined;
  readonly reason: string | undefined;
  readonly since: Date;
}

export interface SetAfkInput {
  readonly tenantId: string;
  readonly telegramUserId: bigint;
  readonly username: string | undefined;
  readonly reason: string | undefined;
}

export interface ProductivityRepository {
  createReminder(input: CreateReminderInput): Promise<ReminderRecord>;
  setAfk(input: SetAfkInput): Promise<void>;
  clearAfk(tenantId: string, telegramUserId: bigint): Promise<AfkRecord | null>;
  findAfk(tenantId: string, telegramUserId: bigint): Promise<AfkRecord | null>;
  findAfkByUsernames(
    tenantId: string,
    usernames: readonly string[],
  ): Promise<AfkRecord[]>;
  listPendingReminders(
    chatId: string,
    telegramUserId: bigint,
    limit?: number,
  ): Promise<ReminderRecord[]>;
  listDueReminders(now: Date, limit?: number): Promise<ReminderRecord[]>;
  markReminderFired(id: string): Promise<void>;
  cancelReminder(chatId: string, id: string): Promise<boolean>;
  createTask(
    tenantId: string,
    chatId: string,
    telegramUserId: bigint,
    title: string,
  ): Promise<TaskRecord>;
  listTasks(
    chatId: string,
    telegramUserId: bigint,
    limit?: number,
  ): Promise<TaskRecord[]>;
  completeTask(chatId: string, taskId: string): Promise<boolean>;
}

const toReminder = (reminder: {
  id: string;
  tenantId: string;
  telegramChatId: bigint;
  text: string;
  runAt: Date;
}): ReminderRecord => ({
  id: reminder.id,
  tenantId: reminder.tenantId,
  telegramChatId: reminder.telegramChatId,
  text: reminder.text,
  runAt: reminder.runAt,
});

const toTask = (task: {
  id: string;
  number: number;
  title: string;
  done: boolean;
}): TaskRecord => ({
  id: task.id,
  number: task.number,
  title: task.title,
  done: task.done,
});

const toAfk = (afk: {
  telegramUserId: bigint;
  username: string | null;
  reason: string | null;
  since: Date;
}): AfkRecord => ({
  telegramUserId: afk.telegramUserId,
  username: afk.username ?? undefined,
  reason: afk.reason ?? undefined,
  since: afk.since,
});

export class PrismaProductivityRepository implements ProductivityRepository {
  constructor(private readonly client: PrismaClient = defaultPrisma) {}

  async setAfk(input: SetAfkInput): Promise<void> {
    await this.client.afkStatus.upsert({
      where: {
        tenantId_telegramUserId: {
          tenantId: input.tenantId,
          telegramUserId: input.telegramUserId,
        },
      },
      create: {
        tenantId: input.tenantId,
        telegramUserId: input.telegramUserId,
        username: input.username ?? null,
        reason: input.reason ?? null,
      },
      update: {
        username: input.username ?? null,
        reason: input.reason ?? null,
        since: new Date(),
      },
    });
  }

  async clearAfk(
    tenantId: string,
    telegramUserId: bigint,
  ): Promise<AfkRecord | null> {
    const existing = await this.client.afkStatus.findUnique({
      where: { tenantId_telegramUserId: { tenantId, telegramUserId } },
    });

    if (!existing) {
      return null;
    }

    await this.client.afkStatus.delete({ where: { id: existing.id } });

    return toAfk(existing);
  }

  async findAfk(
    tenantId: string,
    telegramUserId: bigint,
  ): Promise<AfkRecord | null> {
    const afk = await this.client.afkStatus.findUnique({
      where: { tenantId_telegramUserId: { tenantId, telegramUserId } },
    });

    return afk ? toAfk(afk) : null;
  }

  async findAfkByUsernames(
    tenantId: string,
    usernames: readonly string[],
  ): Promise<AfkRecord[]> {
    if (usernames.length === 0) {
      return [];
    }

    const rows = await this.client.afkStatus.findMany({
      where: {
        tenantId,
        username: { in: [...usernames], mode: "insensitive" },
      },
    });

    return rows.map(toAfk);
  }

  async createReminder(input: CreateReminderInput): Promise<ReminderRecord> {
    const reminder = await this.client.reminder.create({
      data: {
        tenantId: input.tenantId,
        chatId: input.chatId,
        telegramChatId: input.telegramChatId,
        telegramUserId: input.telegramUserId,
        text: input.text,
        runAt: input.runAt,
      },
    });

    return toReminder(reminder);
  }

  async listPendingReminders(
    chatId: string,
    telegramUserId: bigint,
    limit = 20,
  ): Promise<ReminderRecord[]> {
    const reminders = await this.client.reminder.findMany({
      where: { chatId, telegramUserId, status: "pending" },
      orderBy: { runAt: "asc" },
      take: limit,
    });

    return reminders.map(toReminder);
  }

  async listDueReminders(now: Date, limit = 50): Promise<ReminderRecord[]> {
    const reminders = await this.client.reminder.findMany({
      where: { status: "pending", runAt: { lte: now } },
      take: limit,
    });

    return reminders.map(toReminder);
  }

  async markReminderFired(id: string): Promise<void> {
    await this.client.reminder.update({
      where: { id },
      data: { status: "fired", firedAt: new Date() },
    });
  }

  async cancelReminder(chatId: string, id: string): Promise<boolean> {
    const result = await this.client.reminder.deleteMany({
      where: { id, chatId, status: "pending" },
    });

    return result.count > 0;
  }

  async createTask(
    tenantId: string,
    chatId: string,
    telegramUserId: bigint,
    title: string,
  ): Promise<TaskRecord> {
    const latest = await this.client.task.aggregate({
      where: { chatId },
      _max: { number: true },
    });
    const number = (latest._max.number ?? 0) + 1;
    const task = await this.client.task.create({
      data: { tenantId, chatId, telegramUserId, title, number },
    });

    return toTask(task);
  }

  async listTasks(
    chatId: string,
    telegramUserId: bigint,
    limit = 20,
  ): Promise<TaskRecord[]> {
    const tasks = await this.client.task.findMany({
      where: { chatId, telegramUserId, done: false },
      orderBy: { number: "asc" },
      take: limit,
    });

    return tasks.map(toTask);
  }

  async completeTask(chatId: string, taskId: string): Promise<boolean> {
    const result = await this.client.task.updateMany({
      where: { id: taskId, chatId, done: false },
      data: { done: true },
    });

    return result.count > 0;
  }
}
