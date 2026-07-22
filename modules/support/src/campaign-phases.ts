/**
 * Campanas de anuncios por fases (teaser/anuncio/recordatorio/cierre).
 * Cada fase se programa con un offset en milisegundos relativo al instante del
 * evento: los offsets negativos ocurren antes del evento y los positivos
 * despues. Logica pura y determinista: sin I/O, sin red, sin reloj; recibe
 * `nowMs` e inputs planos.
 */

/** Nombre de fase de una campana de anuncios. */
export type CampaignPhaseName =
  | "teaser"
  | "anuncio"
  | "recordatorio"
  | "cierre";

/** Una fase de campana con su offset (ms) relativo al instante del evento. */
export interface CampaignPhase {
  readonly phase: CampaignPhaseName;
  /** Offset en ms relativo al evento; negativo = antes, positivo = despues. */
  readonly offsetMs: number;
}

/** Una fase ya resuelta a un instante epoch absoluto (ms). */
export interface CampaignSlot {
  readonly phase: CampaignPhaseName;
  readonly whenMs: number;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * Definicion de las fases de una campana, en orden cronologico de offset.
 * teaser: 7 dias antes; anuncio: 1 dia antes; recordatorio: 1 hora antes;
 * cierre: 1 hora despues del evento.
 */
export const CAMPAIGN_PHASES: readonly CampaignPhase[] = [
  { phase: "teaser", offsetMs: -7 * DAY },
  { phase: "anuncio", offsetMs: -1 * DAY },
  { phase: "recordatorio", offsetMs: -1 * HOUR },
  { phase: "cierre", offsetMs: 1 * HOUR },
];

/**
 * Resuelve las fases a instantes epoch absolutos (ms) sumando cada offset al
 * instante del evento. Conserva el orden cronologico de `CAMPAIGN_PHASES`.
 * Puro y determinista.
 */
export const campaignSchedule = (eventMs: number): readonly CampaignSlot[] =>
  CAMPAIGN_PHASES.map((entry) => ({
    phase: entry.phase,
    whenMs: eventMs + entry.offsetMs,
  }));

/**
 * Devuelve la proxima fase cuyo instante es estrictamente futuro respecto a
 * `nowMs` (whenMs > nowMs). Como el schedule esta ordenado cronologicamente,
 * es la primera que cumple la condicion. Devuelve null cuando ya pasaron todas.
 * Puro y determinista.
 */
export const nextCampaignPhase = (
  eventMs: number,
  nowMs: number,
): CampaignSlot | null => {
  for (const slot of campaignSchedule(eventMs)) {
    if (slot.whenMs > nowMs) {
      return slot;
    }
  }
  return null;
};
