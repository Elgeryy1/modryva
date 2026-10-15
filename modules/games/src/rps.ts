/**
 * Piedra, papel o tijera al mejor de N.
 *
 * El unico problema de verdad de este juego en un chat es que las dos tiradas
 * no son simultaneas: alguien pulsa primero. Si la eleccion del primero se
 * pudiera leer, el segundo gana siempre. Por eso el estado guarda las dos
 * tiradas de la ronda en curso y `publicRound` NO las devuelve hasta que hay
 * las dos; lo que se ve mientras tanto es "ya ha tirado", nada mas.
 *
 * Puro: sin E/S, sin reloj, sin azar.
 */

export type Throw = "piedra" | "papel" | "tijera";
export const THROWS: readonly Throw[] = ["piedra", "papel", "tijera"];

export type Seat = "host" | "guest";

/** Que le gana a que. */
const BEATS: Readonly<Record<Throw, Throw>> = {
  piedra: "tijera",
  papel: "piedra",
  tijera: "papel",
};

export const EMOJI: Readonly<Record<Throw, string>> = {
  piedra: "🪨",
  papel: "📄",
  tijera: "✂️",
};

export const parseThrow = (raw: string): Throw | null => {
  const t = raw.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/gu, "");
  if (t === "piedra" || t === "🪨") {
    return "piedra";
  }
  if (t === "papel" || t === "📄") {
    return "papel";
  }
  if (t === "tijera" || t === "tijeras" || t === "✂️" || t === "✂") {
    return "tijera";
  }
  return null;
};

export interface RpsState {
  /** Rondas que hay que ganar. 2 = al mejor de 3. */
  readonly target: number;
  readonly hostWins: number;
  readonly guestWins: number;
  readonly round: number;
  /** Tiradas de la ronda en curso. Null = todavia no ha tirado. */
  readonly hostThrow: Throw | null;
  readonly guestThrow: Throw | null;
  /** Rondas ya jugadas, para poder contarlas al final. */
  readonly history: readonly {
    readonly host: Throw;
    readonly guest: Throw;
    readonly winner: Seat | null;
  }[];
  readonly finished: boolean;
  readonly result: "host" | "guest" | null;
}

/** Al mejor de tres por defecto: en un chat, más se hace largo. */
export const startRps = (target = 2): RpsState => ({
  target: Math.max(1, Math.floor(target)),
  hostWins: 0,
  guestWins: 0,
  round: 1,
  hostThrow: null,
  guestThrow: null,
  history: [],
  finished: false,
  result: null,
});

export const winnerOf = (host: Throw, guest: Throw): Seat | null => {
  if (host === guest) {
    return null;
  }
  return BEATS[host] === guest ? "host" : "guest";
};

export type ThrowError = "match-over" | "already-thrown";

export type ThrowResult =
  | {
      readonly ok: true;
      readonly state: RpsState;
      /** Cierto solo cuando esa tirada completo la ronda. */
      readonly roundResolved: boolean;
      readonly roundWinner: Seat | null;
    }
  | { readonly ok: false; readonly error: ThrowError };

/**
 * Apunta la tirada de un asiento.
 *
 * No se puede cambiar una tirada ya hecha. Parece una comodidad inofensiva,
 * pero permite esperar a ver el resultado y rectificar: quien tira segundo
 * veria la ronda resolverse y podria pedir otra antes de que se apunte.
 */
export const submitThrow = (
  state: RpsState,
  seat: Seat,
  value: Throw,
): ThrowResult => {
  if (state.finished) {
    return { ok: false, error: "match-over" };
  }
  const ya = seat === "host" ? state.hostThrow : state.guestThrow;
  if (ya !== null) {
    return { ok: false, error: "already-thrown" };
  }

  const hostThrow = seat === "host" ? value : state.hostThrow;
  const guestThrow = seat === "guest" ? value : state.guestThrow;

  if (hostThrow === null || guestThrow === null) {
    // Falta el otro: se guarda y no se cuenta nada todavia.
    return {
      ok: true,
      state: { ...state, hostThrow, guestThrow },
      roundResolved: false,
      roundWinner: null,
    };
  }

  const roundWinner = winnerOf(hostThrow, guestThrow);
  const hostWins = state.hostWins + (roundWinner === "host" ? 1 : 0);
  const guestWins = state.guestWins + (roundWinner === "guest" ? 1 : 0);
  const history = [
    ...state.history,
    { host: hostThrow, guest: guestThrow, winner: roundWinner },
  ];

  const finished = hostWins >= state.target || guestWins >= state.target;
  return {
    ok: true,
    state: {
      ...state,
      hostWins,
      guestWins,
      history,
      // El empate NO gasta ronda: se repite. Contar un empate como ronda
      // jugada hace que un "mejor de 3" se decida con una sola victoria.
      round: roundWinner === null ? state.round : state.round + 1,
      hostThrow: null,
      guestThrow: null,
      finished,
      result: finished ? (hostWins > guestWins ? "host" : "guest") : null,
    },
    roundResolved: true,
    roundWinner,
  };
};

/** Lo que puede ver el chat de la ronda en curso. */
export interface PublicRound {
  readonly round: number;
  readonly hostReady: boolean;
  readonly guestReady: boolean;
  readonly hostWins: number;
  readonly guestWins: number;
  readonly target: number;
  /** Solo cuando ya han tirado los dos y la ronda esta resuelta. */
  readonly reveal: {
    readonly host: Throw;
    readonly guest: Throw;
    readonly winner: Seat | null;
  } | null;
}

/**
 * Lo unico que sale al chat mientras la ronda esta abierta.
 *
 * Nunca la tirada de quien fue primero: con eso, el segundo gana siempre. Solo
 * "ya ha tirado". Lo que se enseña al terminar sale de `history`, no del estado
 * en curso, que a esas alturas ya se limpio.
 */
export const publicRound = (state: RpsState): PublicRound => {
  const ultima = state.history[state.history.length - 1];
  const ambos = state.hostThrow !== null && state.guestThrow !== null;
  return {
    round: state.round,
    hostReady: state.hostThrow !== null,
    guestReady: state.guestThrow !== null,
    hostWins: state.hostWins,
    guestWins: state.guestWins,
    target: state.target,
    reveal: !ambos && ultima ? ultima : null,
  };
};

/** Marcador para el chat. */
export const renderScore = (
  state: RpsState,
  hostName: string,
  guestName: string,
): string =>
  `${hostName} ${state.hostWins} — ${state.guestWins} ${guestName}  (a ${state.target})`;

/** Abandonar da la partida al otro: irse no es empatar. */
export const forfeit = (state: RpsState, seat: Seat): RpsState =>
  state.finished
    ? state
    : {
        ...state,
        finished: true,
        result: seat === "host" ? "guest" : "host",
      };

/** Valida un estado venido de la base de datos antes de fiarse de el. */
export const isValidRpsState = (value: unknown): value is RpsState => {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const raw = value as Record<string, unknown>;
  const tiradaValida = (v: unknown) =>
    v === null || (typeof v === "string" && THROWS.includes(v as Throw));
  return (
    typeof raw.target === "number" &&
    raw.target >= 1 &&
    typeof raw.hostWins === "number" &&
    raw.hostWins >= 0 &&
    typeof raw.guestWins === "number" &&
    raw.guestWins >= 0 &&
    typeof raw.round === "number" &&
    raw.round >= 1 &&
    tiradaValida(raw.hostThrow) &&
    tiradaValida(raw.guestThrow) &&
    Array.isArray(raw.history) &&
    typeof raw.finished === "boolean"
  );
};
