import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "./client.js";

/**
 * Si un aviso por privado llego, y por que no si no llego. Es la prueba de
 * que el userbot resuelve el problema escrito en el plan de mascotas: un
 * aviso que no llega convierte la factura en una encerrona.
 */

export type EstadoAvisoPrivado =
  | "pendiente"
  | "enviado"
  | "rebotado"
  | "bloqueado";

export interface FilaAvisoPrivado {
  readonly id: string;
  readonly tenantId: string;
  readonly destinatarioTelegramId: bigint;
  readonly tipo: string;
  readonly estado: EstadoAvisoPrivado;
  readonly detalle: unknown;
  readonly creadoEn: Date;
  readonly enviadoEn: Date | null;
}

export interface AyudanteAvisoPrivadoRepository {
  registrarPendiente(input: {
    readonly tenantId: string;
    readonly destinatarioTelegramId: bigint;
    readonly tipo: string;
    readonly detalle?: unknown;
  }): Promise<FilaAvisoPrivado>;

  marcarResultado(input: {
    readonly id: string;
    readonly estado: Exclude<EstadoAvisoPrivado, "pendiente">;
  }): Promise<void>;

  /**
   * Si ya se le mando este tipo de aviso hoy, para no repetirlo en cada
   * barrido.
   *
   * Cuenta `enviado` y tambien `pendiente`: una fila `pendiente` es un envio
   * en curso (o uno que salio pero cuyo marcado no llego a escribirse), y
   * tratarla como "todavia no avisado" es justo lo que manda el mensaje dos
   * veces cuando el despachador reintenta. `rebotado` y `bloqueado` NO
   * cuentan: son intentos fallidos que si merecen otra oportunidad hoy.
   */
  yaSeAviso(input: {
    readonly tenantId: string;
    readonly destinatarioTelegramId: bigint;
    readonly tipo: string;
    readonly desde: Date;
  }): Promise<boolean>;
}

export class AyudanteAvisoPrivadoRepositoryPrisma
  implements AyudanteAvisoPrivadoRepository
{
  constructor(private readonly prisma: PrismaClient = defaultPrisma) {}

  async registrarPendiente(input: {
    readonly tenantId: string;
    readonly destinatarioTelegramId: bigint;
    readonly tipo: string;
    readonly detalle?: unknown;
  }): Promise<FilaAvisoPrivado> {
    return this.prisma.ayudanteAvisoPrivado.create({
      data: {
        tenantId: input.tenantId,
        destinatarioTelegramId: input.destinatarioTelegramId,
        tipo: input.tipo,
        detalle: (input.detalle ?? null) as never,
      },
    });
  }

  async marcarResultado(input: {
    readonly id: string;
    readonly estado: Exclude<EstadoAvisoPrivado, "pendiente">;
  }): Promise<void> {
    await this.prisma.ayudanteAvisoPrivado.update({
      where: { id: input.id },
      data: { estado: input.estado, enviadoEn: new Date() },
    });
  }

  async yaSeAviso(input: {
    readonly tenantId: string;
    readonly destinatarioTelegramId: bigint;
    readonly tipo: string;
    readonly desde: Date;
  }): Promise<boolean> {
    const existente = await this.prisma.ayudanteAvisoPrivado.findFirst({
      where: {
        tenantId: input.tenantId,
        destinatarioTelegramId: input.destinatarioTelegramId,
        tipo: input.tipo,
        estado: { in: ["enviado", "pendiente"] },
        creadoEn: { gte: input.desde },
      },
      select: { id: true },
    });
    return existente !== null;
  }
}
