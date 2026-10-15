import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "./client.js";

/**
 * El registro de administracion nativo de Telegram (`channels.getAdminLog`),
 * que la Bot API no expone. `telegramEventId` es la clave de idempotencia:
 * sincronizar el mismo tramo dos veces no duplica filas.
 *
 * Dos lecturas distintas de la misma tabla, a proposito:
 * `listarParaStaff` quita `actorTelegramId` porque auditar al staff es del
 * propietario, no del propio staff — la misma razon por la que
 * `PermisosPort` separa `puedeModerar` de `puedeConfigurar`.
 * `listarCompleto` es solo para el consultor.
 */

export interface EventoAdminLog {
  readonly telegramEventId: string;
  readonly accion: string;
  readonly actorTelegramId: bigint;
  readonly objetivoTelegramId: bigint | null;
  readonly detalle: unknown;
  readonly ocurrioEn: Date;
}

export interface EventoAdminLogParaStaff {
  readonly accion: string;
  readonly objetivoTelegramId: bigint | null;
  readonly ocurrioEn: Date;
}

export interface AyudanteAdminLogRepository {
  /** Idempotente por `telegramEventId`: reintentar una sincronizacion no duplica. */
  ingerir(input: {
    readonly tenantId: string;
    readonly chatId: string;
    readonly eventos: readonly EventoAdminLog[];
  }): Promise<{ readonly nuevos: number }>;

  /** Sin el actor. Es lo que puede ver un moderador. */
  listarParaStaff(input: {
    readonly tenantId: string;
    readonly chatId: string;
    readonly desde?: Date;
  }): Promise<readonly EventoAdminLogParaStaff[]>;

  /** Con el actor. Solo para el consultor. */
  listarCompleto(input: {
    readonly tenantId: string;
    readonly chatId: string;
    readonly desde?: Date;
  }): Promise<readonly EventoAdminLog[]>;
}

export class AyudanteAdminLogRepositoryPrisma
  implements AyudanteAdminLogRepository
{
  constructor(private readonly prisma: PrismaClient = defaultPrisma) {}

  async ingerir(input: {
    readonly tenantId: string;
    readonly chatId: string;
    readonly eventos: readonly EventoAdminLog[];
  }): Promise<{ readonly nuevos: number }> {
    if (input.eventos.length === 0) return { nuevos: 0 };

    // Un evento del admin log es inmutable una vez ocurrido: no hace falta
    // `upsert`, solo insertar el que falte. `skipDuplicates` se apoya en el
    // `@@unique([tenantId, chatId, telegramEventId])` para la idempotencia.
    const { count } = await this.prisma.ayudanteAdminLogEvento.createMany({
      data: input.eventos.map((evento) => ({
        tenantId: input.tenantId,
        chatId: input.chatId,
        telegramEventId: evento.telegramEventId,
        accion: evento.accion,
        actorTelegramId: evento.actorTelegramId,
        objetivoTelegramId: evento.objetivoTelegramId,
        detalle: evento.detalle as never,
        ocurrioEn: evento.ocurrioEn,
      })),
      skipDuplicates: true,
    });
    return { nuevos: count };
  }

  async listarParaStaff(input: {
    readonly tenantId: string;
    readonly chatId: string;
    readonly desde?: Date;
  }): Promise<readonly EventoAdminLogParaStaff[]> {
    return this.prisma.ayudanteAdminLogEvento.findMany({
      where: {
        tenantId: input.tenantId,
        chatId: input.chatId,
        ...(input.desde ? { ocurrioEn: { gte: input.desde } } : {}),
      },
      orderBy: { ocurrioEn: "desc" },
      select: { accion: true, objetivoTelegramId: true, ocurrioEn: true },
    });
  }

  async listarCompleto(input: {
    readonly tenantId: string;
    readonly chatId: string;
    readonly desde?: Date;
  }): Promise<readonly EventoAdminLog[]> {
    return this.prisma.ayudanteAdminLogEvento.findMany({
      where: {
        tenantId: input.tenantId,
        chatId: input.chatId,
        ...(input.desde ? { ocurrioEn: { gte: input.desde } } : {}),
      },
      orderBy: { ocurrioEn: "desc" },
      select: {
        telegramEventId: true,
        accion: true,
        actorTelegramId: true,
        objetivoTelegramId: true,
        detalle: true,
        ocurrioEn: true,
      },
    });
  }
}
