/**
 * El Impostor: a todo el grupo le toca la misma palabra menos a uno.
 *
 * Por rondas: cada uno suelta una pista de una palabra en el chat, luego se
 * vota, y el mas votado se va. Si cae el impostor gana el grupo; si el
 * impostor aguanta hasta quedar dos, gana el impostor.
 *
 * La palabra del impostor NO es "ninguna": recibe una parecida (playa/piscina).
 * Con las manos vacias se le nota enseguida —no puede decir nada concreto— y
 * la partida se acaba en la primera ronda. Con una palabra vecina puede
 * mentir con algo, y el juego consiste justo en eso.
 *
 * Puro: sin E/S, sin reloj, sin azar propio. El barajado va por semilla.
 */

import { makeRng, shuffle } from "./seeded-shuffle.js";

/** Menos de cuatro no hay juego: al impostor se le ve en una ronda. */
export const MIN_PLAYERS = 4;
/** Mas de doce y la ronda de pistas es ilegible en un chat. */
export const MAX_PLAYERS = 12;

/** Un par de palabras vecinas: la del grupo y la del impostor. */
export interface WordPair {
  readonly crew: string;
  readonly impostor: string;
}

export type Role = "crew" | "impostor";

/** Lo que solo puede ver una persona. Va a `GameMatchPlayer.secret`. */
export interface PlayerSecret {
  readonly role: Role;
  readonly word: string;
}

export type Phase = "clues" | "voting" | "finished";

export interface ImpostorState {
  readonly phase: Phase;
  readonly round: number;
  /** Quien es, para poder resolver. Nunca sale de aqui hacia el chat. */
  readonly impostorId: string;
  /** Pistas de la ronda en curso: jugador -> palabra. */
  readonly clues: Readonly<Record<string, string>>;
  /** Votos de la ronda en curso: votante -> votado. */
  readonly votes: Readonly<Record<string, string>>;
  /** Quien ha caido, en orden. */
  readonly eliminated: readonly string[];
  readonly result: "crew" | "impostor" | null;
}

/**
 * Reparte roles y devuelve el secreto de cada uno.
 *
 * El impostor se elige barajando la lista entera y cogiendo al primero, en vez
 * de sacar un indice suelto: asi el sesgo del generador, si lo tuviera, no se
 * concentra en un asiento concreto.
 */
export const dealRoles = (
  playerIds: readonly string[],
  pair: WordPair,
  seed: number,
): {
  readonly state: ImpostorState;
  readonly secrets: ReadonlyMap<string, PlayerSecret>;
} | null => {
  if (playerIds.length < MIN_PLAYERS || playerIds.length > MAX_PLAYERS) {
    return null;
  }
  const unicos = [...new Set(playerIds)];
  if (unicos.length !== playerIds.length) {
    return null;
  }

  const rng = makeRng(seed);
  const barajados = shuffle(unicos, rng);
  const impostorId = barajados[0] as string;

  const secrets = new Map<string, PlayerSecret>();
  for (const id of unicos) {
    secrets.set(
      id,
      id === impostorId
        ? { role: "impostor", word: pair.impostor }
        : { role: "crew", word: pair.crew },
    );
  }

  return {
    state: {
      phase: "clues",
      round: 1,
      impostorId,
      clues: {},
      votes: {},
      eliminated: [],
      result: null,
    },
    secrets,
  };
};

/** Quien sigue en juego, en el orden de asientos que le den. */
export const aliveOf = (
  state: ImpostorState,
  playerIds: readonly string[],
): readonly string[] =>
  playerIds.filter((id) => !state.eliminated.includes(id));

export type ClueError =
  | "not-playing"
  | "wrong-phase"
  | "already-said"
  | "empty"
  | "too-many-words"
  | "gives-it-away";

export type ClueResult =
  | {
      readonly ok: true;
      readonly state: ImpostorState;
      readonly complete: boolean;
    }
  | { readonly ok: false; readonly error: ClueError };

/** Una pista es UNA palabra. Una frase permite describir la palabra entera. */
const isSingleWord = (text: string): boolean =>
  text.trim().split(/\s+/u).length === 1;

