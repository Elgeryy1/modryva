/**
 * Cartas de colores: el clasico de tirar carta del mismo color o del mismo
 * numero hasta quedarte sin mano.
 *
 * Las cartas se codifican como texto corto ("R5", "Gs", "W4") en vez de como
 * objetos. Viajan a JSON y vuelven sin ceremonia, una mano entera cabe en un
 * renglon del log, y comparar dos cartas es comparar dos cadenas.
 *
 * La mano de cada uno vive aparte del estado publico: ver `splitState`. El
 * modulo trabaja con todo junto porque una funcion pura necesita la partida
 * entera para decidir, pero lo que se guarda va separado a proposito.
 *
 * Puro: sin E/S, sin reloj, sin azar propio. El barajado va por semilla.
 */

import { makeRng, shuffle } from "./seeded-shuffle.js";

export const MIN_PLAYERS = 2;
/** Con mas de diez la baraja se queda corta y el turno no vuelve nunca. */
export const MAX_PLAYERS = 10;
export const HAND_SIZE = 7;

export type Color = "R" | "Y" | "G" | "B";
export const COLORS: readonly Color[] = ["R", "Y", "G", "B"];

/**
 * Una carta: color + figura, o comodin.
 *
 *   "R5"  numero              "Rs" salta
 *   "Rr"  cambio de sentido   "Rd" roba dos
 *   "W"   comodin             "W4" comodin roba cuatro
 */
export type Card = string;

export const COLOR_NAMES: Readonly<Record<Color, string>> = {
  R: "rojo",
  Y: "amarillo",
  G: "verde",
  B: "azul",
};

export const isWild = (card: Card): boolean => card === "W" || card === "W4";

export const colorOf = (card: Card): Color | null =>
  isWild(card) ? null : ((card[0] ?? null) as Color | null);

/** La figura sin el color: "5", "s", "r", "d", o el comodin entero. */
export const faceOf = (card: Card): string =>
  isWild(card) ? card : card.slice(1);

/**
 * La baraja completa.
 *
 * Un cero por color y dos de cada del resto, como la de carton. Los dobles
 * importan: con un solo "salta" por color la figura casi no aparece y el juego
 * se queda en tirar numeros.
 */
export const buildDeck = (): Card[] => {
  const deck: Card[] = [];
  for (const c of COLORS) {
    deck.push(`${c}0`);
    for (let n = 1; n <= 9; n += 1) {
      deck.push(`${c}${n}`, `${c}${n}`);
    }
    for (const figura of ["s", "r", "d"]) {
      deck.push(`${c}${figura}`, `${c}${figura}`);
    }
  }
  for (let i = 0; i < 4; i += 1) {
    deck.push("W", "W4");
  }
  return deck;
};

export interface ColorCardsState {
  /** Manos por asiento. Se guarda aparte; ver `splitState`. */
  readonly hands: Readonly<Record<number, readonly Card[]>>;
  /** Monton de robar, boca abajo. */
  readonly deck: readonly Card[];
  /** Lo tirado; la ultima es la que manda. */
  readonly discard: readonly Card[];
  /**
   * El color que hay que seguir. Sale de la ultima carta salvo cuando fue un
   * comodin, y por eso se guarda: la carta no lo dice.
   */
  readonly activeColor: Color;
  readonly turnSeat: number;
  /** 1 o -1. Lo cambia el "cambio de sentido". */
  readonly direction: 1 | -1;
  /** Cartas que le caen al siguiente por los +2 y +4 encadenados. */
  readonly pendingDraw: number;
  readonly seats: readonly number[];
  readonly finished: boolean;
  /** El asiento que gano, o null. */
  readonly winner: number | null;
}

/**
 * Reparte y deja la partida lista para la primera tirada.
 *
 * La primera carta del monton no puede ser un comodin ni un +4: habria que
 * decidir el color antes de que nadie haya jugado, y no hay a quien
 * preguntarle. Se entierra y se coge la siguiente.
 */
