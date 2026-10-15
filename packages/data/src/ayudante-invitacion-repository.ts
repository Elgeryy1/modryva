import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "./client.js";

/**
 * Atribucion de enlaces de invitacion, segun Telegram
 * (`messages.getExportedChatInvites`), no segun una cuenta a ojo. `usosTotal`
 * es un valor absoluto que Telegram ya lleva contado; `sincronizar` lo
 * sobrescribe en vez de sumarlo, porque sumar dos lecturas del mismo contador
 * lo duplicaria.
 */

export interface EnlaceSincronizado {
  readonly enlaceId: string;
  readonly creadorTelegramId: bigint;
  readonly usosTotal: number;
}

export interface FilaEnlace extends EnlaceSincronizado {
  readonly chatId: string;
}

export interface EntradaDeRanking {
  readonly creadorTelegramId: bigint;
  /** Usos acumulados de por vida. Para enseñar, nunca para pagar. */
  readonly usosTotal: number;
  /** Usos aun sin liquidar. **Esta** es la cifra sobre la que se paga. */
  readonly usosPendientes: number;
}

export interface AyudanteInvitacionRepository {
  sincronizar(input: {
    readonly tenantId: string;
    readonly chatId: string;
    readonly enlaces: readonly EnlaceSincronizado[];
  }): Promise<void>;

  rankingDeReclutadores(input: {
    readonly tenantId: string;
    readonly chatId: string;
  }): Promise<readonly EntradaDeRanking[]>;

  /**
   * Marca como liquidados los usos pendientes de un reclutador y devuelve
   * cuantos eran. Llamarlo dos veces seguidas devuelve 0 la segunda: el
   * `updateMany` lleva la condicion en el WHERE, asi que dos liquidaciones
   * simultaneas no pueden pasar las dos -- el mismo patron que
   * `EconomyRepository.debit` y que el cobro de raciones de las mascotas.
   *
   * Devuelve los usos, no el dinero: la tarifa no vive aqui.
   */
  liquidarPendientes(input: {
    readonly tenantId: string;
    readonly chatId: string;
    readonly creadorTelegramId: bigint;
  }): Promise<{ readonly usosLiquidadosAhora: number }>;
}

export class AyudanteInvitacionRepositoryPrisma
  implements AyudanteInvitacionRepository
{
  constructor(private readonly prisma: PrismaClient = defaultPrisma) {}

  async sincronizar(input: {
    readonly tenantId: string;
    readonly chatId: string;
    readonly enlaces: readonly EnlaceSincronizado[];
  }): Promise<void> {
    const ahora = new Date();
    for (const enlace of input.enlaces) {
      await this.prisma.ayudanteEnlaceInvitacion.upsert({
        where: {
          tenantId_chatId_enlaceId: {
            tenantId: input.tenantId,
            chatId: input.chatId,
            enlaceId: enlace.enlaceId,
          },
        },
        create: {
          tenantId: input.tenantId,
          chatId: input.chatId,
          enlaceId: enlace.enlaceId,
          creadorTelegramId: enlace.creadorTelegramId,
          usosTotal: enlace.usosTotal,
          sincronizadoEn: ahora,
        },
        update: { usosTotal: enlace.usosTotal, sincronizadoEn: ahora },
      });
    }
  }

  async rankingDeReclutadores(input: {
    readonly tenantId: string;
    readonly chatId: string;
  }): Promise<readonly EntradaDeRanking[]> {
    const filas = await this.prisma.ayudanteEnlaceInvitacion.findMany({
      where: { tenantId: input.tenantId, chatId: input.chatId },
      select: {
        creadorTelegramId: true,
        usosTotal: true,
        usosLiquidados: true,
      },
    });

    const porCreador = new Map<string, EntradaDeRanking>();
    for (const fila of filas) {
      const clave = fila.creadorTelegramId.toString();
      const acumulado = porCreador.get(clave);
      // Nunca negativo: si alguien revoca un enlace y Telegram devuelve un
      // contador menor que lo ya liquidado, lo pendiente es cero, no una
      // deuda del reclutador.
      const pendientesDeLaFila = Math.max(
        0,
        fila.usosTotal - fila.usosLiquidados,
      );
      porCreador.set(clave, {
        creadorTelegramId: fila.creadorTelegramId,
        usosTotal: (acumulado?.usosTotal ?? 0) + fila.usosTotal,
        usosPendientes: (acumulado?.usosPendientes ?? 0) + pendientesDeLaFila,
      });
    }

    return [...porCreador.values()].sort((a, b) => b.usosTotal - a.usosTotal);
  }

  async liquidarPendientes(input: {
    readonly tenantId: string;
    readonly chatId: string;
    readonly creadorTelegramId: bigint;
  }): Promise<{ readonly usosLiquidadosAhora: number }> {
    return this.prisma.$transaction(async (tx) => {
      const filas = await tx.ayudanteEnlaceInvitacion.findMany({
        where: {
          tenantId: input.tenantId,
          chatId: input.chatId,
          creadorTelegramId: input.creadorTelegramId,
        },
        select: { id: true, usosTotal: true, usosLiquidados: true },
      });

      let total = 0;
      for (const fila of filas) {
        const pendientes = Math.max(0, fila.usosTotal - fila.usosLiquidados);
        if (pendientes === 0) continue;

        // La condicion va en el WHERE, no en un `if` antes del update: es lo
        // que impide que dos liquidaciones a la vez paguen las dos.
        const { count } = await tx.ayudanteEnlaceInvitacion.updateMany({
          where: { id: fila.id, usosLiquidados: fila.usosLiquidados },
          data: { usosLiquidados: fila.usosTotal },
        });
        if (count > 0) total += pendientes;
      }

      return { usosLiquidadosAhora: total };
    });
  }
}
