import { describe, expect, it } from "vitest";
import {
  creditRanking,
  guessLetter,
  guessWord,
  isLost,
  isPlayableLetter,
  isSolved,
  isValidHangmanState,
  MAX_MISSES,
  missedLetters,
  normalizeWord,
  renderGallows,
  renderMask,
  startHangman,
} from "./hangman.js";

describe("normalizeWord", () => {
  it("quita tildes y sube a mayusculas", () => {
    // Sin esto "MAMÁ" no se completa nunca: nadie escribe la A con tilde.
    expect(normalizeWord("mamá")).toBe("MAMA");
    expect(normalizeWord("Camión")).toBe("CAMION");
  });

  it("conserva la Ñ, que es otra letra", () => {
    expect(normalizeWord("españa")).toBe("ESPAÑA");
    expect(normalizeWord("ñ")).toBe("Ñ");
  });

  it("acepta como jugables solo letras", () => {
    expect(isPlayableLetter("a")).toBe(true);
    expect(isPlayableLetter("Ñ")).toBe(true);
    expect(isPlayableLetter("á")).toBe(true);
    expect(isPlayableLetter("1")).toBe(false);
    expect(isPlayableLetter("ab")).toBe(false);
    expect(isPlayableLetter("")).toBe(false);
  });
});

describe("partida", () => {
  it("empieza toda tapada", () => {
    const s = startHangman("gato");
    expect(renderMask(s)).toBe("_ _ _ _");
    expect(isSolved(s)).toBe(false);
    expect(isLost(s)).toBe(false);
  });

  it("acertar descubre TODAS las apariciones", () => {
    const s = startHangman("patata");
    const r = guessLetter(s, "a", "ana");
    expect(r.outcome).toBe("hit");
    expect(r.occurrences).toBe(3);
    expect(renderMask(r.state)).toBe("_ A _ A _ A");
  });

  it("fallar suma un fallo", () => {
    const r = guessLetter(startHangman("gato"), "z", "ana");
    expect(r.outcome).toBe("miss");
    expect(r.state.misses).toBe(1);
  });

  it("repetir letra NO castiga", () => {
    // En grupo dos personas mandan la misma letra a la vez constantemente.
    let s = startHangman("gato");
    s = guessLetter(s, "z", "ana").state;
    const r = guessLetter(s, "z", "luis");
    expect(r.outcome).toBe("already-guessed");
    expect(r.state.misses).toBe(1);
  });

  it("lo que no es una letra no cuenta de nada", () => {
    const r = guessLetter(startHangman("gato"), "7", "ana");
    expect(r.outcome).toBe("not-a-letter");
    expect(r.state.misses).toBe(0);
  });

  it("se pierde a los seis fallos", () => {
    let s = startHangman("gato");
    for (const letra of ["z", "x", "w", "k", "j", "q"]) {
      s = guessLetter(s, letra, "ana").state;
    }
    expect(s.misses).toBe(MAX_MISSES);
    expect(isLost(s)).toBe(true);
    expect(guessLetter(s, "g", "ana").outcome).toBe("game-over");
  });

  it("se gana al descubrir la ultima letra", () => {
    let s = startHangman("sol");
    for (const letra of ["s", "o", "l"]) {
      s = guessLetter(s, letra, "ana").state;
    }
    expect(isSolved(s)).toBe(true);
    expect(renderMask(s)).toBe("S O L");
  });

  it("los espacios de una palabra compuesta se regalan", () => {
    const s = startHangman("mar rojo");
    expect(renderMask(s)).toContain("   ");
    expect(isSolved(s)).toBe(false);
  });
});

describe("resolver la palabra entera", () => {
  it("acertarla la completa y apunta las letras que faltaban", () => {
    let s = startHangman("gato");
    s = guessLetter(s, "g", "ana").state;
    const r = guessWord(s, "GATO", "luis");
    expect(r.outcome).toBe("hit");
    expect(isSolved(r.state)).toBe(true);
    expect(r.state.credits.G).toBe("ana");
    expect(r.state.credits.O).toBe("luis");
  });

  it("acepta la palabra con tildes o en minusculas", () => {
    const r = guessWord(startHangman("camión"), "camion", "ana");
    expect(r.outcome).toBe("hit");
  });

  it("fallar cuesta UN fallo, no la partida", () => {
    // Alguien tira una palabra a ver si suena; no puede dejar fuera al resto.
    const r = guessWord(startHangman("gato"), "perro", "ana");
    expect(r.outcome).toBe("miss");
    expect(r.state.misses).toBe(1);
    expect(isLost(r.state)).toBe(false);
  });
});

describe("merito", () => {
  it("ordena por letras acertadas", () => {
    let s = startHangman("patata");
    s = guessLetter(s, "a", "ana").state;
    s = guessLetter(s, "p", "luis").state;
    s = guessLetter(s, "t", "ana").state;
    expect(creditRanking(s)).toEqual([
      { playerId: "ana", letters: 2 },
      { playerId: "luis", letters: 1 },
    ]);
  });

  it("un fallo no da merito a nadie", () => {
    const s = guessLetter(startHangman("gato"), "z", "ana").state;
    expect(creditRanking(s)).toEqual([]);
  });

  it("lista las letras falladas para no repetirlas", () => {
    let s = startHangman("gato");
    s = guessLetter(s, "z", "ana").state;
    s = guessLetter(s, "g", "ana").state;
    expect(missedLetters(s)).toEqual(["Z"]);
  });
});

describe("carita", () => {
  it("empeora con los fallos", () => {
    const s = startHangman("gato");
    expect(renderGallows(s)).toBe("😀");
    expect(renderGallows({ ...s, misses: MAX_MISSES })).toBe("💀");
  });

  it("no se sale del rango con un estado corrupto", () => {
    expect(renderGallows({ ...startHangman("gato"), misses: 99 })).toBe("💀");
  });
});

describe("validacion de estado guardado", () => {
  it("acepta uno bueno", () => {
    expect(isValidHangmanState(startHangman("gato"))).toBe(true);
  });

  it.each([
    null,
    undefined,
    {},
    { word: "", guessed: [], credits: {}, misses: 0 },
    { word: "GATO", guessed: "no-es-lista", credits: {}, misses: 0 },
    { word: "GATO", guessed: [], credits: {}, misses: -1 },
    { word: "GATO", guessed: [], credits: null, misses: 0 },
  ])("rechaza %s", (value) => {
    expect(isValidHangmanState(value)).toBe(false);
  });
});