/**
 * Apunta la pista de alguien.
 *
 * Se rechaza la pista que ES la palabra secreta. Decirla en voz alta no es una
 * jugada astuta: le regala al impostor exactamente lo que le falta, y a partir
 * de ahi la partida es un trámite.
 */
export const submitClue = (
  state: ImpostorState,
  playerId: string,
  clue: string,
  alive: readonly string[],
  secretWord: string,
): ClueResult => {
  if (state.phase !== "clues") {
    return { ok: false, error: "wrong-phase" };
  }
  if (!alive.includes(playerId)) {
    return { ok: false, error: "not-playing" };
  }
  if (playerId in state.clues) {
    return { ok: false, error: "already-said" };
  }
  const limpia = clue.trim();
  if (limpia.length === 0) {
    return { ok: false, error: "empty" };
  }
  if (!isSingleWord(limpia)) {
    return { ok: false, error: "too-many-words" };
  }
  if (limpia.toLowerCase() === secretWord.trim().toLowerCase()) {
    return { ok: false, error: "gives-it-away" };
  }

  const clues = { ...state.clues, [playerId]: limpia };
  const complete = alive.every((id) => id in clues);
  return {
    ok: true,
    state: { ...state, clues, phase: complete ? "voting" : "clues" },
    complete,
  };
};

export type VoteError =
  | "not-playing"
  | "wrong-phase"
  | "already-voted"
  | "target-not-playing"
  | "self-vote";

export type VoteResult =
  | {
      readonly ok: true;
      readonly state: ImpostorState;
      readonly complete: boolean;
    }
  | { readonly ok: false; readonly error: VoteError };

/**
 * Apunta un voto.
 *
 * Votarse a uno mismo se rechaza: no es una jugada, es la forma de saltarse la
 * ronda sin señalar a nadie, y si lo hacen varios el juego deja de avanzar.
 */
export const submitVote = (
  state: ImpostorState,
  voterId: string,
  targetId: string,
  alive: readonly string[],
): VoteResult => {
  if (state.phase !== "voting") {
    return { ok: false, error: "wrong-phase" };
  }
  if (!alive.includes(voterId)) {
    return { ok: false, error: "not-playing" };
  }
  if (!alive.includes(targetId)) {
    return { ok: false, error: "target-not-playing" };
  }
  if (voterId === targetId) {
    return { ok: false, error: "self-vote" };
  }
  if (voterId in state.votes) {
    return { ok: false, error: "already-voted" };
  }

  const votes = { ...state.votes, [voterId]: targetId };
  const complete = alive.every((id) => id in votes);
  return { ok: true, state: { ...state, votes }, complete };
};

export interface Tally {
  readonly counts: Readonly<Record<string, number>>;
  /** Quien se va, o null si hubo empate arriba. */
  readonly eliminated: string | null;
  readonly tied: readonly string[];
}

/**
 * Cuenta los votos.
 *
 * El empate NO se desempata por sorteo ni por orden de llegada: no se va
 * nadie. Sacar a alguien por azar convierte la unica decision del grupo en una
 * moneda al aire, y al impostor le basta con provocar empates para sobrevivir
 * gratis.
 */
export const tallyVotes = (state: ImpostorState): Tally => {
  const counts: Record<string, number> = {};
  for (const target of Object.values(state.votes)) {
    counts[target] = (counts[target] ?? 0) + 1;
  }
  const maximo = Math.max(0, ...Object.values(counts));
  const tied = Object.entries(counts)
    .filter(([, n]) => n === maximo && maximo > 0)
    .map(([id]) => id)
    .sort();
  return {
    counts,
    eliminated: tied.length === 1 ? (tied[0] as string) : null,
    tied,
  };
};

export interface RoundOutcome {
  readonly state: ImpostorState;
  readonly tally: Tally;
  /** Qué contar en el chat cuando acaba la ronda. */
  readonly finished: boolean;
}

/**
 * Cierra la ronda: cuenta, elimina y decide si sigue.
 *
 * El grupo gana en cuanto cae el impostor. El impostor gana cuando quedan dos
 * personas y sigue dentro — a esas alturas la votacion es uno contra uno y ya
 * no puede perderla salvo por suerte.
 */
