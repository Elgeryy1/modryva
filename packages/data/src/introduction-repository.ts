import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "./client.js";

/**
 * Newcomers on the clock to introduce themselves.
 *
 * Rows are transient by design — created on join, deleted the moment the person
 * either introduces themselves or a human decides their case — so this table
 * measures "how many people are open right now", never the group's whole join
 * history.
 *
 * A row has two lives: the clock (`reportedAt` null) and the STAFF card
 * (`reportedAt` set). The second exists only because the buttons need something
 * to act on — see the sweep in apps/worker/src/guardian-processor.ts.
 */

export interface IntroductionPendingRecord {
  readonly id: string;
  readonly tenantId: string;
  readonly chatId: string;
  readonly telegramChatId: bigint;
  readonly telegramUserId: bigint;
  readonly username: string | null;
  readonly joinedAt: Date;
  readonly dueAt: Date;
  /** Avisos de la escalada ya puestos después de la ficha. */
  readonly reminders: number;
  /** Set once the STAFF card is posted; desde ahí escala en vez de ignorarse. */
  readonly reportedAt: Date | null;
  /** Dónde quedó la ficha de STAFF, para poder editarla al expulsar. Null en
   * filas anteriores a la migración o si el envío no devolvió message_id. */
  readonly staffChatId: bigint | null;
  readonly staffThreadId: number | null;
  readonly staffMessageId: number | null;
}

export interface IntroductionRepository {
  /** Starts the clock. Re-joining restarts it rather than stacking rows. */
  start(input: {
    readonly tenantId: string;
    readonly chatId: string;
    readonly telegramChatId: bigint;
    readonly telegramUserId: bigint;
    readonly username?: string | null;
    readonly dueAt: Date;
  }): Promise<void>;
  find(
    tenantId: string,
    chatId: string,
    telegramUserId: bigint,
  ): Promise<IntroductionPendingRecord | null>;
  /** The row a STAFF button refers to. Null once the case is closed. */
  findById(id: string): Promise<IntroductionPendingRecord | null>;
  /** Called when they introduce themselves, or are removed. */
  clear(
    tenantId: string,
    chatId: string,
    telegramUserId: bigint,
  ): Promise<void>;
  /**
   * Everyone past their deadline AND without a STAFF card yet, oldest first.
   * Rows already reported are somebody's decision to make, not the sweep's.
   */
  listOverdue(
    now: Date,
    limit?: number,
  ): Promise<readonly IntroductionPendingRecord[]>;
  /**
   * Marks the STAFF card as posted. Returns false when the row was already
   * reported or is gone — the sweep uses that to avoid a double card if two
   * ticks ever overlap.
   */
  markReported(id: string, at: Date): Promise<boolean>;
  /**
   * Undoes {@link markReported} when the card never reached Telegram. Without
   * it a failed send would leave the row marked as "a human has this" when
   * nobody was ever asked, and it would never be retried.
   */
  unmarkReported(id: string): Promise<void>;
  /** Un aviso de escalada más; devuelve el total tras sumarlo. */
  /**
   * Reserva el recordatorio numero `remindersVistos + 1`.
   *
   * Devuelve `false` si otro tick ya lo reservo. Es la misma tecnica que
   * `markReported`, y por el mismo motivo: el barrido corre cada 60 s y
   * BullMQ programa la vuelta siguiente **al coger** el job, no al
   * terminarlo, asi que una vuelta lenta se solapa con la siguiente.
   *
   * Antes esto era un incremento incondicional **despues** de crear el
   * aviso: dos ticks solapados leian el mismo `reminders`, los dos pasaban
   * la comprobacion de tiempo y los dos avisaban. Con la escalada a
   * expulsion detras (`autoKickAtLimit`), un aviso de mas acerca a alguien
   * a que le echen.
   */
  reclamarRecordatorio(id: string, remindersVistos: number): Promise<boolean>;
  /**
   * Filas con ficha ya publicada, más antiguas primero: las candidatas a
   * escalar. El "¿le toca ya?" se decide fuera, porque la cadencia es un
   * ajuste por chat y aquí no hay settings.
   */
  listReported(limit?: number): Promise<readonly IntroductionPendingRecord[]>;
  /**
   * Guarda dónde quedó publicada la ficha. Aparte de {@link markReported}
   * porque el message_id no existe hasta que Telegram responde, y la marca
   * tiene que ponerse ANTES de enviar (es el candado anti-duplicados).
   */
  attachStaffCard(
    id: string,
    refs: {
      readonly staffChatId: bigint;
      readonly staffThreadId: number | null;
      readonly staffMessageId: number;
    },
  ): Promise<void>;
}

