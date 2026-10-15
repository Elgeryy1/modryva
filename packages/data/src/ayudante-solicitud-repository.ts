import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "./client.js";

/**
 * La cola bot -> ayudante, en un solo sentido.
 *
 * `apps/bot` escribe filas con `crear` y sigue; nunca espera una respuesta
 * dentro del ciclo de updates. `apps/ayudante` reclama con `reclamarLote`,
 * que es un `updateMany` condicionado a `estado: pendiente` — el mismo patron
 * que `claimUpdate` en el poller de Telegram: si dos pasadas del poller del
 * ayudante coinciden, la segunda no encuentra fila que reclamar.
 */

export type EstadoSolicitudAyudante =
  | "pendiente"
  | "en_proceso"
  | "hecho"
  | "fallo";

export interface SolicitudAyudante {
  readonly id: string;
  readonly tenantId: string;
  readonly tipo: string;
  readonly payload: unknown;
  readonly estado: EstadoSolicitudAyudante;
  readonly intentos: number;
  readonly resultado: unknown;
  readonly error: string | null;
  readonly creadaEn: Date;
  readonly reclamadaEn: Date | null;
  readonly resueltaEn: Date | null;
}

export interface CrearSolicitudInput {
  readonly tenantId: string;
  readonly tipo: string;
  readonly payload: unknown;
}

export interface AyudanteSolicitudRepository {
  /** Encola una solicitud. Nunca lanza por un fallo de conexion previsible del lado del bot: quien la use decide si lo tolera. */
  crear(input: CrearSolicitudInput): Promise<SolicitudAyudante>;

  /**
   * Reclama hasta `limite` solicitudes pendientes, en orden de llegada, y las
   * marca `en_proceso`. Atomico: usa `updateMany` sobre `estado: pendiente`,
   * asi que dos llamadas concurrentes no pueden reclamar la misma fila.
   */
  reclamarLote(limite: number): Promise<readonly SolicitudAyudante[]>;

  marcarHecha(id: string, resultado: unknown): Promise<void>;

  /** `intentos` se incrementa siempre. `definitivo` decide si pasa a `fallo` o vuelve a `pendiente` para reintentar. */
  marcarFallo(input: {
    readonly id: string;
    readonly error: string;
    readonly definitivo: boolean;
  }): Promise<void>;
}

const mapRow = (row: {
  id: string;
  tenantId: string;
  tipo: string;
  payload: unknown;
  estado: string;
  intentos: number;
  resultado: unknown;
  error: string | null;
  creadaEn: Date;
  reclamadaEn: Date | null;
  resueltaEn: Date | null;
}): SolicitudAyudante => ({
  id: row.id,
  tenantId: row.tenantId,
  tipo: row.tipo,
  payload: row.payload,
  estado: row.estado as EstadoSolicitudAyudante,
  intentos: row.intentos,
  resultado: row.resultado,
  error: row.error,
  creadaEn: row.creadaEn,
  reclamadaEn: row.reclamadaEn,
  resueltaEn: row.resueltaEn,
});

export class AyudanteSolicitudRepositoryPrisma
  implements AyudanteSolicitudRepository
{
  constructor(private readonly prisma: PrismaClient = defaultPrisma) {}

  async crear(input: CrearSolicitudInput): Promise<SolicitudAyudante> {
    const row = await this.prisma.ayudanteSolicitud.create({
      data: {
        tenantId: input.tenantId,
        tipo: input.tipo,
        payload: input.payload as never,
      },
    });
    return mapRow(row);
  }

  async reclamarLote(limite: number): Promise<readonly SolicitudAyudante[]> {
    const candidatas = await this.prisma.ayudanteSolicitud.findMany({
      where: { estado: "pendiente" },
      orderBy: { creadaEn: "asc" },
      take: limite,
      select: { id: true },
    });
    if (candidatas.length === 0) return [];

    const ids = candidatas.map((fila) => fila.id);
    const { count } = await this.prisma.ayudanteSolicitud.updateMany({
      where: { id: { in: ids }, estado: "pendiente" },
      data: { estado: "en_proceso", reclamadaEn: new Date() },
    });
    if (count === 0) return [];

    const reclamadas = await this.prisma.ayudanteSolicitud.findMany({
      where: { id: { in: ids }, estado: "en_proceso" },
      orderBy: { creadaEn: "asc" },
    });
    return reclamadas.map(mapRow);
  }

  async marcarHecha(id: string, resultado: unknown): Promise<void> {
    await this.prisma.ayudanteSolicitud.update({
      where: { id },
      data: {
        estado: "hecho",
        resultado: resultado as never,
        resueltaEn: new Date(),
      },
    });
  }

  async marcarFallo(input: {
    readonly id: string;
    readonly error: string;
    readonly definitivo: boolean;
  }): Promise<void> {
    await this.prisma.ayudanteSolicitud.update({
      where: { id: input.id },
      data: {
        estado: input.definitivo ? "fallo" : "pendiente",
        intentos: { increment: 1 },
        error: input.error,
        resueltaEn: input.definitivo ? new Date() : null,
      },
    });
  }
}
