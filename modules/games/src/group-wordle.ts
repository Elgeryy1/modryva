/**
 * Wordle de grupo: una palabra al dia, seis intentos que gasta TODO el chat.
 *
 * No es un wordle por persona. Los intentos son del grupo entero, asi que cada
 * uno se piensa antes de tirar y el juego se convierte en una conversacion en
 * vez de en un solitario en paralelo. Lo unico que se lleva por persona es
 * quien acerto, para el mensaje final.
 *
 * Puro: sin E/S, sin reloj, sin azar. La palabra y el dia los pone quien llama.
 */

export const WORD_LENGTH = 5;
export const MAX_ATTEMPTS = 6;
/** Intentos seguidos de la misma persona antes de tener que dejar tirar a otro. */
export const PER_PERSON_STREAK = 2;

/**
 * 🟩 en su sitio · 🟨 esta pero en otro sitio · ⬛ no esta.
 */
export type Mark = "hit" | "present" | "miss";

export interface Attempt {
  readonly word: string;
  readonly marks: readonly Mark[];
  readonly playerId: string;
}

export interface WordleState {
  /** Siempre normalizada: mayusculas, sin tildes. */
  readonly answer: string;
  readonly attempts: readonly Attempt[];
  readonly finished: boolean;
  /** Quien acerto, o null si se acabaron los intentos. */
  readonly solvedBy: string | null;
}

/** Mayusculas y sin tildes. La Ñ se conserva: es otra letra. */
export const normalize = (raw: string): string =>
  raw
    .normalize("NFD")
    .replace(/(?!̃)[̀-ͯ]/gu, "")
    .normalize("NFC")
    .toUpperCase()
    .trim();

const WORD = /^[A-ZÑ]+$/u;

export const startWordle = (answer: string): WordleState | null => {
  const palabra = normalize(answer);
  if (palabra.length !== WORD_LENGTH || !WORD.test(palabra)) {
    return null;
  }
  return { answer: palabra, attempts: [], finished: false, solvedBy: null };
};

/**
 * Pinta un intento contra la respuesta.
 *
 * Las letras repetidas son el sitio donde casi todas las implementaciones
 * fallan. Se hace en DOS pasadas: primero se marcan los aciertos exactos y se
 * gastan esas letras del cupo, y solo despues se reparten los amarillos con lo
 * que sobra. Sin eso, intentar "OSOSO" contra "OTOÑO" pinta amarillas unas O
 * que ya estan contadas en verde, y el chat lee que hay mas O de las que hay.
 */
export const scoreGuess = (guess: string, answer: string): Mark[] => {
  const g = [...guess];
  const a = [...answer];
  const marks: Mark[] = new Array(g.length).fill("miss");

  const disponibles = new Map<string, number>();
  // Primera pasada: los verdes, gastando su letra.
  for (let i = 0; i < g.length; i += 1) {
    if (g[i] === a[i]) {
      marks[i] = "hit";
    } else {
      const ch = a[i] as string;
      disponibles.set(ch, (disponibles.get(ch) ?? 0) + 1);
    }
  }
  // Segunda pasada: los amarillos, solo con lo que quedo sin gastar.
  for (let i = 0; i < g.length; i += 1) {
    if (marks[i] === "hit") {
      continue;
    }
    const ch = g[i] as string;
    const quedan = disponibles.get(ch) ?? 0;
    if (quedan > 0) {
      marks[i] = "present";
      disponibles.set(ch, quedan - 1);
    }
  }
  return marks;
};

export type GuessError =
  | "game-over"
  | "wrong-length"
  | "not-a-word"
  | "already-tried"
  | "hogging";

export type GuessResult =
  | {
      readonly ok: true;
      readonly state: WordleState;
      readonly attempt: Attempt;
      readonly solved: boolean;
    }
  | { readonly ok: false; readonly error: GuessError };

/**
 * Prueba una palabra.
 *
 * Dos frenos, y los dos existen por el mismo motivo: los seis intentos son de
 * todos.
 *
 * - Repetir una palabra ya probada se rechaza. Gastar un intento del grupo en
 *   una linea que ya esta escrita mas arriba no es una jugada, es un despiste.
 * - Nadie puede encadenar mas de `PER_PERSON_STREAK` intentos seguidos. Sin
 *   esto, el primero que este mirando el movil se ventila los seis en veinte
 *   segundos y para el resto no hubo juego.
 */
