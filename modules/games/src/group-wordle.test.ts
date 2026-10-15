import { describe, expect, it } from "vitest";
import {
  attemptsLeft,
  contributions,
  discardedLetters,
  isHogging,
  isValidWordleState,
  MAX_ATTEMPTS,
  normalize,
  PER_PERSON_STREAK,
  pickWord,
  renderAttempt,
  renderBoard,
  renderShare,
  scoreGuess,
  startWordle,
  submitGuess,
  WORD_LENGTH,
  WORDS,
  type WordleState,
} from "./group-wordle.js";

const nueva = (answer = "PLAYA"): WordleState => {
  const s = startWordle(answer);
  if (!s) {
    throw new Error("la palabra deberia valer");
  }
  return s;
};

/** Encadena intentos alternando de persona para no chocar con el freno. */
const intentos = (
  state: WordleState,
  palabras: readonly string[],
): WordleState => {
  let s = state;
  palabras.forEach((w, i) => {
    const r = submitGuess(s, w, `p${i % 3}`);
    if (!r.ok) {
      throw new Error(`intento rechazado: ${r.error}`);
    }
    s = r.state;
  });
  return s;
};

describe("scoreGuess", () => {
  it("marca los aciertos en su sitio", () => {
    expect(scoreGuess("PLAYA", "PLAYA")).toEqual([
      "hit",
      "hit",
      "hit",
      "hit",
      "hit",
    ]);
  });

  it("marca lo que no esta", () => {
    expect(scoreGuess("BBBBB", "PLAYA")).toEqual([
      "miss",
      "miss",
      "miss",
      "miss",
      "miss",
    ]);
  });

  it("marca en amarillo lo que esta en otro sitio", () => {
    // La P de PLAYA existe pero no en la posicion 4.
    const marks = scoreGuess("BBBBP", "PLAYA");
    expect(marks[4]).toBe("present");
  });

  it("no pinta mas amarillas de las letras que hay", () => {
    // Este es el fallo clasico: PLAYA tiene DOS aes. Un intento con tres
    // solo puede llevarse dos marcas, o el chat lee que hay mas de las que hay.
    const marks = scoreGuess("AAABB", "PLAYA");
    const marcadas = marks.filter((m) => m !== "miss").length;
    expect(marcadas).toBe(2);
  });

  it("los verdes se llevan la letra antes que los amarillos", () => {
    // OTOÑO no vale (tiene Ñ); se usa PAPAS contra PLAYA.
    // La A en su sitio es verde y consume una de las dos aes.
    const marks = scoreGuess("AAAAA", "PLAYA");
    expect(marks[2]).toBe("hit");
    expect(marks[4]).toBe("hit");
    // Las otras tres aes no tienen de donde salir.
    expect(marks.filter((m) => m === "present")).toHaveLength(0);
  });

  it("una letra repetida en el intento pero unica en la respuesta solo puntua una vez", () => {
    const marks = scoreGuess("LLLLL", "PLAYA");
    expect(marks.filter((m) => m !== "miss")).toHaveLength(1);
  });
});

describe("empezar", () => {
  it("acepta una palabra de cinco letras", () => {
    expect(nueva().answer).toBe("PLAYA");
    expect(nueva().attempts).toEqual([]);
  });

  it("normaliza tildes y minusculas", () => {
    expect(startWordle("limón")?.answer).toBe("LIMON");
    expect(normalize("españa")).toBe("ESPAÑA");
  });

  it("rechaza lo que no sea una palabra de cinco letras", () => {
    expect(startWordle("SOL")).toBeNull();
    expect(startWordle("ELEFANTE")).toBeNull();
    expect(startWordle("AB1DE")).toBeNull();
    expect(startWordle("")).toBeNull();
  });
});

describe("intentos", () => {
  it("acertar termina la partida y apunta a quien fue", () => {
    const r = submitGuess(nueva(), "playa", "ana");
    if (!r.ok) {
      throw new Error("deberia valer");
    }
    expect(r.solved).toBe(true);
    expect(r.state.finished).toBe(true);
    expect(r.state.solvedBy).toBe("ana");
  });

  it("se acaba a los seis intentos sin acertar", () => {
    const s = intentos(nueva(), [
      "PERRO",
      "LIBRO",
      "VERDE",
      "NEGRO",
      "NOCHE",
      "TARDE",
    ]);
    expect(s.finished).toBe(true);
    expect(s.solvedBy).toBeNull();
    expect(attemptsLeft(s)).toBe(0);
  });

  it("no admite palabras de otro tamaño", () => {
    expect(submitGuess(nueva(), "SOL", "ana")).toEqual({
      ok: false,
      error: "wrong-length",
    });
  });

  it("no admite numeros ni simbolos", () => {
    expect(submitGuess(nueva(), "AB1DE", "ana")).toEqual({
      ok: false,
      error: "not-a-word",
    });
  });

  it("no deja repetir una palabra ya probada", () => {
    // Los seis intentos son del grupo: gastar uno en una linea que ya esta
    // escrita mas arriba no es una jugada.
    const s = intentos(nueva(), ["PERRO"]);
    expect(submitGuess(s, "perro", "otro")).toEqual({
      ok: false,
      error: "already-tried",
    });
  });

  it("una partida acabada no admite mas", () => {
    const r = submitGuess(nueva(), "PLAYA", "ana");
    if (!r.ok) {
      throw new Error("deberia valer");
    }
    expect(submitGuess(r.state, "PERRO", "luis")).toEqual({
      ok: false,
      error: "game-over",
    });
  });
});