export const closeRound = (
  state: ImpostorState,
  alive: readonly string[],
): RoundOutcome => {
  const tally = tallyVotes(state);

  if (tally.eliminated === null) {
    // Empate: nadie se va, ronda nueva con las pistas y los votos limpios.
    return {
      state: {
        ...state,
        phase: "clues",
        round: state.round + 1,
        clues: {},
        votes: {},
      },
      tally,
      finished: false,
    };
  }

  const eliminated = [...state.eliminated, tally.eliminated];
  if (tally.eliminated === state.impostorId) {
    return {
      state: { ...state, phase: "finished", eliminated, result: "crew" },
      tally,
      finished: true,
    };
  }

  const quedan = alive.filter((id) => id !== tally.eliminated);
  if (quedan.length <= 2) {
    return {
      state: { ...state, phase: "finished", eliminated, result: "impostor" },
      tally,
      finished: true,
    };
  }

  return {
    state: {
      ...state,
      phase: "clues",
      round: state.round + 1,
      clues: {},
      votes: {},
      eliminated,
    },
    tally,
    finished: false,
  };
};

/** Abandonar a mitad cuenta como eliminado, y puede decidir la partida. */
export const leaveMatch = (
  state: ImpostorState,
  playerId: string,
  alive: readonly string[],
): ImpostorState => {
  if (state.phase === "finished" || !alive.includes(playerId)) {
    return state;
  }
  const eliminated = [...state.eliminated, playerId];
  // Si el que se va era el impostor, el grupo gana igual: irse no es una
  // salida. Si no, el resto sigue mientras queden mas de dos.
  if (playerId === state.impostorId) {
    return { ...state, phase: "finished", eliminated, result: "crew" };
  }
  const quedan = alive.filter((id) => id !== playerId);
  if (quedan.length <= 2) {
    return { ...state, phase: "finished", eliminated, result: "impostor" };
  }
  // Sus pistas y su voto se van con él, o la ronda no cerraria nunca: se
  // estaria esperando a alguien que ya no está.
  const clues = { ...state.clues };
  const votes = { ...state.votes };
  delete clues[playerId];
  delete votes[playerId];
  return { ...state, eliminated, clues, votes };
};

/** Valida un estado venido de la base de datos antes de fiarse de el. */
export const isValidImpostorState = (
  value: unknown,
): value is ImpostorState => {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const raw = value as Record<string, unknown>;
  return (
    (raw.phase === "clues" ||
      raw.phase === "voting" ||
      raw.phase === "finished") &&
    typeof raw.round === "number" &&
    Number.isInteger(raw.round) &&
    raw.round >= 1 &&
    typeof raw.impostorId === "string" &&
    raw.impostorId.length > 0 &&
    typeof raw.clues === "object" &&
    raw.clues !== null &&
    typeof raw.votes === "object" &&
    raw.votes !== null &&
    Array.isArray(raw.eliminated) &&
    raw.eliminated.every((id) => typeof id === "string")
  );
};

/**
 * Parejas de palabras vecinas.
 *
 * Vecinas de verdad: playa/piscina comparten bañador, agua y verano, asi que
 * el impostor puede decir "toalla" sin delatarse. Si fueran playa/tornillo la
 * primera pista lo dejaria fuera y no habria juego.
 */
export const WORD_PAIRS: readonly WordPair[] = [
  { crew: "playa", impostor: "piscina" },
  { crew: "cafe", impostor: "te" },
  { crew: "futbol", impostor: "baloncesto" },
  { crew: "cine", impostor: "teatro" },
  { crew: "pizza", impostor: "hamburguesa" },
  { crew: "invierno", impostor: "otoño" },
  { crew: "perro", impostor: "gato" },
  { crew: "guitarra", impostor: "piano" },
  { crew: "avion", impostor: "tren" },
  { crew: "medico", impostor: "enfermero" },
  { crew: "montaña", impostor: "bosque" },
  { crew: "movil", impostor: "tablet" },
  { crew: "boda", impostor: "cumpleaños" },
  { crew: "hotel", impostor: "camping" },
  { crew: "profesor", impostor: "entrenador" },
  { crew: "supermercado", impostor: "mercado" },
  { crew: "nieve", impostor: "lluvia" },
  { crew: "vino", impostor: "cerveza" },
  { crew: "biblioteca", impostor: "libreria" },
  { crew: "coche", impostor: "moto" },
];