export const submitGuess = (
  state: WordleState,
  rawGuess: string,
  playerId: string,
): GuessResult => {
  if (state.finished) {
    return { ok: false, error: "game-over" };
  }
  const word = normalize(rawGuess);
  if (word.length !== WORD_LENGTH) {
    return { ok: false, error: "wrong-length" };
  }
  if (!WORD.test(word)) {
    return { ok: false, error: "not-a-word" };
  }
  if (state.attempts.some((a) => a.word === word)) {
    return { ok: false, error: "already-tried" };
  }
  if (isHogging(state, playerId)) {
    return { ok: false, error: "hogging" };
  }

  const attempt: Attempt = {
    word,
    marks: scoreGuess(word, state.answer),
    playerId,
  };
  const attempts = [...state.attempts, attempt];
  const acertada = word === state.answer;
  const agotados = attempts.length >= MAX_ATTEMPTS;

  return {
    ok: true,
    state: {
      ...state,
      attempts,
      finished: acertada || agotados,
      solvedBy: acertada ? playerId : null,
    },
    attempt,
    solved: acertada,
  };
};

/** Si esa persona ya encadeno demasiados intentos seguidos. */
export const isHogging = (state: WordleState, playerId: string): boolean => {
  const ultimos = state.attempts.slice(-PER_PERSON_STREAK);
  return (
    ultimos.length === PER_PERSON_STREAK &&
    ultimos.every((a) => a.playerId === playerId)
  );
};

export const attemptsLeft = (state: WordleState): number =>
  Math.max(0, MAX_ATTEMPTS - state.attempts.length);

const GLYPH: Readonly<Record<Mark, string>> = {
  hit: "🟩",
  present: "🟨",
  miss: "⬛",
};

/** Una linea de intento, con la palabra debajo de los cuadros. */
export const renderAttempt = (attempt: Attempt): string =>
  `${attempt.marks.map((m) => GLYPH[m]).join("")}  ${[...attempt.word].join(" ")}`;

/** El tablero entero. */
export const renderBoard = (state: WordleState): string =>
  state.attempts.map(renderAttempt).join("\n");

/**
 * El resultado para compartir: solo los cuadros, sin las palabras.
 *
 * Es lo que hace que el juego circule. Con las palabras dentro seria una
 * captura que le arruina el dia a quien todavia no ha jugado.
 */
export const renderShare = (state: WordleState, day: number): string => {
  const cabecera = `Wordle del grupo #${day} ${
    state.solvedBy
      ? `${state.attempts.length}/${MAX_ATTEMPTS}`
      : `X/${MAX_ATTEMPTS}`
  }`;
  const cuadros = state.attempts
    .map((a) => a.marks.map((m) => GLYPH[m]).join(""))
    .join("\n");
  return `${cabecera}\n${cuadros}`;
};

/** Que letras se sabe ya que no estan, para no repetirlas. */
export const discardedLetters = (state: WordleState): string[] => {
  const fuera = new Set<string>();
  const dentro = new Set<string>();
  for (const a of state.attempts) {
    a.marks.forEach((m, i) => {
      const ch = a.word[i] as string;
      if (m === "miss") {
        fuera.add(ch);
      } else {
        dentro.add(ch);
      }
    });
  }
  // Una letra puede salir gris en una posicion y verde en otra si esta
  // repetida; en ese caso NO esta descartada.
  return [...fuera].filter((ch) => !dentro.has(ch)).sort();
};

/**
 * La mejor noticia que hay sobre cada letra probada.
 *
 * Para pintar el teclado. El orden importa y no es alfabetico: verde tapa a
 * amarillo y amarillo tapa a gris, nunca al reves. Una letra repetida puede
 * salir gris en una posicion y verde en otra —"CASAS" contra "CAOBA"— y pintar
 * esa tecla de gris le diria a la gente que la descarte cuando esta en la
 * palabra. Equivocarse en esa direccion cuesta intentos.
 */
export const letterMarks = (
  state: WordleState,
): Readonly<Record<string, Mark>> => {
  const rank: Readonly<Record<Mark, number>> = { miss: 0, present: 1, hit: 2 };
  const mejor: Record<string, Mark> = {};
  for (const a of state.attempts) {
    a.marks.forEach((m, i) => {
      const ch = a.word[i] as string;
      const actual = mejor[ch];
      if (actual === undefined || rank[m] > rank[actual]) {
        mejor[ch] = m;
      }
    });
  }
  return mejor;
};

/** Quien participo, con cuantos intentos puso cada uno. */
export const contributions = (
  state: WordleState,
): readonly { readonly playerId: string; readonly attempts: number }[] => {
  const cuenta = new Map<string, number>();
  for (const a of state.attempts) {
    cuenta.set(a.playerId, (cuenta.get(a.playerId) ?? 0) + 1);
  }
  return [...cuenta.entries()]
    .map(([playerId, attempts]) => ({ playerId, attempts }))
    .sort((x, y) => y.attempts - x.attempts);
};

