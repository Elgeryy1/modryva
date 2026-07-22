import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "./client.js";

/**
 * Repositorio para la cola de trabajos pendientes ya modelada en Prisma
 * (`JobOutbox`, schema.prisma linea ~552: tenantId?, topic, payload Json,
 * state, runAfter?, lockedAt?, createdAt, updatedAt). Este archivo SOLO anade
 * el repositorio; el modelo ya existia y no se toca.
 *
 * Cierra el hueco senalado por el TODO literal en
 * apps/api/src/guardian/guardian-verify.service.ts ("route through JobOutbox
 * for retry-with-backoff") y sirve tambien como cola de acciones pendientes
 * para el motor ECA (modules/automation/src/rule-engine.ts) cuando una accion
 * falla y debe reintentarse con backoff (modules/automation/src/retry-backoff.ts)
 * en vez de perderse en silencio.
 *
 * El modelo `JobOutbox` no tiene columna `attempts`: se guarda dentro de
 * `payload` como un sobre `{ data, attempts, lastError? }` para no requerir
 * un cambio de schema. `enqueue`/`claim`/`fail` mantienen ese sobre; el
 * llamador solo ve `payload.data` a traves de `JobOutboxRecord.payload`.
 */

export type JobOutboxState = "pending" | "processing" | "done" | "failed";

