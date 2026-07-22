/**
 * Bracket eliminatorio para torneos sociales (memes, equipos, retos). Logica
 * pura y determinista: no hace I/O, ni red, ni Prisma, ni usa Date.now() o
 * Math.random(). Empareja participantes en el orden recibido y, cuando el
 * numero es impar, el ultimo pasa de ronda automaticamente (bye).
 */

/**
 * Marcador del rival ausente en un emparejamiento de bye. Un BracketMatch cuyo
 * campo `b` es igual a BRACKET_BYE representa un pase directo: `a` avanza sin
 * jugar. No colisiona con nombres reales de participantes.
 */
export const BRACKET_BYE = "__BYE__";

/** Emparejamiento de una ronda: `a` contra `b` (o `a` con bye si `b` es BRACKET_BYE). */
export interface BracketMatch {
  readonly a: string;
  readonly b: string;
}

/**
 * Construye los emparejamientos de una ronda a partir de los participantes,
 * respetando su orden: (0,1), (2,3), ... Si el numero es impar, el ultimo
 * participante recibe un bye (BracketMatch con `b === BRACKET_BYE`). Con 0
 * participantes devuelve una lista vacia; con 1 participante devuelve un unico
 * bye. Pura y determinista.
 */
export const buildBracketRound = (
  entrants: readonly string[],
): readonly BracketMatch[] => {
  const matches: BracketMatch[] = [];

  for (let i = 0; i < entrants.length; i += 2) {
    const a = entrants[i];
    if (a === undefined) {
      continue;
    }
    const b = entrants[i + 1];
    matches.push(b === undefined ? { a, b: BRACKET_BYE } : { a, b });
  }

  return matches;
};

/**
 * Avanza el torneo a la siguiente ronda a partir de los ganadores de la ronda
 * previa, emparejandolos en orden igual que buildBracketRound. Con 0 o 1
 * ganadores el torneo esta decidido (campeon o vacio) y devuelve una lista
 * vacia. Pura y determinista.
 */
export const advanceBracket = (
  winners: readonly string[],
): readonly BracketMatch[] => {
  if (winners.length <= 1) {
    return [];
  }
  return buildBracketRound(winners);
};
