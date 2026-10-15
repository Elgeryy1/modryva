import { describe, expect, it } from "vitest";
import { makeRng, pickOne, seedFrom, shuffle } from "./seeded-shuffle.js";

const BARAJA = Array.from({ length: 20 }, (_, i) => i);

describe("makeRng", () => {
  it("la misma semilla da la misma serie", () => {
    const a = makeRng(99);
    const b = makeRng(99);
    const serieA = Array.from({ length: 10 }, () => a.nextInt(100));
    const serieB = Array.from({ length: 10 }, () => b.nextInt(100));
    expect(serieA).toEqual(serieB);
  });

  it("semillas distintas dan series distintas", () => {
    const a = Array.from({ length: 10 }, (_, i) => makeRng(i).nextInt(1000));
    expect(new Set(a).size).toBeGreaterThan(1);
  });

  it("se queda dentro del rango", () => {
    const rng = makeRng(3);
    for (let i = 0; i < 500; i += 1) {
      const n = rng.nextInt(7);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(7);
    }
  });

  it("no revienta con un maximo absurdo", () => {
    const rng = makeRng(1);
    expect(rng.nextInt(0)).toBe(0);
    expect(rng.nextInt(-5)).toBe(0);
    expect(rng.nextInt(Number.NaN)).toBe(0);
  });

  it("una semilla rara no rompe nada", () => {
    expect(makeRng(Number.NaN).nextInt(10)).toBeGreaterThanOrEqual(0);
    expect(makeRng(1.7).nextInt(10)).toBeGreaterThanOrEqual(0);
  });
});

describe("seedFrom", () => {
  it("el mismo texto da la misma semilla", () => {
    expect(seedFrom("partida-abc")).toBe(seedFrom("partida-abc"));
  });

  it("textos distintos dan semillas distintas", () => {
    expect(seedFrom("partida-abc")).not.toBe(seedFrom("partida-abd"));
  });

  it("el texto vacio tambien vale", () => {
    expect(Number.isInteger(seedFrom(""))).toBe(true);
  });
});

describe("shuffle", () => {
  it("no toca la lista original", () => {
    const original = [...BARAJA];
    shuffle(BARAJA, makeRng(1));
    expect(BARAJA).toEqual(original);
  });

  it("conserva todos los elementos", () => {
    const mezclada = shuffle(BARAJA, makeRng(5));
    expect([...mezclada].sort((a, b) => a - b)).toEqual(BARAJA);
  });

  it("realmente mezcla", () => {
    expect(shuffle(BARAJA, makeRng(5))).not.toEqual(BARAJA);
  });

  it("la misma semilla mezcla igual", () => {
    expect(shuffle(BARAJA, makeRng(8))).toEqual(shuffle(BARAJA, makeRng(8)));
  });

  it("reparte las posiciones sin cebarse con un asiento", () => {
    // Esta es la prueba que caza el Fisher-Yates mal hecho: la version
    // "hacia delante" sesga, y en un juego social eso significa que al mismo
    // asiento le toca impostor mucho mas a menudo que al resto.
    const veces = new Array(4).fill(0);
    for (let seed = 0; seed < 4000; seed += 1) {
      const primero = shuffle([0, 1, 2, 3], makeRng(seed))[0] as number;
      veces[primero] += 1;
    }
    for (const n of veces) {
      // Con reparto perfecto serian 1000 cada uno; se deja holgura de +-25 %.
      expect(n).toBeGreaterThan(750);
      expect(n).toBeLessThan(1250);
    }
  });

  it("una lista vacia o de uno no se rompe", () => {
    expect(shuffle([], makeRng(1))).toEqual([]);
    expect(shuffle(["x"], makeRng(1))).toEqual(["x"]);
  });
});

describe("pickOne", () => {
  it("saca algo de la lista", () => {
    expect(BARAJA).toContain(pickOne(BARAJA, makeRng(2)));
  });

  it("de una lista vacia no saca nada", () => {
    expect(pickOne([], makeRng(2))).toBeNull();
  });
});