export interface JobOutboxRecord {
  readonly id: string;
  readonly tenantId: string | null;
  readonly topic: string;
  /** El payload de negocio original (sin el sobre de reintentos). */
  readonly payload: unknown;
  readonly state: JobOutboxState;
  readonly attempts: number;
  readonly lastError: string | null;
  readonly runAfter: Date | null;
  readonly lockedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface JobOutboxFailOptions {
  /** Si se da, el job vuelve a "pending" con este `runAfter` (reintento con backoff). */
  readonly retryAt?: Date;
  /** Mensaje de error a registrar en el sobre, para depuracion. */
  readonly error?: string;
  /** Si es true (o no se da `retryAt`), el job pasa a "failed" definitivo. */
  readonly permanent?: boolean;
}

export interface JobOutboxRepository {
  /** Encola un nuevo trabajo en estado "pending". */
  enqueue(
    tenantId: string | null,
    topic: string,
    payload: unknown,
    runAfter?: Date,
  ): Promise<JobOutboxRecord>;
  /**
   * Reclama hasta `limit` trabajos de `topic` listos para procesar (pending
   * con runAfter vencido, o processing colgado desde hace mas de
   * `staleAfterMsMs`, es decir un worker que murio con el lock puesto) y los
   * marca "processing" con `lockedAt = now`. Best-effort: pensado para un
   * unico worker o pocos workers de baja concurrencia, no usa
   * SELECT ... FOR UPDATE SKIP LOCKED, asi que dos workers concurrentes
   * podrian reclamar el mismo lote en una carrera muy estrecha.
   */
  claim(
    topic: string,
    now: Date,
    staleAfterMs: number,
    limit?: number,
  ): Promise<JobOutboxRecord[]>;
  /** Marca el trabajo como terminado con exito. */
  complete(id: string): Promise<boolean>;
  /** Registra un fallo: reintento con backoff (retryAt) o fallo definitivo. */
  fail(id: string, options?: JobOutboxFailOptions): Promise<boolean>;
}

interface JobEnvelope {
  readonly data: unknown;
  readonly attempts: number;
  readonly lastError?: string;
}

const isEnvelope = (value: unknown): value is JobEnvelope =>
  typeof value === "object" &&
  value !== null &&
  "data" in value &&
  "attempts" in value;

const wrapEnvelope = (payload: unknown): JobEnvelope => ({
  data: payload,
  attempts: 0,
});

const toJson = (value: unknown): Prisma.InputJsonValue =>
  value as Prisma.InputJsonValue;

const toState = (value: string): JobOutboxState =>
  value === "processing" || value === "done" || value === "failed"
    ? value
    : "pending";

interface JobOutboxRow {
  id: string;
  tenantId: string | null;
  topic: string;
  payload: unknown;
  state: string;
  runAfter: Date | null;
  lockedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const toRecord = (row: JobOutboxRow): JobOutboxRecord => {
  const envelope = isEnvelope(row.payload)
    ? row.payload
    : wrapEnvelope(row.payload);
  return {
    id: row.id,
    tenantId: row.tenantId,
    topic: row.topic,
    payload: envelope.data,
    state: toState(row.state),
    attempts: envelope.attempts,
    lastError: envelope.lastError ?? null,
    runAfter: row.runAfter,
    lockedAt: row.lockedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
};

export class PrismaJobOutboxRepository implements JobOutboxRepository {
  constructor(private readonly client: PrismaClient = defaultPrisma) {}

  async enqueue(
    tenantId: string | null,
    topic: string,
    payload: unknown,
    runAfter?: Date,
  ): Promise<JobOutboxRecord> {
    const row = await this.client.jobOutbox.create({
      data: {
        tenantId,
        topic,
        payload: toJson(wrapEnvelope(payload)),
        state: "pending",
        runAfter: runAfter ?? null,
      },
    });
    return toRecord(row);
  }

  async claim(
    topic: string,
    now: Date,
    staleAfterMs: number,
    limit = 10,
  ): Promise<JobOutboxRecord[]> {
    const staleBefore = new Date(now.getTime() - staleAfterMs);
    const candidates = await this.client.jobOutbox.findMany({
      where: {
        topic,
        OR: [
          { state: "pending", OR: [{ runAfter: null }, { runAfter: { lte: now } }] },
          { state: "processing", lockedAt: { lt: staleBefore } },
        ],
      },
      orderBy: { createdAt: "asc" },
      take: limit,
    });
    if (candidates.length === 0) {
      return [];
    }
    const ids = candidates.map((row) => row.id);
    await this.client.jobOutbox.updateMany({
      where: { id: { in: ids } },
      data: { state: "processing", lockedAt: now },
    });
    // Re-lee para devolver el estado post-claim de forma consistente.
    const claimed = await this.client.jobOutbox.findMany({
      where: { id: { in: ids } },
    });
    return claimed.map(toRecord);
  }

  async complete(id: string): Promise<boolean> {
    try {
      await this.client.jobOutbox.update({
        where: { id },
        data: { state: "done", lockedAt: null },
      });
      return true;
    } catch {
      return false;
    }
  }

  async fail(id: string, options?: JobOutboxFailOptions): Promise<boolean> {
    try {
      const current = await this.client.jobOutbox.findUnique({ where: { id } });
      if (!current) {
        return false;
      }
      const envelope = isEnvelope(current.payload)
        ? current.payload
        : wrapEnvelope(current.payload);
      const nextEnvelope: JobEnvelope = {
        data: envelope.data,
        attempts: envelope.attempts + 1,
        ...(options?.error !== undefined ? { lastError: options.error } : {}),
      };
      const permanent = options?.permanent === true || !options?.retryAt;
      await this.client.jobOutbox.update({
        where: { id },
        data: {
          payload: toJson(nextEnvelope),
          state: permanent ? "failed" : "pending",
          runAfter: permanent ? current.runAfter : options?.retryAt,
          lockedAt: null,
        },
      });
      return true;
    } catch {
      return false;
    }
  }
}

/** Store en memoria usado como default del constructor (tests) y en runtimes sin Prisma. */
export class InMemoryJobOutboxRepository implements JobOutboxRepository {
  private readonly rows = new Map<
    string,
    {
      id: string;
      tenantId: string | null;
      topic: string;
      envelope: JobEnvelope;
      state: JobOutboxState;
      runAfter: Date | null;
      lockedAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
    }
  >();
  private seq = 0;

  private toRecord(row: {
    id: string;
    tenantId: string | null;
    topic: string;
    envelope: JobEnvelope;
    state: JobOutboxState;
    runAfter: Date | null;
    lockedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): JobOutboxRecord {
    return {
      id: row.id,
      tenantId: row.tenantId,
      topic: row.topic,
      payload: row.envelope.data,
      state: row.state,
      attempts: row.envelope.attempts,
      lastError: row.envelope.lastError ?? null,
      runAfter: row.runAfter,
      lockedAt: row.lockedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async enqueue(
    tenantId: string | null,
    topic: string,
    payload: unknown,
    runAfter?: Date,
  ): Promise<JobOutboxRecord> {
    this.seq += 1;
    const now = new Date();
    const row = {
      id: `job_${this.seq}`,
      tenantId,
      topic,
      envelope: wrapEnvelope(payload),
      state: "pending" as JobOutboxState,
      runAfter: runAfter ?? null,
      lockedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.rows.set(row.id, row);
    return this.toRecord(row);
  }

  async claim(
    topic: string,
    now: Date,
    staleAfterMs: number,
    limit = 10,
  ): Promise<JobOutboxRecord[]> {
    const staleBefore = now.getTime() - staleAfterMs;
    const eligible = [...this.rows.values()]
      .filter((row) => {
        if (row.topic !== topic) {
          return false;
        }
        if (row.state === "pending") {
          return row.runAfter === null || row.runAfter.getTime() <= now.getTime();
        }
        if (row.state === "processing") {
          return (row.lockedAt?.getTime() ?? 0) < staleBefore;
        }
        return false;
      })
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .slice(0, limit);

    for (const row of eligible) {
      row.state = "processing";
      row.lockedAt = now;
      row.updatedAt = now;
    }
    return eligible.map((row) => this.toRecord(row));
  }

  async complete(id: string): Promise<boolean> {
    const row = this.rows.get(id);
    if (!row) {
      return false;
    }
    row.state = "done";
    row.lockedAt = null;
    row.updatedAt = new Date();
    return true;
  }

  async fail(id: string, options?: JobOutboxFailOptions): Promise<boolean> {
    const row = this.rows.get(id);
    if (!row) {
      return false;
    }
    row.envelope = {
      data: row.envelope.data,
      attempts: row.envelope.attempts + 1,
      ...(options?.error !== undefined ? { lastError: options.error } : {}),
    };
    const permanent = options?.permanent === true || !options?.retryAt;
    row.state = permanent ? "failed" : "pending";
    row.runAfter = permanent ? row.runAfter : (options?.retryAt ?? null);
    row.lockedAt = null;
    row.updatedAt = new Date();
    return true;
  }
}