export const startGame = (
  seats: readonly number[],
  seed: number,
): ColorCardsState | null => {
  if (seats.length < MIN_PLAYERS || seats.length > MAX_PLAYERS) {
    return null;
  }
  if (new Set(seats).size !== seats.length) {
    return null;
  }

  const rng = makeRng(seed);
  const baraja = shuffle(buildDeck(), rng);

  const hands: Record<number, Card[]> = {};
  let cursor = 0;
  for (const seat of seats) {
    hands[seat] = baraja.slice(cursor, cursor + HAND_SIZE);
    cursor += HAND_SIZE;
  }

  // Primera carta jugable: se saltan los comodines.
  let inicial = baraja[cursor] as Card;
  cursor += 1;
  while (isWild(inicial) && cursor < baraja.length) {
    inicial = baraja[cursor] as Card;
    cursor += 1;
  }

  const resto = baraja.slice(cursor);
  const color = colorOf(inicial);
  if (!color) {
    return null;
  }

  // Si la primera es una figura, su efecto NO se aplica: castigar al primero
  // por el orden del reparto es empezar con una injusticia gratis.
  return {
    hands,
    deck: resto,
    discard: [inicial],
    activeColor: color,
    turnSeat: seats[0] as number,
    direction: 1,
    pendingDraw: 0,
    seats,
    finished: false,
    winner: null,
  };
};

export const topCard = (state: ColorCardsState): Card =>
  state.discard[state.discard.length - 1] as Card;

/**
 * Si esa carta se puede tirar ahora.
 *
 * Con un castigo pendiente (+2 o +4 sin recoger) solo vale encadenar con la
 * MISMA figura. Dejar que un +2 tape un +4 haria que el castigo grande no
 * valiese mas que el pequeño, y encadenar seria siempre gratis.
 */
export const isPlayable = (state: ColorCardsState, card: Card): boolean => {
  const arriba = topCard(state);
  if (state.pendingDraw > 0) {
    return (
      faceOf(card) === faceOf(arriba) && (card === "W4" || faceOf(card) === "d")
    );
  }
  if (isWild(card)) {
    return true;
  }
  return colorOf(card) === state.activeColor || faceOf(card) === faceOf(arriba);
};

/** Las cartas de una mano que se pueden tirar ahora mismo. */
export const playableCards = (
  state: ColorCardsState,
  seat: number,
): readonly Card[] =>
  (state.hands[seat] ?? []).filter((c) => isPlayable(state, c));

/** El asiento que va despues, contando el sentido y los saltos. */
export const nextSeat = (
  state: ColorCardsState,
  from: number,
  steps = 1,
): number => {
  const i = state.seats.indexOf(from);
  if (i < 0) {
    return state.seats[0] as number;
  }
  const n = state.seats.length;
  const j = (((i + state.direction * steps) % n) + n) % n;
  return state.seats[j] as number;
};

export type PlayError =
  | "not-your-turn"
  | "match-over"
  | "not-in-hand"
  | "not-playable"
  | "color-required"
  | "bad-color";

export type PlayResult =
  | { readonly ok: true; readonly state: ColorCardsState }
  | { readonly ok: false; readonly error: PlayError };

/**
 * Tira una carta.
 *
 * `chosenColor` solo se usa con comodin, y es obligatorio: dejar que el
 * servidor lo elija por su cuenta convierte la mejor carta del juego en una
 * tirada al azar.
 */
