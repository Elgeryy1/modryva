import { InMemoryGameMatchRepository } from "@superbot/data";
import { groupWordle } from "@superbot/module-games";
import { beforeEach, describe, expect, it } from "vitest";
import { renderWordleChat, WordleService } from "./wordle.service.js";

/**
 * El wordle del grupo, ahora tecleado desde la Mini App.
 *
 * Lo que hay que poder afirmar: que la respuesta NO viaja mientras se juega
 * (quien abriera las herramientas del navegador se la leeria y se acabo el
 * juego para todos), y que las dos reglas de convivencia siguen puestas en el
 * servidor y no en la pantalla.
 */

const TENANT = "t1";
const ANSWER = "MOTOR";

let service: WordleService;
let matches: InMemoryGameMatchRepository;
let matchId: string;

const montar = async () => {
  matches = new InMemoryGameMatchRepository();
  service = new WordleService(matches);
  const state = groupWordle.startWordle(ANSWER);
  if (!state) {
    throw new Error("no se pudo abrir");
  }
  const match = await matches.create({
    tenantId: TENANT,
    chatId: -100n,
    game: "wordle",
    hostId: 1n,
    hostName: "Ana",
    state,
  });
  matchId = match.id;
};

beforeEach(montar);

/** Un intento, leyendo la version del tablero justo antes. */
const probar = async (userId: string, palabra: string) => {
  const antes = await service.table(userId, matchId);
  return service.guess(userId, matchId, palabra, antes.version);
};

describe("la respuesta", () => {
  it("NO viaja mientras se juega", async () => {
    const view = await service.table("1", matchId);
    expect(view.answer).toBeNull();
    expect(JSON.stringify(view)).not.toContain(ANSWER);
  });

  it("sigue sin viajar despues de fallar un intento", async () => {
    const view = await probar("1", "CASAS");
    expect(view.answer).toBeNull();
    expect(JSON.stringify(view)).not.toContain(ANSWER);
  });

  it("solo aparece cuando la partida ha terminado", async () => {
    let view = await service.table("1", matchId);
    // Seis intentos fallidos, alternando personas para no chocar con la regla
    // de no acaparar.
    const fallos = ["CASAS", "PERRO", "LIMON", "SALTO", "VERDE", "PLAZA"];
    for (const [i, palabra] of fallos.entries()) {
      view = await probar(String((i % 3) + 1), palabra);
    }
    expect(view.finished).toBe(true);
    expect(view.solved).toBe(false);
    expect(view.answer).toBe(ANSWER);
  });

  it("acertar termina la partida y la destapa", async () => {
    const view = await probar("1", ANSWER);
    expect(view.solved).toBe(true);
    expect(view.finished).toBe(true);
    expect(view.answer).toBe(ANSWER);
  });
});

describe("las reglas viven en el servidor", () => {
  it("no se repite una palabra ya probada", async () => {
    await probar("1", "CASAS");
    await expect(probar("2", "casas")).rejects.toMatchObject({
      response: { error: "already-tried" },
    });
  });

  it("nadie encadena mas de dos intentos seguidos", async () => {
    // Sin esto, el primero que este mirando el movil se ventila los seis.
    await probar("1", "CASAS");
    await probar("1", "PERRO");
    await expect(probar("1", "LIMON")).rejects.toMatchObject({
      response: { error: "hogging" },
    });
  });

  it("el bloqueo se cuenta por persona, no por partida", async () => {
    await probar("1", "CASAS");
    await probar("1", "PERRO");
    const otro = await probar("2", "LIMON");
    expect(otro.attemptsLeft).toBe(3);
  });

  it("el tablero dice si puedes tirar y por que no", async () => {
    // En el chat esto era un mensaje que se perdia entre lo demas; en pantalla
    // tiene que poder pintarse el teclado bloqueado.
    await probar("1", "CASAS");
    await probar("1", "PERRO");

    const bloqueada = await service.table("1", matchId);
    expect(bloqueada.canGuess).toBe(false);
    expect(bloqueada.blockedReason).toBe("hogging");

    const libre = await service.table("2", matchId);
    expect(libre.canGuess).toBe(true);
    expect(libre.blockedReason).toBeNull();
  });

  it("una pantalla vieja no tira sobre un tablero que ya cambio", async () => {
    const vieja = await service.table("1", matchId);
    await probar("2", "CASAS");
    await expect(
      service.guess("1", matchId, "PERRO", vieja.version),
    ).rejects.toMatchObject({ response: { error: "stale-board" } });
  });
});

describe("el teclado", () => {
  it("una letra verde no se pinta gris aunque salga gris en otra posicion", async () => {
    // "CASAS" contra "MOTOR": no hay repetidas utiles, asi que se comprueba el
    // caso directamente sobre el motor con una palabra que si las tiene.
    const state = groupWordle.startWordle("CASAS");
    if (!state) {
      throw new Error("no se pudo abrir");
    }
    const res = groupWordle.submitGuess(state, "SALAS", "1");
    if (!res.ok) {
      throw new Error("el intento deberia valer");
    }
    // Pintar la S de gris le diria al grupo que la descarte, y esta dentro.
    expect(groupWordle.letterMarks(res.state).S).not.toBe("miss");
  });
});

describe("el tablero del chat", () => {
  it("no destapa la respuesta mientras se juega", async () => {
    const state = groupWordle.startWordle(ANSWER);
    if (!state) {
      throw new Error("no se pudo abrir");
    }
    const res = groupWordle.submitGuess(state, "CASAS", "1");
    if (!res.ok) {
      throw new Error("el intento deberia valer");
    }
    const texto = renderWordleChat(res.state);
    expect(texto).not.toContain(ANSWER);
    // El tablero pinta las letras separadas, para que se alineen con los
    // cuadrados de arriba. Lo que importa es que la palabra probada SI se ve:
    // sin ella el tablero del chat no le dice nada a quien no abre la pantalla.
    expect(texto).toContain("C A S A S");
  });

  it("la destapa al terminar", async () => {
    const state = groupWordle.startWordle(ANSWER);
    if (!state) {
      throw new Error("no se pudo abrir");
    }
    const res = groupWordle.submitGuess(state, ANSWER, "1");
    if (!res.ok) {
      throw new Error("el intento deberia valer");
    }
    expect(renderWordleChat(res.state)).toContain(ANSWER);
  });
});