const toRecord = (row: {
  id: string;
  tenantId: string;
  chatId: string;
  telegramChatId: bigint;
  telegramUserId: bigint;
  username: string | null;
  joinedAt: Date;
  dueAt: Date;
  reminders: number;
  reportedAt: Date | null;
  staffChatId: bigint | null;
  staffThreadId: number | null;
  staffMessageId: number | null;
}): IntroductionPendingRecord => ({ ...row });

export class PrismaIntroductionRepository implements IntroductionRepository {
  constructor(private readonly client: PrismaClient = defaultPrisma) {}

  async start(input: {
    tenantId: string;
    chatId: string;
    telegramChatId: bigint;
    telegramUserId: bigint;
    username?: string | null;
    dueAt: Date;
  }): Promise<void> {
    const shared = {
      telegramChatId: input.telegramChatId,
      username: input.username ?? null,
      dueAt: input.dueAt,
    };
    await this.client.introductionPending.upsert({
      where: {
        tenantId_chatId_telegramUserId: {
          tenantId: input.tenantId,
          chatId: input.chatId,
          telegramUserId: input.telegramUserId,
        },
      },
      create: {
        tenantId: input.tenantId,
        chatId: input.chatId,
        telegramUserId: input.telegramUserId,
        ...shared,
      },
      // Re-joining restarts the clock AND the reminder count: someone who left
      // and came back is starting over, not continuing a stale strike record.
      // `reportedAt` se limpia por lo mismo — si volvio a entrar, la ficha
      // vieja del staff ya no describe su situacion. Y sus referencias
      // tambien: editar esa ficha vieja al expulsar contaria una historia que
      // ya no es la suya.
      update: {
        ...shared,
        joinedAt: new Date(),
        reminders: 0,
        reportedAt: null,
        staffChatId: null,
        staffThreadId: null,
        staffMessageId: null,
      },
    });
  }

  async findById(id: string): Promise<IntroductionPendingRecord | null> {
    const row = await this.client.introductionPending.findUnique({
      where: { id },
    });
    return row ? toRecord(row) : null;
  }

  async find(
    tenantId: string,
    chatId: string,
    telegramUserId: bigint,
  ): Promise<IntroductionPendingRecord | null> {
    const row = await this.client.introductionPending.findUnique({
      where: {
        tenantId_chatId_telegramUserId: { tenantId, chatId, telegramUserId },
      },
    });
    return row ? toRecord(row) : null;
  }

  async clear(
    tenantId: string,
    chatId: string,
    telegramUserId: bigint,
  ): Promise<void> {
    await this.client.introductionPending.deleteMany({
      where: { tenantId, chatId, telegramUserId },
    });
  }

  async listOverdue(
    now: Date,
    limit = 100,
  ): Promise<readonly IntroductionPendingRecord[]> {
    const rows = await this.client.introductionPending.findMany({
      where: { dueAt: { lte: now }, reportedAt: null },
      orderBy: { dueAt: "asc" },
      take: limit,
    });
    return rows.map(toRecord);
  }

  async markReported(id: string, at: Date): Promise<boolean> {
    // Condicionado a que siga sin reportar: dos ticks solapados no pueden
    // publicar dos fichas de la misma persona, porque el segundo update no
    // encuentra fila que cumpla el where.
    const result = await this.client.introductionPending.updateMany({
      where: { id, reportedAt: null },
      data: { reportedAt: at },
    });
    return result.count === 1;
  }

  async unmarkReported(id: string): Promise<void> {
    await this.client.introductionPending.updateMany({
      where: { id },
      data: { reportedAt: null },
    });
  }

  async reclamarRecordatorio(
    id: string,
    remindersVistos: number,
  ): Promise<boolean> {
    // Condicionado a que `reminders` siga en el valor que vio quien llama:
    // dos ticks solapados no pueden reservar el mismo recordatorio, porque
    // el segundo update no encuentra fila que cumpla el `where`.
    const result = await this.client.introductionPending.updateMany({
      where: { id, reminders: remindersVistos },
      data: { reminders: { increment: 1 } },
    });
    return result.count === 1;
  }