export const playCard = (
  state: ColorCardsState,
  seat: number,
  card: Card,
  chosenColor?: Color,
): PlayResult => {
  if (state.finished) {
    return { ok: false, error: "match-over" };
  }
  if (state.turnSeat !== seat) {
    return { ok: false, error: "not-your-turn" };
  }
  const mano = state.hands[seat] ?? [];
  const pos = mano.indexOf(card);
  if (pos < 0) {
    return { ok: false, error: "not-in-hand" };
  }
  if (!isPlayable(state, card)) {
    return { ok: false, error: "not-playable" };
  }
  if (isWild(card)) {
    if (!chosenColor) {
      return { ok: false, error: "color-required" };
    }
    if (!COLORS.includes(chosenColor)) {
      return { ok: false, error: "bad-color" };
    }
  }

  const restante = [...mano.slice(0, pos), ...mano.slice(pos + 1)];
  const hands = { ...state.hands, [seat]: restante };
  const discard = [...state.discard, card];
  const activeColor = isWild(card)
    ? (chosenColor as Color)
    : (colorOf(card) as Color);

  if (restante.length === 0) {
    return {
      ok: true,
      state: {
        ...state,
        hands,
        discard,
        activeColor,
        finished: true,
        winner: seat,
      },
    };
  }

  const figura = faceOf(card);
  const base: ColorCardsState = { ...state, hands, discard, activeColor };

  if (figura === "r") {
    // Con dos jugadores el cambio de sentido devuelve el turno a quien tiro,
    // igual que un salta. Es lo que hace la carta de carton, y sin esto sería
    // una carta que no hace absolutamente nada en la mesa mas comun.
    const girado: ColorCardsState = {
      ...base,
      direction: (base.direction * -1) as 1 | -1,
    };
    return {
      ok: true,
      state: {
        ...girado,
        turnSeat: state.seats.length === 2 ? seat : nextSeat(girado, seat),
      },
    };
  }

  if (figura === "s") {
    return { ok: true, state: { ...base, turnSeat: nextSeat(base, seat, 2) } };
  }

  if (figura === "d") {
    return {
      ok: true,
      state: {
        ...base,
        pendingDraw: state.pendingDraw + 2,
        turnSeat: nextSeat(base, seat),
      },
    };
  }

  if (card === "W4") {
    return {
      ok: true,
      state: {
        ...base,
        pendingDraw: state.pendingDraw + 4,
        turnSeat: nextSeat(base, seat),
      },
    };
  }

  return { ok: true, state: { ...base, turnSeat: nextSeat(base, seat) } };
};

/**
 * Rehace el monton de robar con lo tirado cuando se acaba.
 *
 * La carta de arriba se queda en la mesa: es la que dice a que se juega. Sin
 * esto, una partida larga se queda sin cartas y no hay forma de continuar.
 */
const refill = (
  deck: readonly Card[],
  discard: readonly Card[],
  seed: number,
): { readonly deck: readonly Card[]; readonly discard: readonly Card[] } => {
  if (deck.length > 0 || discard.length <= 1) {
    return { deck, discard };
  }
  const arriba = discard[discard.length - 1] as Card;
  const reciclables = discard.slice(0, -1);
  return {
    deck: shuffle(reciclables, makeRng(seed)),
    discard: [arriba],
  };
};

export type DrawResult =
  | {
      readonly ok: true;
      readonly state: ColorCardsState;
      readonly drawn: readonly Card[];
    }
  | { readonly ok: false; readonly error: "not-your-turn" | "match-over" };

/**
 * Roba: una carta si no hay castigo, o todas las acumuladas si lo hay.
 *
 * Robar por castigo pasa el turno siempre. Robar de forma normal tambien: la
 * alternativa —dejar tirar lo recien robado— exige guardar "esta persona acaba
 * de robar" para que no robe dos veces seguidas, y ese estado extra es una
 * fuente de líos a cambio de muy poco.
 */
export const drawCards = (
  state: ColorCardsState,
  seat: number,
  seed: number,
): DrawResult => {
  if (state.finished) {
    return { ok: false, error: "match-over" };
  }
  if (state.turnSeat !== seat) {
    return { ok: false, error: "not-your-turn" };
  }

  const cuantas = state.pendingDraw > 0 ? state.pendingDraw : 1;
  const cogidas: Card[] = [];
  let deck = state.deck;
  let discard = state.discard;

  for (let i = 0; i < cuantas; i += 1) {
    const relleno = refill(deck, discard, seed + i);
    deck = relleno.deck;
    discard = relleno.discard;
    const carta = deck[0];
    if (carta === undefined) {
      // Ni monton ni descarte: no hay mas cartas en el mundo. Se reparte lo
      // que hubiera y se sigue, en vez de bloquear la partida.
      break;
    }
    cogidas.push(carta);
    deck = deck.slice(1);
  }

  return {
    ok: true,
    state: {
      ...state,
      deck,
      discard,
      hands: {
        ...state.hands,
        [seat]: [...(state.hands[seat] ?? []), ...cogidas],
      },
      pendingDraw: 0,
      turnSeat: nextSeat(state, seat),
    },
    drawn: cogidas,
  };
};

/**
 * Saca a alguien de la partida.
 *
 * Sus cartas vuelven al monton en vez de desaparecer: si se esfumasen, una
 * partida donde alguien se va a mitad se quedaria sin baraja suficiente para
 * terminar. Si al irse queda una sola persona, esa gana.
 */
