import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "./client.js";

/**
 * El historial de mediciones del watchdog: el ayudante hace ping al bot desde
 * fuera de su propio proceso y mide cuanto tarda en contestar. Es la unica
 * metrica de salud que no depende del bot para existir.
 */

export interface MedicionWatchdog {
  readonly medidoEn: Date;
  readonly latenciaMs: number | null;
  readonly ok: boolean;
}

export interface AyudanteWatchdogRepository {
  registrar(input: {
    readonly latenciaMs: number | null;
    readonly ok: boolean;
  }): Promise<void>;

  /** Las ultimas `n` mediciones, mas recientes primero. */
  ultimas(n: number): Promise<readonly MedicionWatchdog[]>;
}

export class AyudanteWatchdogRepositoryPrisma
  implements AyudanteWatchdogRepository
{
  constructor(private readonly prisma: PrismaClient = defaultPrisma) {}

  async registrar(input: {
    readonly latenciaMs: number | null;
    readonly ok: boolean;
  }): Promise<void> {
    await this.prisma.ayudanteWatchdogMedicion.create({
      data: { latenciaMs: input.latenciaMs, ok: input.ok },
    });
  }

  async ultimas(n: number): Promise<readonly MedicionWatchdog[]> {
    return this.prisma.ayudanteWatchdogMedicion.findMany({
      orderBy: { medidoEn: "desc" },
      take: n,
      select: { medidoEn: true, latenciaMs: true, ok: true },
    });
  }
}
