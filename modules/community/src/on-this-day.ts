/**
 * Modo nostalgia: "hace 1 anio en este grupo paso...". Dado un banco de eventos
 * historicos con marca de tiempo, encuentra los que ocurrieron el mismo dia y
 * mes que hoy pero en anios anteriores, y construye el texto que ve el usuario.
 *
 * Logica pura y determinista: no hay I/O, red ni Date.now(); el llamador aporta
 * `nowMs` (epoch en ms) y el desfase horario del grupo, de modo que el calendario
 * se calcula siempre igual con independencia de la zona del runtime.
 */

/** Un evento memorable del grupo. `ms` es el epoch (ms) en que ocurrio. */
export interface HistoryEvent {
  readonly ms: number;
  readonly summary: string;
}

const MINUTE_MS = 60_000;

interface LocalParts {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

/**
 * Descompone un epoch (ms) en anio/mes/dia segun la hora local del grupo.
 * `tzOffsetMin` es el desfase en minutos al este de UTC (p. ej. +60 = UTC+1,
 * -300 = UTC-5). Se usan getUTC* sobre el instante ya desplazado para que el
 * resultado no dependa de la zona del proceso.
 */
const toLocalParts = (ms: number, tzOffsetMin: number): LocalParts => {
  const shifted = new Date(ms + tzOffsetMin * MINUTE_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
  };
};

/**
 * Devuelve los eventos cuyo dia y mes (en hora local del grupo) coinciden con
 * los de hoy, pero de anios estrictamente anteriores al actual. Conserva el
 * orden de `events`. Pura y determinista.
 */
export const findOnThisDay = (
  events: readonly HistoryEvent[],
  nowMs: number,
  tzOffsetMin: number,
): readonly HistoryEvent[] => {
  const today = toLocalParts(nowMs, tzOffsetMin);

  return events.filter((event) => {
    const when = toLocalParts(event.ms, tzOffsetMin);
    return (
      when.month === today.month &&
      when.day === today.day &&
      when.year < today.year
    );
  });
};

/**
 * Etiqueta "hace N anio(s)" con acentos correctos, singular para 1. Se
 * considera user-facing. Los valores <= 0 se tratan como "hoy".
 */
const yearsAgoLabel = (years: number): string => {
  if (years <= 0) {
    return "hoy mismo";
  }
  return years === 1 ? "hace 1 año" : `hace ${years} años`;
};

/**
 * Construye el mensaje de nostalgia que ve el usuario en el chat. Sin eventos
 * devuelve un aviso amable; con eventos, una linea por recuerdo con los anios
 * transcurridos (calculados en UTC contra `nowMs`). Conserva el orden recibido.
 * Pura y determinista.
 */
export const formatNostalgia = (
  events: readonly HistoryEvent[],
  nowMs: number,
): string => {
  if (events.length === 0) {
    return "🕰️ Un día como hoy... pero todavía no hay recuerdos que rememorar.";
  }

  const nowYear = new Date(nowMs).getUTCFullYear();

  const lines = events.map((event) => {
    const years = nowYear - new Date(event.ms).getUTCFullYear();
    return `• ${yearsAgoLabel(years)}: ${event.summary}`;
  });

  return `🕰️ Un día como hoy en este grupo...\n${lines.join("\n")}`;
};
