import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "./client.js";

/**
 * Pagina de estado dentro del grupo (idea #567): incidencias conocidas por
 * chat. La logica pura de renderizado vive en @superbot/module-support
 * (status-page); aqui solo esta la persistencia (crear, listar, resolver la
 * ultima abierta), scoped por tenant + chat.
 */

/** Una incidencia persistida. `updatedAtMs` es epoch en ms. */
export interface IncidentRecord {
  readonly id: string;
  readonly title: string;
  readonly status: string;
  readonly updatedAtMs: number;
}

export interface IncidentRepository {
  createIncident(
    tenantId: string,
    chatId: string,
    title: string,
  ): Promise<void>;
  listIncidents(
    tenantId: string,
    chatId: string,
    limit: number,
  ): Promise<IncidentRecord[]>;
  /** Marca como "resuelto" la incidencia abierta mas reciente. True si resolvio una. */
  resolveLatestOpen(tenantId: string, chatId: string): Promise<boolean>;
}

export class PrismaIncidentRepository implements IncidentRepository {
  constructor(private readonly client: PrismaClient = defaultPrisma) {}

  async createIncident(
    tenantId: string,
    chatId: string,
    title: string,
  ): Promise<void> {
    await this.client.incident.create({
      data: { tenantId, chatId, title, status: "investigando" },
    });
  }

  async listIncidents(
    tenantId: string,
    chatId: string,
    limit: number,
  ): Promise<IncidentRecord[]> {
    const incidents = await this.client.incident.findMany({
      where: { tenantId, chatId },
      orderBy: { updatedAt: "desc" },
      take: limit,
    });
    return incidents.map((incident) => ({
      id: incident.id,
      title: incident.title,
      status: incident.status,
      updatedAtMs: incident.updatedAt.getTime(),
    }));
  }

  async resolveLatestOpen(tenantId: string, chatId: string): Promise<boolean> {
    const open = await this.client.incident.findFirst({
      where: { tenantId, chatId, status: { not: "resuelto" } },
      orderBy: { updatedAt: "desc" },
    });
    if (!open) {
      return false;
    }
    await this.client.incident.update({
      where: { id: open.id },
      data: { status: "resuelto" },
    });
    return true;
  }
}

/** Store en memoria usado como default del constructor (tests). */
export class InMemoryIncidentRepository implements IncidentRepository {
  private incidents = new Map<string, IncidentRecord[]>();
  private counter = 0;

  private key(tenantId: string, chatId: string): string {
    return `${tenantId}:${chatId}`;
  }

  async createIncident(
    tenantId: string,
    chatId: string,
    title: string,
  ): Promise<void> {
    const key = this.key(tenantId, chatId);
    const list = this.incidents.get(key) ?? [];
    this.counter += 1;
    list.push({
      id: `inc-${this.counter}`,
      title,
      status: "investigando",
      updatedAtMs: this.counter,
    });
    this.incidents.set(key, list);
  }

  async listIncidents(
    tenantId: string,
    chatId: string,
    limit: number,
  ): Promise<IncidentRecord[]> {
    const list = this.incidents.get(this.key(tenantId, chatId)) ?? [];
    return [...list].reverse().slice(0, limit);
  }

  async resolveLatestOpen(tenantId: string, chatId: string): Promise<boolean> {
    const list = this.incidents.get(this.key(tenantId, chatId)) ?? [];
    for (let i = list.length - 1; i >= 0; i -= 1) {
      const incident = list[i];
      if (incident && incident.status !== "resuelto") {
        list[i] = { ...incident, status: "resuelto" };
        return true;
      }
    }
    return false;
  }
}