describe("que no se lo lleve uno solo", () => {
  it("frena a quien encadena demasiados seguidos", () => {
    // Sin esto, el primero que este mirando el movil se ventila los seis.
    let s = nueva();
    for (const w of ["PERRO", "LIBRO"]) {
      const r = submitGuess(s, w, "ana");
      if (!r.ok) {
        throw new Error("deberia valer");
      }
      s = r.state;
    }
    expect(isHogging(s, "ana")).toBe(true);
    expect(submitGuess(s, "VERDE", "ana")).toEqual({
      ok: false,
      error: "hogging",
    });
  });

  it("otra persona si puede tirar", () => {
    let s = nueva();
    for (const w of ["PERRO", "LIBRO"]) {
      const r = submitGuess(s, w, "ana");
      if (!r.ok) {
        throw new Error("deberia valer");
      }
      s = r.state;
    }
    expect(isHogging(s, "luis")).toBe(false);
    expect(submitGuess(s, "VERDE", "luis")).toMatchObject({ ok: true });
  });

  it("y el freno se suelta en cuanto tira otro", () => {
    const s = intentos(nueva(), ["PERRO", "LIBRO", "VERDE"]);
    // p0, p1, p2: nadie encadeno.
    expect(isHogging(s, "p0")).toBe(false);
    expect(PER_PERSON_STREAK).toBe(2);
  });
});

describe("pintado", () => {
  it("la linea lleva los cuadros y la palabra", () => {
    const s = intentos(nueva(), ["PERRO"]);
    const linea = renderAttempt(s.attempts[0] as never);
    expect(linea).toContain("P");
    expect(linea).toMatch(/[🟩🟨⬛]/u);
  });

  it("el tablero tiene una linea por intento", () => {
    const s = intentos(nueva(), ["PERRO", "LIBRO"]);
    expect(renderBoard(s).split("\n")).toHaveLength(2);
  });

  it("lo que se comparte NO lleva las palabras", () => {
    // Con las palabras dentro seria una captura que le arruina el dia a quien
    // todavia no ha jugado.
    const s = intentos(nueva(), ["PERRO", "LIBRO"]);
    const texto = renderShare(s, 12);
    expect(texto).not.toContain("PERRO");
    expect(texto).not.toContain("LIBRO");
    expect(texto).toContain("#12");
  });

  it("lo compartido dice X cuando no se acerto", () => {
    const s = intentos(nueva(), [
      "PERRO",
      "LIBRO",
      "VERDE",
      "NEGRO",
      "NOCHE",
      "TARDE",
    ]);
    expect(renderShare(s, 3)).toContain(`X/${MAX_ATTEMPTS}`);
  });
});

describe("ayudas", () => {
  it("lista las letras descartadas", () => {
    const s = intentos(nueva(), ["PERRO"]);
    // E, R, O no estan en PLAYA; la P si.
    const fuera = discardedLetters(s);
    expect(fuera).toContain("E");
    expect(fuera).toContain("R");
    expect(fuera).not.toContain("P");
  });

  it("no descarta una letra que aparece en verde en otra posicion", () => {
    // PAPEL: la primera P es verde en PLAYA, la segunda gris. No esta fuera.
    const s = intentos(nueva(), ["PAPEL"]);
    expect(discardedLetters(s)).not.toContain("P");
  });

  it("cuenta quien puso cuantos intentos", () => {
    let s = nueva();
    for (const [w, quien] of [
      ["PERRO", "ana"],
      ["LIBRO", "ana"],
      ["VERDE", "luis"],
    ] as const) {
      const r = submitGuess(s, w, quien);
      if (!r.ok) {
        throw new Error("deberia valer");
      }
      s = r.state;
    }
    expect(contributions(s)).toEqual([
      { playerId: "ana", attempts: 2 },
      { playerId: "luis", attempts: 1 },
    ]);
  });
});

describe("eleccion de palabra", () => {
  it("la misma semilla da siempre la misma palabra", () => {
    expect(pickWord(42)).toBe(pickWord(42));
  });

  it("semillas distintas dan palabras distintas", () => {
    expect(pickWord(1)).not.toBe(pickWord(2));
  });

  it("aguanta una semilla negativa o enorme", () => {
    expect(WORDS).toContain(pickWord(-7));
    expect(WORDS).toContain(pickWord(999999));
  });

  it("dos partidas seguidas el mismo dia NO repiten palabra", () => {
    // El fallo que se arregla: con el dia como semilla, jugar dos veces el
    // mismo dia sacaba la misma palabra y la segunda partida no tenia gracia.
    // Semillas consecutivas (milisegundos del reloj) tienen que diferir.
    const ahora = 1_785_880_000_000;
    expect(pickWord(ahora)).not.toBe(pickWord(ahora + 1));
  });

  it("todas las palabras son jugables", () => {
    // Cinco letras exactas, sin tildes ni Ñ: nadie puede perder un intento
    // por no saber escribirla en el movil.
    expect(WORDS.length).toBeGreaterThan(50);
    for (const w of WORDS) {
      expect(w).toHaveLength(WORD_LENGTH);
      expect(w).toMatch(/^[A-Z]{5}$/);
    }
  });

  it("no hay palabras repetidas", () => {
    expect(new Set(WORDS).size).toBe(WORDS.length);
  });
});

describe("validacion de estado guardado", () => {
  it("acepta uno bueno", () => {
    expect(isValidWordleState(nueva())).toBe(true);
  });

  it.each([
    null,
    undefined,
    {},
    { answer: "SOL", attempts: [], finished: false },
    { answer: "PLAYA", attempts: "no", finished: false },
    { answer: "PLAYA", attempts: [{ word: 1 }], finished: false },
  ])("rechaza un estado corrupto", (value) => {
    expect(isValidWordleState(value)).toBe(false);
  });
});
