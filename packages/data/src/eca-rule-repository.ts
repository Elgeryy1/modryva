import type { Prisma, PrismaClient } from "@prisma/client";
import type { AutomationAction } from "./automation-repository.js";
import { prisma as defaultPrisma } from "./client.js";

/**
 * Repositorio para las reglas del motor ECA puro
 * (modules/automation/src/rule-engine.ts: EcaRule/RuleCondition/RuleContext).
 * Es una superficie NUEVA y PARALELA a `OwnerNetworkAutomation` /
 * `matchAutomation` (automation-repository.ts) — ambas coexisten; esta no
 * sustituye ni desactiva la simple. Reutiliza el MISMO vocabulario de acciones
 * (`AutomationAction`) que ya ejecuta `executeAutomationAction` en
 * bot-update.service.ts, para no crear un segundo ejecutor de acciones.
 *
 * `RuleConditionRecord` refleja a proposito, campo a campo, el `RuleCondition`
 * puro de modules/automation/src/rule-engine.ts en vez de importarlo:
 * packages/data no depende de modules/automation (ver package.json), así que
 * el shape se duplica aquí como el contrato de persistencia. El motor puro
 * sigue siendo la única fuente de verdad para CÓMO se evalúa una condición.
 */
export type EcaRuleConditionOp = "eq" | "neq" | "gt" | "lt" | "contains";

export interface EcaRuleConditionRecord {
  readonly field: string;
  readonly op: EcaRuleConditionOp;
  readonly value: string | number;
}