/** Valida un estado venido de la base de datos antes de fiarse de el. */
export const isValidWordleState = (value: unknown): value is WordleState => {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const raw = value as Record<string, unknown>;
  return (
    typeof raw.answer === "string" &&
    raw.answer.length === WORD_LENGTH &&
    Array.isArray(raw.attempts) &&
    raw.attempts.length <= MAX_ATTEMPTS &&
    raw.attempts.every(
      (a) =>
        typeof a === "object" &&
        a !== null &&
        typeof (a as { word?: unknown }).word === "string" &&
        Array.isArray((a as { marks?: unknown }).marks),
    ) &&
    typeof raw.finished === "boolean"
  );
};

/**
 * Palabras de cinco letras para el sorteo diario.
 *
 * Comunes a proposito: una palabra rara acaba en que nadie la saca y el juego
 * se abandona. Sin tildes ni Ñ, para que nadie pierda un intento por no saber
 * escribirla en el movil.
 */
export const WORDS: readonly string[] = [
  "PERRO",
  "LIBRO",
  "VERDE",
  "NEGRO",
  "PLAYA",
  "NOCHE",
  "TARDE",
  "COCHE",
  "FUEGO",
  "MUNDO",
  "PARTE",
  "GENTE",
  "LUGAR",
  "GRUPO",
  "FORMA",
  "PUNTO",
  "CAMPO",
  "CLASE",
  "PAPEL",
  "NIVEL",
  "ORDEN",
  "SALIR",
  "TENER",
  "HACER",
  "PODER",
  "DECIR",
  "VIVIR",
  "PONER",
  "SABER",
  "DEJAR",
  "PASAR",
  "BUENO",
  "NUEVO",
  "VIEJO",
  "CORTO",
  "LARGO",
  "JOVEN",
  "FELIZ",
  "DULCE",
  "CALOR",
  "NUBES",
  "NIEVE",
  "CIELO",
  "MARES",
  "MONTE",
  "VALLE",
  "ARBOL",
  "HOJAS",
  "FRUTA",
  "LECHE",
  "QUESO",
  "CARNE",
  "ARROZ",
  "PASTA",
  "PLATO",
  "SILLA",
  "BANCO",
  "BARCO",
  "BOLSA",
  "BRAZO",
  "CABLE",
  "CALLE",
  "CARTA",
  "CLAVE",
  "CURSO",
  "DISCO",
  "FALDA",
  "FIRMA",
  "FRENO",
  "GLOBO",
  "GOLPE",
  "GRANO",
  "HIELO",
  "HUEVO",
  "HUMOR",
  "JUEGO",
  "JUGAR",
  "LETRA",
  "LIMON",
  "LINEA",
  "LISTA",
  "LLAVE",
  "MARCA",
  "METRO",
  "MIEDO",
  "MOTOR",
  "MUJER",
  "MUSEO",
  "NORTE",
  "PARED",
  "PASEO",
  "PATIO",
  "PIANO",
  "PISTA",
  "PLAZA",
  "POLLO",
  "PRISA",
  "RADIO",
  "REGLA",
  "RELOJ",
  "RITMO",
  "RUEDA",
  "SABOR",
  "SALSA",
  "SALTO",
  "SERIE",
  "SIGLO",
  "SITIO",
  "SUELO",
  "TECHO",
  "TENIS",
  "TIGRE",
  "TORRE",
  "TRAJE",
  "TRIGO",
  "TROZO",
  "TURNO",
  "VALOR",
  "VIAJE",
  "VIDEO",
  "VISTA",
  "VOLAR",
  "ZUMOS",
];

/**
 * La palabra que toca, elegida por una semilla.
 *
 * Se llamaba `wordForDay` y la semilla era el dia, con este razonamiento:
 * "reiniciar el bot a mitad de partida no cambia la respuesta debajo de la
 * gente que ya llevaba tres intentos". El razonamiento ya no aplica —la
 * respuesta se guarda en el estado de la partida en cuanto empieza, asi que no
 * se vuelve a derivar nunca— y a cambio tenia una consecuencia que si se
 * notaba: la segunda partida del mismo dia repetia palabra.
 *
 * Sigue siendo pura y deterministica respecto a lo que se le pase; quien llama
 * decide que varia.
 */
export const pickWord = (seed: number): string => {
  const n = WORDS.length;
  if (n === 0) {
    return "";
  }
  const i = ((Math.floor(seed) % n) + n) % n;
  return WORDS[i] as string;
};
