/**
 * Deteccion de "borrado de pruebas": un usuario envia un mensaje provocativo y,
 * poco despues, borra uno de sus propios mensajes para no dejar rastro. Logica
 * pura y determinista: recibe una lista plana de eventos con marcas de tiempo
 * (ms) provistas por el llamador; sin I/O, red, ni relojes internos.
 *
 * Un evento describe una accion propia del usuario: un mensaje (con flag de si
 * era provocativo) o un borrado. Se considera sospechoso cuando existe un
 * mensaje provocativo seguido de un borrado propio ocurrido en menos de
 * `quickMs` milisegundos.
 */

export interface EvidenceEvent {
  readonly kind: "message" | "delete";
  readonly ms: number;
  readonly provocative: boolean;
}

export interface EvidenceDeletionResult {
  readonly suspicious: boolean;
  readonly reason: string;
}

const EVIDENCE_NO_PATTERN_REASON =
  "Sin borrado rápido de mensajes provocativos";

/**
 * True cuando un mensaje provocativo va seguido de un borrado propio en menos de
 * `quickMs` ms. El emparejamiento tolera listas desordenadas: para cada borrado
 * busca el mensaje provocativo previo (o simultaneo) con menor separacion. La
 * separacion debe ser no negativa (el borrado no puede preceder al mensaje) y
 * estrictamente menor que `quickMs`. Un `quickMs` no positivo nunca es
 * sospechoso. El flag `provocative` de los eventos de borrado se ignora: solo
 * los mensajes disparan la deteccion. Puro y determinista.
 */
export const detectEvidenceDeletion = (
  events: readonly EvidenceEvent[],
  quickMs: number,
): EvidenceDeletionResult => {
  if (quickMs <= 0) {
    return { suspicious: false, reason: EVIDENCE_NO_PATTERN_REASON };
  }

  let bestGap: number | null = null;

  for (const del of events) {
    if (del.kind !== "delete") {
      continue;
    }
    for (const msg of events) {
      if (msg.kind !== "message" || !msg.provocative) {
        continue;
      }
      const gap = del.ms - msg.ms;
      if (gap >= 0 && gap < quickMs && (bestGap === null || gap < bestGap)) {
        bestGap = gap;
      }
    }
  }

  if (bestGap === null) {
    return { suspicious: false, reason: EVIDENCE_NO_PATTERN_REASON };
  }

  return {
    suspicious: true,
    reason: `Borró un mensaje provocativo ${bestGap}ms después de enviarlo`,
  };
};
