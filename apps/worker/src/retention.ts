import type { RetentionRepository } from "@superbot/data";

/**
 * Los jobs que ponen techo a las tablas que crecían sin parar.
 *
 * Eran 96 MB de los 120 MB de la base de datos y ninguna se purgaba nunca. Ver
 * el detalle de cada una en `RetentionRepository`.
 */

/** Qué se borra, con qué ventana y con qué suelo. */
export interface RetentionTarget {
  readonly name: string;
  /** Días pedidos por configuración. El suelo puede subirlos, nunca bajarlos. */
  readonly days: number;
  /**
   * El mínimo que ese dato merece, en código y no en configuración.
   *
   * Es lo más importante de este fichero, y va por tabla porque el daño de
   * pasarse es distinto en cada una:
   *
   * - `update_inbox` (2 días): borrar una fila viva no pierde datos, hace que
   *   el update se procese DOS VECES —`claimUpdate` ya no encuentra la marca—,
   *   o sea un baneo doble o un mensaje duplicado.
   * - `audit_logs` (30 días): es la prueba de lo que hizo el bot. Un cero mal
   *   puesto aquí no duplica nada: borra la única forma de reconstruir un
   *   incidente, y eso no se arregla con un redespliegue.
   * - `chat_activity_events` (7 días): rachas y estadísticas. Perderlas
   *   molesta y no rompe nada.
   */
  readonly minDays: number;
  readonly purge: (before: Date, limit: number) => Promise<number>;
}

export interface TargetSummary {
  readonly name: string;
  readonly deleted: number;
  /** Días realmente aplicados, ya pasado el suelo — no los que pidió la
   *  configuración. */
  readonly retentionDays: number;
  /** Quedaban más de los que cabían en este tick. */
  readonly truncated: boolean;
  readonly failed: boolean;
}

export interface RetentionSummary {
  readonly processed: number;
  readonly reverted: number;
  readonly errors: number;
  readonly targets: readonly TargetSummary[];
}

export const MIN_UPDATE_INBOX_DAYS = 2;
export const MIN_AUDIT_LOG_DAYS = 30;
export const MIN_CHAT_ACTIVITY_DAYS = 7;

/** Tope por tabla y por tick, para que el atraso acumulado se vaya por lotes a
 *  lo largo de varios minutos en vez de dar un tirón. */
const MAX_ROWS_PER_RUN = 20_000;
const BATCH = 2_000;

export interface RetentionContext {
  readonly targets: readonly RetentionTarget[];
  readonly now: Date;
  /** Solo para las pruebas: baja el tope de un tick. */
  readonly maxRows?: number;
}

const diasEfectivos = (target: RetentionTarget): number =>
  Math.max(
    target.minDays,
    Math.floor(Number.isFinite(target.days) ? target.days : target.minDays),
  );

export const processRetention = async (
  context: RetentionContext,
): Promise<RetentionSummary> => {
  const tope = context.maxRows ?? MAX_ROWS_PER_RUN;
  const targets: TargetSummary[] = [];

  for (const target of context.targets) {
    const retentionDays = diasEfectivos(target);
    const before = new Date(
      context.now.getTime() - retentionDays * 24 * 60 * 60 * 1000,
    );
    let borradas = 0;
    let failed = false;
    let truncated = false;

    while (borradas < tope) {
      const lote = Math.min(BATCH, tope - borradas);
      let hechas = 0;
      try {
        hechas = await target.purge(before, lote);
      } catch {
        // Un fallo en una tabla no puede llevarse por delante a las otras ni
        // tumbar el tick: dentro de un minuto se vuelve a intentar.
        failed = true;
        break;
      }
      borradas += hechas;
      if (hechas < lote) {
        // Se acabaron las filas viejas.
        break;
      }
      if (borradas >= tope) {
        truncated = true;
      }
    }

    targets.push({
      name: target.name,
      deleted: borradas,
      retentionDays,
      truncated,
      failed,
    });
  }

  const processed = targets.reduce((total, t) => total + t.deleted, 0);
  return {
    processed,
    reverted: processed,
    errors: targets.filter((t) => t.failed).length,
    targets,
  };
};

/** `inbox.retention_cleanup` — solo `update_inbox`. */
export const updateInboxTarget = (
  repo: RetentionRepository,
  days: number,
): RetentionTarget => ({
  name: "update_inbox",
  days,
  minDays: MIN_UPDATE_INBOX_DAYS,
  purge: (before, limit) => repo.purgeUpdateInbox(before, limit),
});

/** `data.retention_cleanup` — la traza de evidencia. */
export const auditLogTarget = (
  repo: RetentionRepository,
  days: number,
): RetentionTarget => ({
  name: "audit_logs",
  days,
  minDays: MIN_AUDIT_LOG_DAYS,
  purge: (before, limit) => repo.purgeAuditLogs(before, limit),
});

/** `data.retention_cleanup` — señales de actividad. */
export const chatActivityTarget = (
  repo: RetentionRepository,
  days: number,
): RetentionTarget => ({
  name: "chat_activity_events",
  days,
  minDays: MIN_CHAT_ACTIVITY_DAYS,
  purge: (before, limit) => repo.purgeChatActivityEvents(before, limit),
});