export const removeSeat = (
  state: ColorCardsState,
  seat: number,
): ColorCardsState => {
  if (state.finished || !state.seats.includes(seat)) {
    return state;
  }
  const seats = state.seats.filter((s) => s !== seat);
  const devueltas = state.hands[seat] ?? [];
  const hands = { ...state.hands };
  delete hands[seat];

  if (seats.length === 1) {
    return {
      ...state,
      seats,
      hands,
      finished: true,
      winner: seats[0] as number,
    };
  }

  const turnSeat =
    state.turnSeat === seat ? nextSeat(state, seat) : state.turnSeat;
  return {
    ...state,
    seats,
    hands,
    deck: [...state.deck, ...devueltas],
    // Si el que se va tenia el turno, pasa al siguiente ANTES de quitarlo de
    // la lista; calcularlo despues saltaria un asiento.
    turnSeat: seats.includes(turnSeat) ? turnSeat : (seats[0] as number),
  };
};

/** Cuantas cartas tiene cada uno. Publico: los numeros si, las cartas no. */
export const handSizes = (
  state: ColorCardsState,
): Readonly<Record<number, number>> => {
  const out: Record<number, number> = {};
  for (const seat of state.seats) {
    out[seat] = (state.hands[seat] ?? []).length;
  }
  return out;
};

/** El estado publico: todo menos las manos y el monton de robar. */
export interface PublicView {
  readonly top: Card;
  readonly activeColor: Color;
  readonly turnSeat: number;
  readonly direction: 1 | -1;
  readonly pendingDraw: number;
  readonly deckSize: number;
  readonly handSizes: Readonly<Record<number, number>>;
  readonly seats: readonly number[];
  readonly finished: boolean;
  readonly winner: number | null;
}

/**
 * Lo que puede ver la mesa.
 *
 * El monton de robar sale como numero y no como lista: enseñar el orden del
 * monton es enseñar todas las cartas que van a salir.
 */
export const publicView = (state: ColorCardsState): PublicView => ({
  top: topCard(state),
  activeColor: state.activeColor,
  turnSeat: state.turnSeat,
  direction: state.direction,
  pendingDraw: state.pendingDraw,
  deckSize: state.deck.length,
  handSizes: handSizes(state),
  seats: state.seats,
  finished: state.finished,
  winner: state.winner,
});

/**
 * Parte el estado en lo que va a `GameMatch.state` y lo que va a
 * `GameMatchPlayer.secret`, una entrada por asiento.
 */
export const splitState = (
  state: ColorCardsState,
): {
  readonly shared: Omit<ColorCardsState, "hands">;
  readonly hands: Readonly<Record<number, readonly Card[]>>;
} => {
  const { hands, ...shared } = state;
  return { shared, hands };
};

/** Lo contrario de `splitState`, al cargar de la base de datos. */
export const mergeState = (
  shared: Omit<ColorCardsState, "hands">,
  hands: Readonly<Record<number, readonly Card[]>>,
): ColorCardsState => ({ ...shared, hands });

/** Como se lee una carta en el chat. */
export const renderCard = (card: Card): string => {
  const bola: Readonly<Record<Color, string>> = {
    R: "🔴",
    Y: "🟡",
    G: "🟢",
    B: "🔵",
  };
  if (card === "W") {
    return "🌈 comodín";
  }
  if (card === "W4") {
    return "🌈 +4";
  }
  const color = colorOf(card);
  const icono = color ? bola[color] : "⬜";
  const figura = faceOf(card);
  const nombre =
    figura === "s"
      ? "salta"
      : figura === "r"
        ? "cambio"
        : figura === "d"
          ? "+2"
          : figura;
  return `${icono} ${nombre}`;
};

