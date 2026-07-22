import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "./client.js";

/**
 * Misiones cooperativas de grupo (ideas #104/105/108): un objetivo comun por
 * chat con progreso acumulado. La logica pura (avance, %, completado) vive en
 * @superbot/module-community (coop-missions); aqui solo esta la persistencia del
 * objetivo/progreso/descripcion, scoped por tenant + chat.
 */

/** Estado persistido de la mision de un chat. */
export interface CoopMissionRecord {
  readonly goal: number;
  readonly progress: number;
  readonly description: string;
}

export interface CoopMissionRepository {
  getMission(
    tenantId: string,
    chatId: string,
  ): Promise<CoopMissionRecord | null>;
  setMission(
    tenantId: string,
    chatId: string,
    state: CoopMissionRecord,
  ): Promise<void>;
}

export class PrismaCoopMissionRepository implements CoopMissionRepository {
  constructor(private readonly client: PrismaClient = defaultPrisma) {}

  async getMission(
    tenantId: string,
    chatId: string,
  ): Promise<CoopMissionRecord | null> {
    const mission = await this.client.coopMissionState.findUnique({
      where: { tenantId_chatId: { tenantId, chatId } },
    });
    if (!mission) {
      return null;
    }
    return {
      goal: mission.goal,
      progress: mission.progress,
      description: mission.description,
    };
  }

  async setMission(
    tenantId: string,
    chatId: string,
    state: CoopMissionRecord,
  ): Promise<void> {
    await this.client.coopMissionState.upsert({
      where: { tenantId_chatId: { tenantId, chatId } },
      create: {
        tenantId,
        chatId,
        goal: state.goal,
        progress: state.progress,
        description: state.description,
      },
      update: {
        goal: state.goal,
        progress: state.progress,
        description: state.description,
      },
    });
  }
}

/** Store en memoria usado como default del constructor (tests). */
export class InMemoryCoopMissionRepository implements CoopMissionRepository {
  private missions = new Map<string, CoopMissionRecord>();

  private key(tenantId: string, chatId: string): string {
    return `${tenantId}:${chatId}`;
  }

  async getMission(
    tenantId: string,
    chatId: string,
  ): Promise<CoopMissionRecord | null> {
    return this.missions.get(this.key(tenantId, chatId)) ?? null;
  }

  async setMission(
    tenantId: string,
    chatId: string,
    state: CoopMissionRecord,
  ): Promise<void> {
    this.missions.set(this.key(tenantId, chatId), {
      goal: state.goal,
      progress: state.progress,
      description: state.description,
    });
  }
}