  async listReported(
    limit = 100,
  ): Promise<readonly IntroductionPendingRecord[]> {
    const rows = await this.client.introductionPending.findMany({
      where: { reportedAt: { not: null } },
      orderBy: { reportedAt: "asc" },
      take: limit,
    });
    return rows.map(toRecord);
  }

  async attachStaffCard(
    id: string,
    refs: {
      readonly staffChatId: bigint;
      readonly staffThreadId: number | null;
      readonly staffMessageId: number;
    },
  ): Promise<void> {
    await this.client.introductionPending.updateMany({
      where: { id },
      data: {
        staffChatId: refs.staffChatId,
        staffThreadId: refs.staffThreadId,
        staffMessageId: refs.staffMessageId,
      },
    });
  }
}

/** Test double — same contract, no database. */
export class InMemoryIntroductionRepository implements IntroductionRepository {
  private readonly rows = new Map<string, IntroductionPendingRecord>();
  private seq = 0;

  private key(tenantId: string, chatId: string, userId: bigint): string {
    return `${tenantId}|${chatId}|${userId.toString()}`;
  }

  async start(input: {
    tenantId: string;
    chatId: string;
    telegramChatId: bigint;
    telegramUserId: bigint;
    username?: string | null;
    dueAt: Date;
  }): Promise<void> {
    const key = this.key(input.tenantId, input.chatId, input.telegramUserId);
    this.rows.set(key, {
      id: this.rows.get(key)?.id ?? `ip-${++this.seq}`,
      tenantId: input.tenantId,
      chatId: input.chatId,
      telegramChatId: input.telegramChatId,
      telegramUserId: input.telegramUserId,
      username: input.username ?? null,
      joinedAt: new Date(),
      dueAt: input.dueAt,
      reminders: 0,
      reportedAt: null,
      staffChatId: null,
      staffThreadId: null,
      staffMessageId: null,
    });
  }

  async find(
    tenantId: string,
    chatId: string,
    telegramUserId: bigint,
  ): Promise<IntroductionPendingRecord | null> {
    return this.rows.get(this.key(tenantId, chatId, telegramUserId)) ?? null;
  }

  async findById(id: string): Promise<IntroductionPendingRecord | null> {
    return [...this.rows.values()].find((row) => row.id === id) ?? null;
  }

  async clear(
    tenantId: string,
    chatId: string,
    telegramUserId: bigint,
  ): Promise<void> {
    this.rows.delete(this.key(tenantId, chatId, telegramUserId));
  }

  async listOverdue(
    now: Date,
    limit = 100,
  ): Promise<readonly IntroductionPendingRecord[]> {
    return [...this.rows.values()]
      .filter(
        (row) =>
          row.dueAt.getTime() <= now.getTime() && row.reportedAt === null,
      )
      .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime())
      .slice(0, limit);
  }

  async markReported(id: string, at: Date): Promise<boolean> {
    for (const [key, row] of this.rows) {
      if (row.id === id) {
        if (row.reportedAt !== null) {
          return false;
        }
        this.rows.set(key, { ...row, reportedAt: at });
        return true;
      }
    }
    return false;
  }

  async unmarkReported(id: string): Promise<void> {
    for (const [key, row] of this.rows) {
      if (row.id === id) {
        this.rows.set(key, { ...row, reportedAt: null });
        return;
      }
    }
  }

  async reclamarRecordatorio(
    id: string,
    remindersVistos: number,
  ): Promise<boolean> {
    // El doble tiene que reservar igual que Prisma, o los tests darian verde
    // sobre un comportamiento que la base no tiene.
    for (const [key, row] of this.rows) {
      if (row.id === id) {
        if (row.reminders !== remindersVistos) {
          return false;
        }
        this.rows.set(key, { ...row, reminders: row.reminders + 1 });
        return true;
      }
    }
    return false;
  }

  async listReported(
    limit = 100,
  ): Promise<readonly IntroductionPendingRecord[]> {
    return [...this.rows.values()]
      .filter((row) => row.reportedAt !== null)
      .sort(
        (a, b) =>
          (a.reportedAt?.getTime() ?? 0) - (b.reportedAt?.getTime() ?? 0),
      )
      .slice(0, limit);
  }

  async attachStaffCard(
    id: string,
    refs: {
      readonly staffChatId: bigint;
      readonly staffThreadId: number | null;
      readonly staffMessageId: number;
    },
  ): Promise<void> {
    for (const [key, row] of this.rows) {
      if (row.id === id) {
        this.rows.set(key, { ...row, ...refs });
        return;
      }
    }
  }
}