/** Valida un estado venido de la base de datos antes de fiarse de el. */
export const isValidColorCardsState = (
  value: unknown,
): value is ColorCardsState => {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const raw = value as Record<string, unknown>;
  return (
    typeof raw.hands === "object" &&
    raw.hands !== null &&
    Array.isArray(raw.deck) &&
    Array.isArray(raw.discard) &&
    raw.discard.length > 0 &&
    typeof raw.activeColor === "string" &&
    COLORS.includes(raw.activeColor as Color) &&
    typeof raw.turnSeat === "number" &&
    (raw.direction === 1 || raw.direction === -1) &&
    typeof raw.pendingDraw === "number" &&
    raw.pendingDraw >= 0 &&
    Array.isArray(raw.seats) &&
    raw.seats.length > 0 &&
    typeof raw.finished === "boolean"
  );
};

/** Escapa lo que Telegram leeria como etiquetas. Los nombres los eligen ellos. */
const escapeHtml = (text: string): string =>
  text.replace(/&/gu, "&amp;").replace(/</gu, "&lt;").replace(/>/gu, "&gt;");

/**
 * La mesa tal como la ve el grupo.
 *
 * Vive aqui, y no en quien la manda, porque la escriben DOS sitios: el bot al
 * repartir y la API en cada tirada. Cuando cada uno tenia la suya, la mesa
 * cambiaba de aspecto en cuanto alguien jugaba — parecia otro mensaje, y ese
 * salto es la mitad de lo que se siente como "raro" jugando.
 *
 * Solo numeros de cartas, nunca las cartas de nadie: esto lo lee el chat
 * entero, incluido quien juega en contra.
 */
export const renderTable = (
  state: ColorCardsState,
  names: ReadonlyMap<number, string | null>,
  log: readonly string[] = [],
): string => {
  const view = publicView(state);
  const nombre = (seat: number): string =>
    escapeHtml(names.get(seat) ?? `Asiento ${seat}`);
  // Las jugadas van en <blockquote> para que se distingan del estado de un
  // vistazo: arriba como va la cosa, abajo como se ha llegado ahi.
  const historia =
    log.length > 0 ? ["", `<blockquote>${log.join("\n")}</blockquote>`] : [];

  if (view.finished) {
    return [
      "🎴 <b>Cartas de colores</b>",
      "",
      view.winner === null
        ? "Partida terminada."
        : `🏆 <b>Gana ${nombre(view.winner)}</b>`,
      ...historia,
    ].join("\n");
  }

  return [
    "🎴 <b>Cartas de colores</b>",
    "",
    `Carta en juego: ${renderCard(view.top)}`,
    `Color: ${COLOR_NAMES[view.activeColor]}`,
    "",
    ...view.seats.map(
      (s) =>
        `${s === view.turnSeat ? "▶️" : "·"} ${nombre(s)} — ${view.handSizes[s] ?? 0} cartas`,
    ),
    ...(view.pendingDraw > 0
      ? ["", `⚠️ Hay <b>+${view.pendingDraw}</b> encadenados.`]
      : []),
    ...historia,
    "",
    "<i>Abre tu mano para jugar.</i>",
  ].join("\n");
};

/** Cuantas jugadas se enseñan. Mas y el mensaje tapa el chat. */
export const LOG_LINES = 5;

/**
 * Una linea de historial.
 *
 * Se construye aqui, con el resto de lo que se enseña, para que diga lo mismo
 * en todas partes. Lo que NO lleva nunca es una carta de la mano de nadie: solo
 * la que se acaba de tirar, que ya esta boca arriba en la mesa.
 */
export const describeMove = (input: {
  readonly who: string;
  readonly card?: Card;
  readonly chosenColor?: Color;
  readonly drew?: number;
  readonly cardsLeft: number;
}): string => {
  const quien = `<b>${escapeHtml(input.who)}</b>`;
  // El aviso de "una carta" es lo unico que hace falta anunciar: es el momento
  // en el que el resto tiene que decidir si le castigan.
  const aviso = input.cardsLeft === 1 ? " · <b>¡le queda 1!</b>" : "";

  if (input.drew !== undefined) {
    return `${quien} robó ${input.drew}`;
  }
  if (!input.card) {
    return quien;
  }
  const color = input.chosenColor ? ` → ${COLOR_NAMES[input.chosenColor]}` : "";
  return `${quien} tiró ${renderCard(input.card)}${color}${aviso}`;
};

/** Añade una jugada al historial y se queda con las ultimas. */
export const pushMove = (
  log: readonly string[],
  line: string,
): readonly string[] => [...log, line].slice(-LOG_LINES);
