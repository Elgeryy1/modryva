/**
 * Ahorcado cooperativo de grupo: una palabra, todo el chat adivinando letras.
 *
 * Cooperativo y no por turnos a proposito. Un ahorcado por turnos en un grupo
 * de Telegram se atasca en cuanto a alguien le toca y se va a cenar; asi
 * cualquiera puede tirar, y lo unico que se lleva la cuenta es quien acerto
 * que letra, para poder repartir el merito al final.
 *
 * Puro: sin E/S, sin reloj, sin azar. La palabra la elige quien llama.
 */

/** Fallos permitidos antes de perder. Seis, como el monigote de toda la vida. */
export const MAX_MISSES = 6;

export interface HangmanState {
  /** Siempre en mayusculas y sin acentos: ver `normalizeWord`. */
  readonly word: string;
  /** Letras probadas, en el orden en que se probaron. */
  readonly guessed: readonly string[];
  /** Quien acerto cada letra, para el reparto de merito. */
  readonly credits: Readonly<Record<string, string>>;
  readonly misses: number;
}

/**
 * Normaliza una palabra o una letra: mayusculas y sin tildes.
 *
 * Sin esto, "MAMÁ" nunca se completa — nadie escribe la A con tilde al
 * adivinar, y la partida se queda colgada para siempre en una letra que si se
 * habia acertado. La Ñ SI se conserva: es una letra distinta en castellano, no
 * una N adornada.
 */
export const normalizeWord = (raw: string): string =>
  raw
    .normalize("NFD")
    // Se quitan los diacriticos salvo la virgulilla de la ñ.
    .replace(/(?!̃)[̀-ͯ]/gu, "")
    .normalize("NFC")
    .toUpperCase();

const LETTER = /^[A-ZÑ]$/u;

export const isPlayableLetter = (raw: string): boolean =>
  LETTER.test(normalizeWord(raw));

/** Solo letras: los espacios y guiones de una palabra compuesta se regalan. */
const isLetter = (ch: string): boolean => LETTER.test(ch);

export const startHangman = (word: string): HangmanState => ({
  word: normalizeWord(word),
  guessed: [],
  credits: {},
  misses: 0,
});

/** Lo que se enseña: letras acertadas, guiones para el resto. */
export const renderMask = (state: HangmanState): string =>
  [...state.word]
    .map((ch) => {
      if (!isLetter(ch)) {
        return ch === " " ? "   " : ch;
      }
      return state.guessed.includes(ch) ? ch : "_";
    })
    .join(" ");

export const isSolved = (state: HangmanState): boolean =>
  [...state.word].every((ch) => !isLetter(ch) || state.guessed.includes(ch));

export const isLost = (state: HangmanState): boolean =>
  state.misses >= MAX_MISSES;

export const isOver = (state: HangmanState): boolean =>
  isSolved(state) || isLost(state);

export type GuessOutcome =
  | "hit"
  | "miss"
  | "already-guessed"
  | "not-a-letter"
  | "game-over";

export interface GuessResult {
  readonly outcome: GuessOutcome;
  readonly state: HangmanState;
  /** Cuantas veces aparecia la letra. 0 si fallo. */
  readonly occurrences: number;
}

/**
 * Prueba una letra.
 *
 * Repetir una letra ya probada NO cuenta como fallo: en un grupo, dos personas
 * mandan la misma letra a la vez constantemente, y castigar eso convierte una
 * coincidencia en una derrota.
 */
export const guessLetter = (
  state: HangmanState,
  rawLetter: string,
  playerId: string,
): GuessResult => {
  if (isOver(state)) {
    return { outcome: "game-over", state, occurrences: 0 };
  }
  const letter = normalizeWord(rawLetter);
  if (!isLetter(letter)) {
    return { outcome: "not-a-letter", state, occurrences: 0 };
  }
  if (state.guessed.includes(letter)) {
    return { outcome: "already-guessed", state, occurrences: 0 };
  }

  const occurrences = [...state.word].filter((ch) => ch === letter).length;
  const guessed = [...state.guessed, letter];

  if (occurrences === 0) {
    return {
      outcome: "miss",
      state: { ...state, guessed, misses: state.misses + 1 },
      occurrences: 0,
    };
  }
  return {
    outcome: "hit",
    state: {
      ...state,
      guessed,
      credits: { ...state.credits, [letter]: playerId },
    },
    occurrences,
  };
};

/**
 * Intento de resolver la palabra entera.
 *
 * Fallar cuesta UN fallo, no la partida: en grupo, alguien tira una palabra a
 * ver si suena, y terminar la partida por eso deja fuera a los demas por la
 * prisa de uno.
 */
export const guessWord = (
  state: HangmanState,
  rawWord: string,
  playerId: string,
): GuessResult => {
  if (isOver(state)) {
    return { outcome: "game-over", state, occurrences: 0 };
  }
  const intento = normalizeWord(rawWord);
  if (intento !== state.word) {
    return {
      outcome: "miss",
      state: { ...state, misses: state.misses + 1 },
      occurrences: 0,
    };
  }
  // Acierto pleno: se descubren todas las letras que faltaban, a su nombre.
  const pendientes = [...new Set([...state.word].filter(isLetter))].filter(
    (ch) => !state.guessed.includes(ch),
  );
  const credits = { ...state.credits };
  for (const ch of pendientes) {
    credits[ch] = playerId;
  }
  return {
    outcome: "hit",
    state: { ...state, guessed: [...state.guessed, ...pendientes], credits },
    occurrences: pendientes.length,
  };
};

const GALLOWS: readonly string[] = ["😀", "🙂", "😐", "😟", "😨", "😰", "💀"];

/** La carita segun lo cerca que esta el desastre. */
export const renderGallows = (state: HangmanState): string =>
  GALLOWS[Math.min(state.misses, GALLOWS.length - 1)] ?? "💀";

/** Quien ha acertado mas letras, de mayor a menor. Para el mensaje final. */
export const creditRanking = (
  state: HangmanState,
): readonly { readonly playerId: string; readonly letters: number }[] => {
  const cuenta = new Map<string, number>();
  for (const playerId of Object.values(state.credits)) {
    cuenta.set(playerId, (cuenta.get(playerId) ?? 0) + 1);
  }
  return [...cuenta.entries()]
    .map(([playerId, letters]) => ({ playerId, letters }))
    .sort((a, b) => b.letters - a.letters);
};

/** Las letras falladas, para no repetirlas. */
export const missedLetters = (state: HangmanState): string[] =>
  state.guessed.filter((ch) => ![...state.word].includes(ch));

/** Valida un estado venido de la base de datos antes de fiarse de el. */
export const isValidHangmanState = (value: unknown): value is HangmanState => {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const raw = value as Record<string, unknown>;
  return (
    typeof raw.word === "string" &&
    raw.word.length > 0 &&
    Array.isArray(raw.guessed) &&
    raw.guessed.every((g) => typeof g === "string") &&
    typeof raw.misses === "number" &&
    Number.isInteger(raw.misses) &&
    raw.misses >= 0 &&
    typeof raw.credits === "object" &&
    raw.credits !== null
  );
};