export interface EcaRuleRecord {
  readonly id: string;
  readonly tenantId: string;
  readonly chatId: string | null;
  readonly event: string;
  readonly conditions: readonly EcaRuleConditionRecord[];
  readonly action: AutomationAction;
  readonly enabled: boolean;
  /** Milisegundos minimos entre disparos; null = sin enfriamiento. */
  readonly cooldownMs: number | null;
  /** Epoch (ms) a partir del cual la regla ya no puede dispararse; null = sin caducidad. */
  readonly expiresAtMs: number | null;
  /** Epoch (ms) del ultimo disparo, o null si nunca se disparo. */
  readonly lastFiredMs: number | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface EcaRulePatch {
  readonly event?: string;
  readonly conditions?: readonly EcaRuleConditionRecord[];
  readonly action?: AutomationAction;
  readonly enabled?: boolean;
  readonly cooldownMs?: number | null;
  readonly expiresAtMs?: number | null;
}

export interface EcaRuleRepository {
  create(
    tenantId: string,
    chatId: string | null,
    event: string,
    conditions: readonly EcaRuleConditionRecord[],
    action: AutomationAction,
    options?: { cooldownMs?: number | null; expiresAtMs?: number | null },
  ): Promise<EcaRuleRecord>;
  /** Todas las reglas del tenant, o de un chat concreto (incluye las de todo el tenant, chatId null). */
  list(tenantId: string, chatId?: string): Promise<EcaRuleRecord[]>;
  update(id: string, patch: EcaRulePatch): Promise<EcaRuleRecord | null>;
  remove(id: string): Promise<boolean>;
  setEnabled(id: string, enabled: boolean): Promise<boolean>;
  /**
   * Reglas habilitadas para `event` visibles desde `chatId` (propias del chat
   * o de todo el tenant), sin filtrar aun por caducidad/enfriamiento — eso lo
   * decide `evaluateRule`/`evaluateRules` (rule-engine.ts) con `nowMs`, para
   * que la logica de disparo siga siendo pura y determinista en el llamador.
   */
  listActiveForEvent(
    tenantId: string,
    chatId: string,
    event: string,
  ): Promise<EcaRuleRecord[]>;
  /** Persiste el instante de disparo, para que el enfriamiento sobreviva a un reinicio del proceso. */
  recordFired(id: string, firedAtMs: number): Promise<boolean>;
}

interface EcaRuleRow {
  id: string;
  tenantId: string;
  chatId: string | null;
  event: string;
  conditions: unknown;
  action: unknown;
  enabled: boolean;
  cooldownMs: number | null;
  expiresAtMs: bigint | null;
  lastFiredMs: bigint | null;
  createdAt: Date;
  updatedAt: Date;
}

const toRecord = (row: EcaRuleRow): EcaRuleRecord => ({
  id: row.id,
  tenantId: row.tenantId,
  chatId: row.chatId,
  event: row.event,
  conditions: row.conditions as readonly EcaRuleConditionRecord[],
  action: row.action as AutomationAction,
  enabled: row.enabled,
  cooldownMs: row.cooldownMs,
  expiresAtMs: row.expiresAtMs === null ? null : Number(row.expiresAtMs),
  lastFiredMs: row.lastFiredMs === null ? null : Number(row.lastFiredMs),
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const toJson = (value: unknown): Prisma.InputJsonValue =>
  value as Prisma.InputJsonValue;

export class PrismaEcaRuleRepository implements EcaRuleRepository {
  constructor(private readonly client: PrismaClient = defaultPrisma) {}

  async create(
    tenantId: string,
    chatId: string | null,
    event: string,
    conditions: readonly EcaRuleConditionRecord[],
    action: AutomationAction,
    options?: { cooldownMs?: number | null; expiresAtMs?: number | null },
  ): Promise<EcaRuleRecord> {
    const row = await this.client.ecaRule.create({
      data: {
        tenantId,
        chatId,
        event,
        conditions: toJson(conditions),
        action: toJson(action),
        cooldownMs: options?.cooldownMs ?? null,
        expiresAtMs:
          options?.expiresAtMs === undefined || options.expiresAtMs === null
            ? null
            : BigInt(options.expiresAtMs),
      },
    });
    return toRecord(row);
  }

  async list(tenantId: string, chatId?: string): Promise<EcaRuleRecord[]> {
    const rows = await this.client.ecaRule.findMany({
      where: chatId
        ? { tenantId, OR: [{ chatId }, { chatId: null }] }
        : { tenantId },
      orderBy: { createdAt: "asc" },
    });
    return rows.map(toRecord);
  }

  async update(id: string, patch: EcaRulePatch): Promise<EcaRuleRecord | null> {
    try {
      const row = await this.client.ecaRule.update({
        where: { id },
        data: {
          ...(patch.event !== undefined ? { event: patch.event } : {}),
          ...(patch.conditions !== undefined
            ? { conditions: toJson(patch.conditions) }
            : {}),
          ...(patch.action !== undefined
            ? { action: toJson(patch.action) }
            : {}),
          ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
          ...(patch.cooldownMs !== undefined
            ? { cooldownMs: patch.cooldownMs }
            : {}),
          ...(patch.expiresAtMs !== undefined
            ? {
                expiresAtMs:
                  patch.expiresAtMs === null ? null : BigInt(patch.expiresAtMs),
              }
            : {}),
        },
      });
      return toRecord(row);
    } catch {
      return null;
    }
  }

  async remove(id: string): Promise<boolean> {
    try {
      await this.client.ecaRule.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  async setEnabled(id: string, enabled: boolean): Promise<boolean> {
    try {
      await this.client.ecaRule.update({ where: { id }, data: { enabled } });
      return true;
    } catch {
      return false;
    }
  }

  async listActiveForEvent(
    tenantId: string,
    chatId: string,
    event: string,
  ): Promise<EcaRuleRecord[]> {
    const rows = await this.client.ecaRule.findMany({
      where: {
        tenantId,
        event,
        enabled: true,
        OR: [{ chatId }, { chatId: null }],
      },
      orderBy: { createdAt: "asc" },
    });
    return rows.map(toRecord);
  }

  async recordFired(id: string, firedAtMs: number): Promise<boolean> {
    try {
      await this.client.ecaRule.update({
        where: { id },
        data: { lastFiredMs: BigInt(firedAtMs) },
      });
      return true;
    } catch {
      return false;
    }
  }
}

/** Store en memoria usado como default del constructor (tests) y en runtimes sin Prisma. */
export class InMemoryEcaRuleRepository implements EcaRuleRepository {
  private readonly rows = new Map<string, EcaRuleRecord>();
  private seq = 0;

  async create(
    tenantId: string,
    chatId: string | null,
    event: string,
    conditions: readonly EcaRuleConditionRecord[],
    action: AutomationAction,
    options?: { cooldownMs?: number | null; expiresAtMs?: number | null },
  ): Promise<EcaRuleRecord> {
    this.seq += 1;
    const now = new Date();
    const record: EcaRuleRecord = {
      id: `eca_${this.seq}`,
      tenantId,
      chatId,
      event,
      conditions,
      action,
      enabled: true,
      cooldownMs: options?.cooldownMs ?? null,
      expiresAtMs: options?.expiresAtMs ?? null,
      lastFiredMs: null,
      createdAt: now,
      updatedAt: now,
    };
    this.rows.set(record.id, record);
    return record;
  }

  async list(tenantId: string, chatId?: string): Promise<EcaRuleRecord[]> {
    return [...this.rows.values()]
      .filter(
        (row) =>
          row.tenantId === tenantId &&
          (chatId === undefined ||
            row.chatId === chatId ||
            row.chatId === null),
      )
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async update(id: string, patch: EcaRulePatch): Promise<EcaRuleRecord | null> {
    const current = this.rows.get(id);
    if (!current) {
      return null;
    }
    const next: EcaRuleRecord = {
      ...current,
      ...patch,
      updatedAt: new Date(),
    };
    this.rows.set(id, next);
    return next;
  }

  async remove(id: string): Promise<boolean> {
    return this.rows.delete(id);
  }

  async setEnabled(id: string, enabled: boolean): Promise<boolean> {
    const current = this.rows.get(id);
    if (!current) {
      return false;
    }
    this.rows.set(id, { ...current, enabled, updatedAt: new Date() });
    return true;
  }

  async listActiveForEvent(
    tenantId: string,
    chatId: string,
    event: string,
  ): Promise<EcaRuleRecord[]> {
    return [...this.rows.values()]
      .filter(
        (row) =>
          row.tenantId === tenantId &&
          row.event === event &&
          row.enabled &&
          (row.chatId === chatId || row.chatId === null),
      )
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async recordFired(id: string, firedAtMs: number): Promise<boolean> {
    const current = this.rows.get(id);
    if (!current) {
      return false;
    }
    this.rows.set(id, {
      ...current,
      lastFiredMs: firedAtMs,
      updatedAt: new Date(),
    });
    return true;
  }
}
