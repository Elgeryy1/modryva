import type { PrismaClient } from "./client.js";
import { prisma } from "./client.js";

/**
 * El borrado por antigüedad de las tres tablas que crecían sin techo.
 *
 * Entre las tres eran 96 MB de los 120 MB de la base de datos, y ninguna tenía
 * purga: `update_inbox` (51 MB), `audit_logs` (22 MB) y `chat_activity_events`
 * (23 MB), las dos primeras desde el 29 de junio.
 *
 * Las tres se borran igual —por fecha, en lotes— pero NO valen lo mismo, y esa
 * diferencia vive en los suelos de `retention.ts`, no aquí.
 *
 * Interfaz aparte y mínima a propósito: `FoundationRepository` la implementan
 * varios sitios (incluido un doble en los tests del bot), y meter aquí métodos
 * que solo usa un job del worker obligaría a todos a implementar algo que no
 * les incumbe.
 */
export interface RetentionRepository {
  /** Registro de de-duplicación de updates de Telegram. Puramente técnico:
   *  solo sirve mientras Telegram pueda reenviar. */
  purgeUpdateInbox(before: Date, limit: number): Promise<number>;
  /** La traza de evidencia. Es lo que permitió reconstruir las 13 expulsiones
   *  del 3 de agosto cuando el job que las hizo no dejó ni un registro. */
  purgeAuditLogs(before: Date, limit: number): Promise<number>;
  /** Señales de actividad para estadísticas y rachas. */
  purgeChatActivityEvents(before: Date, limit: number): Promise<number>;
}

export class PrismaRetentionRepository implements RetentionRepository {
  constructor(private readonly client: PrismaClient = prisma) {}

  /**
   * Se seleccionan los ids primero porque `deleteMany` de Prisma no admite
   * `take`, y un borrado sin tope sobre decenas de miles de filas es una sola
   * transacción larga bloqueando una tabla viva — en el caso de `update_inbox`,
   * la tabla por la que entra CADA update de Telegram. Dos consultas cortas son
   * preferibles a una que pare el bot.
   */
  private async purgar(
    buscar: (before: Date, take: number) => Promise<{ id: string }[]>,
    borrar: (ids: string[]) => Promise<{ count: number }>,
    before: Date,
    limit: number,
  ): Promise<number> {
    const filas = await buscar(before, limit);
    if (filas.length === 0) {
      return 0;
    }
    const { count } = await borrar(filas.map((fila) => fila.id));
    return count;
  }

  purgeUpdateInbox(before: Date, limit: number): Promise<number> {
    return this.purgar(
      (corte, take) =>
        this.client.updateInbox.findMany({
          where: { createdAt: { lt: corte } },
          select: { id: true },
          take,
        }),
      (ids) =>
        this.client.updateInbox.deleteMany({ where: { id: { in: ids } } }),
      before,
      limit,
    );
  }

  purgeAuditLogs(before: Date, limit: number): Promise<number> {
    return this.purgar(
      (corte, take) =>
        this.client.auditLog.findMany({
          where: { createdAt: { lt: corte } },
          select: { id: true },
          take,
        }),
      (ids) => this.client.auditLog.deleteMany({ where: { id: { in: ids } } }),
      before,
      limit,
    );
  }

  purgeChatActivityEvents(before: Date, limit: number): Promise<number> {
    return this.purgar(
      (corte, take) =>
        this.client.chatActivityEvent.findMany({
          where: { createdAt: { lt: corte } },
          select: { id: true },
          take,
        }),
      (ids) =>
        this.client.chatActivityEvent.deleteMany({
          where: { id: { in: ids } },
        }),
      before,
      limit,
    );
  }
}
