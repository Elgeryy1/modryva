/**
 * Digest "esto paso mientras no estabas": resume los eventos ocurridos en una
 * ventana temporal para mostrarselos a alguien que vuelve a un grupo. Logica
 * pura y determinista: recibe los eventos y el rango por parametro y no toca
 * red, reloj ni almacenamiento. Igual que afk.ts / char-filters.ts.
 */

/** Un evento registrable del digest. `ms` es el timestamp epoch en milisegundos. */
export interface DigestEvent {
  readonly ms: number;
  readonly type: string;
  readonly summary: string;
}

/** Resultado del digest construido para el rango solicitado. */
export interface ReturnDigestResult {
  /** Numero de eventos por `type`, solo tipos con al menos uno. */
  readonly counts: Record<string, number>;
  /** Total de eventos dentro del rango. */
  readonly total: number;
  /** Resumenes destacados, del mas reciente al mas antiguo. */
  readonly highlights: readonly string[];
  /** Texto en espanol listo para enviar. */
  readonly text: string;
}

/** Maximo de resumenes destacados incluidos en el digest. */
export const RETURN_DIGEST_MAX_HIGHLIGHTS = 5;

/** Mensaje usado cuando no hay eventos dentro del rango. */
export const RETURN_DIGEST_EMPTY_TEXT = "Sin novedades mientras no estabas.";

/**
 * Devuelve los eventos cuyo `ms` cae en el rango cerrado [sinceMs, untilMs].
 * Si el rango esta invertido (sinceMs > untilMs) no hay eventos. Preserva el
 * orden original de `events`. Pura y determinista.
 */
export const filterDigestEventsInRange = (
  events: readonly DigestEvent[],
  sinceMs: number,
  untilMs: number,
): readonly DigestEvent[] => {
  if (sinceMs > untilMs) {
    return [];
  }
  return events.filter((event) => event.ms >= sinceMs && event.ms <= untilMs);
};

/**
 * Cuenta los eventos por `type`. Solo aparecen los tipos con al menos un
 * evento. El orden de las claves sigue la primera aparicion en `events`.
 * Pura y determinista.
 */
export const countDigestEventsByType = (
  events: readonly DigestEvent[],
): Record<string, number> => {
  const counts: Record<string, number> = {};
  for (const event of events) {
    counts[event.type] = (counts[event.type] ?? 0) + 1;
  }
  return counts;
};

/**
 * Selecciona los resumenes destacados: los eventos mas recientes primero
 * (mayor `ms`), limitados a `limit`. Los empates de `ms` conservan el orden de
 * entrada (orden estable). Pura y determinista.
 */
export const selectDigestHighlights = (
  events: readonly DigestEvent[],
  limit: number = RETURN_DIGEST_MAX_HIGHLIGHTS,
): readonly string[] => {
  if (limit <= 0) {
    return [];
  }
  return events
    .map((event, index) => ({ event, index }))
    .sort((a, b) => b.event.ms - a.event.ms || a.index - b.index)
    .slice(0, limit)
    .map(({ event }) => event.summary);
};

/**
 * Construye el digest completo para el rango cerrado [sinceMs, untilMs]:
 * filtra, agrupa por tipo, elige los destacados mas recientes y arma el texto
 * en espanol. Sin eventos devuelve un mensaje "sin novedades". Pura y
 * determinista: no usa Date.now() ni aleatoriedad.
 */
export const buildReturnDigest = (
  events: readonly DigestEvent[],
  sinceMs: number,
  untilMs: number,
): ReturnDigestResult => {
  const inRange = filterDigestEventsInRange(events, sinceMs, untilMs);
  const counts = countDigestEventsByType(inRange);
  const total = inRange.length;
  const highlights = selectDigestHighlights(inRange);

  if (total === 0) {
    return { counts, total, highlights, text: RETURN_DIGEST_EMPTY_TEXT };
  }

  const header =
    total === 1
      ? "Mientras no estabas paso 1 cosa:"
      : `Mientras no estabas pasaron ${total} cosas:`;

  const byTypeLines = Object.entries(counts).map(
    ([type, count]) => `- ${type}: ${count}`,
  );

  const highlightLines = highlights.map((summary) => `- ${summary}`);

  const sections = [header, ...byTypeLines];
  if (highlightLines.length > 0) {
    sections.push("Destacados:", ...highlightLines);
  }

  return { counts, total, highlights, text: sections.join("\n") };
};
