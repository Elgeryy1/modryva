import { describe, expect, it } from "vitest";
import {
  buildDeck,
  type Card,
  COLORS,
  type ColorCardsState,
  colorOf,
  drawCards,
  faceOf,
  HAND_SIZE,
  handSizes,
  isPlayable,
  isValidColorCardsState,
  isWild,
  MAX_PLAYERS,
  mergeState,
  nextSeat,
  playableCards,
  playCard,
  publicView,
  removeSeat,
  renderCard,
  splitState,
  startGame,
  topCard,
} from "./color-cards.js";

/** Estado a medida, para probar una regla sin depender del reparto. */
const mesa = (over: Partial<ColorCardsState> = {}): ColorCardsState => ({
  hands: { 0: ["R5"], 1: ["B7"], 2: ["G3"] },
  deck: ["Y1", "Y2", "Y3", "Y4", "Y5", "Y6"],
  discard: ["R2"],
  activeColor: "R",
  turnSeat: 0,
  direction: 1,
  pendingDraw: 0,
  seats: [0, 1, 2],
  finished: false,
  winner: null,
  ...over,
});

describe("baraja", () => {
  it("tiene 108 cartas", () => {
    // 4 colores x (un 0 + dos de cada 1-9 + dos de cada figura) + 8 comodines.
    expect(buildDeck()).toHaveLength(108);
  });

  it("un solo cero por color y dos de cada numero", () => {
    const deck = buildDeck();
    expect(deck.filter((c) => c === "R0")).toHaveLength(1);
    expect(deck.filter((c) => c === "R5")).toHaveLength(2);
  });

  it("dos de cada figura por color: si no, casi no salen", () => {
    const deck = buildDeck();
    for (const figura of ["s", "r", "d"]) {
      expect(deck.filter((c) => c === `R${figura}`)).toHaveLength(2);
    }
  });

  it("cuatro comodines de cada tipo", () => {
    const deck = buildDeck();
    expect(deck.filter((c) => c === "W")).toHaveLength(4);
    expect(deck.filter((c) => c === "W4")).toHaveLength(4);
  });

  it("lee color y figura de cualquier carta", () => {
    expect(colorOf("R5")).toBe("R");
    expect(colorOf("W4")).toBeNull();
    expect(faceOf("Gs")).toBe("s");
    expect(faceOf("W")).toBe("W");
    expect(isWild("W4")).toBe(true);
    expect(isWild("B9")).toBe(false);
  });
});

describe("reparto", () => {
  it("da siete cartas a cada uno", () => {
    const s = startGame([0, 1, 2], 5);
    expect(s).not.toBeNull();
    for (const seat of [0, 1, 2]) {
      expect(s?.hands[seat]).toHaveLength(HAND_SIZE);
    }
  });

  it("la primera carta de la mesa nunca es un comodin", () => {
    // Habria que elegir color antes de que nadie haya jugado.
    for (let seed = 0; seed < 60; seed += 1) {
      const s = startGame([0, 1, 2], seed);
      expect(isWild(topCard(s as ColorCardsState))).toBe(false);
    }
  });

  it("el color activo sale de esa primera carta", () => {
    const s = startGame([0, 1], 3) as ColorCardsState;
    expect(s.activeColor).toBe(colorOf(topCard(s)));
  });

  it("la misma semilla reparte igual", () => {
    expect(startGame([0, 1, 2], 11)).toEqual(startGame([0, 1, 2], 11));
  });

  it("rechaza mesas imposibles", () => {
    expect(startGame([0], 1)).toBeNull();
    expect(startGame([0, 0, 1], 1)).toBeNull();
    const demasiados = Array.from({ length: MAX_PLAYERS + 1 }, (_, i) => i);
    expect(startGame(demasiados, 1)).toBeNull();
  });
});

describe("que se puede tirar", () => {
  it("vale el mismo color", () => {
    expect(isPlayable(mesa(), "R9")).toBe(true);
  });

  it("vale la misma figura aunque cambie el color", () => {
    expect(isPlayable(mesa(), "G2")).toBe(true);
  });

  it("no vale ni color ni figura distintos", () => {
    expect(isPlayable(mesa(), "G7")).toBe(false);
  });

  it("el comodin vale siempre", () => {
    expect(isPlayable(mesa(), "W")).toBe(true);
    expect(isPlayable(mesa(), "W4")).toBe(true);
  });

  it("manda el color elegido, no el de la carta de arriba", () => {
    // Tras un comodin, la carta de la mesa sigue siendo el comodin.
    const s = mesa({ discard: ["R2", "W"], activeColor: "G" });
    expect(isPlayable(s, "G1")).toBe(true);
    expect(isPlayable(s, "R1")).toBe(false);
  });

  it("con castigo pendiente solo se encadena la misma figura", () => {
    // Si un +2 tapase un +4, el castigo grande no valdria mas que el pequeño.
    const s = mesa({ discard: ["R2", "Rd"], pendingDraw: 2 });
    expect(isPlayable(s, "Gd")).toBe(true);
    expect(isPlayable(s, "R5")).toBe(false);
    expect(isPlayable(s, "W")).toBe(false);
    expect(isPlayable(s, "W4")).toBe(false);
  });

  it("un +4 solo lo tapa otro +4", () => {
    const s = mesa({ discard: ["R2", "W4"], pendingDraw: 4, activeColor: "R" });
    expect(isPlayable(s, "W4")).toBe(true);
    expect(isPlayable(s, "Rd")).toBe(false);
  });

  it("solo ofrece de la mano lo que se puede tirar", () => {
    const s = mesa({ hands: { 0: ["R9", "G7", "W"] } });
    expect(playableCards(s, 0)).toEqual(["R9", "W"]);
  });
});

describe("tirar", () => {
  it("no deja tirar fuera de turno", () => {
    expect(playCard(mesa(), 1, "B7")).toEqual({
      ok: false,
      error: "not-your-turn",
    });
  });

  it("no deja tirar una carta que no se tiene", () => {
    expect(playCard(mesa(), 0, "R9")).toEqual({
      ok: false,
      error: "not-in-hand",
    });
  });

  it("no deja tirar algo que no pega", () => {
    const s = mesa({ hands: { 0: ["G7"] } });
    expect(playCard(s, 0, "G7")).toEqual({ ok: false, error: "not-playable" });
  });

  it("pasa el turno al siguiente", () => {
    // Con dos cartas en la mano: tirar la ultima acaba la partida y entonces
    // el turno ya no avanza, que es otro caso distinto.
    const r = playCard(mesa({ hands: { 0: ["R5", "R6"] } }), 0, "R5");
    expect(r).toMatchObject({ ok: true });
    if (r.ok) {
      expect(r.state.turnSeat).toBe(1);
      expect(r.state.hands[0]).toEqual(["R6"]);
    }
  });

  it("quedarse sin cartas gana", () => {
    const r = playCard(mesa(), 0, "R5");
    if (!r.ok) {
      throw new Error("deberia valer");
    }
    expect(r.state.finished).toBe(true);
    expect(r.state.winner).toBe(0);
  });

  it("una partida acabada no admite mas tiradas", () => {
    const s = mesa({ finished: true });
    expect(playCard(s, 0, "R5")).toEqual({ ok: false, error: "match-over" });
  });
});

describe("comodines", () => {
  it("exige elegir color", () => {
    // Que lo eligiese el servidor convierte la mejor carta en una tirada
    // al azar.
    const s = mesa({ hands: { 0: ["W", "R1"] } });
    expect(playCard(s, 0, "W")).toEqual({ ok: false, error: "color-required" });
  });

  it("rechaza un color inventado", () => {
    const s = mesa({ hands: { 0: ["W", "R1"] } });
    expect(playCard(s, 0, "W", "X" as never)).toEqual({
      ok: false,
      error: "bad-color",
    });
  });

  it("el color elegido pasa a mandar", () => {
    const s = mesa({ hands: { 0: ["W", "R1"] } });
    const r = playCard(s, 0, "W", "G");
    if (!r.ok) {
      throw new Error("deberia valer");
    }
    expect(r.state.activeColor).toBe("G");
  });

  it("el +4 acumula castigo", () => {
    const s = mesa({ hands: { 0: ["W4", "R1"] } });
    const r = playCard(s, 0, "W4", "B");
    if (!r.ok) {
      throw new Error("deberia valer");
    }
    expect(r.state.pendingDraw).toBe(4);
    expect(r.state.turnSeat).toBe(1);
  });
});

describe("figuras", () => {
  it("salta se come un turno", () => {
    const s = mesa({ hands: { 0: ["Rs", "R1"] } });
    const r = playCard(s, 0, "Rs");
    if (!r.ok) {
      throw new Error("deberia valer");
    }
    expect(r.state.turnSeat).toBe(2);
  });

  it("cambio de sentido invierte el orden", () => {
    const s = mesa({ hands: { 0: ["Rr", "R1"] } });
    const r = playCard(s, 0, "Rr");
    if (!r.ok) {
      throw new Error("deberia valer");
    }
    expect(r.state.direction).toBe(-1);
    expect(r.state.turnSeat).toBe(2);
  });

  it("con dos jugadores el cambio de sentido actua como salta", () => {
    // Si no, seria una carta que no hace nada en la mesa mas comun.
    const s = mesa({
      seats: [0, 1],
      hands: { 0: ["Rr", "R1"], 1: ["B7"] },
    });
    const r = playCard(s, 0, "Rr");
    if (!r.ok) {
      throw new Error("deberia valer");
    }
    expect(r.state.turnSeat).toBe(0);
  });

  it("los +2 se encadenan", () => {
    const s = mesa({
      hands: { 0: ["Rd", "R1"], 1: ["Gd", "B7"] },
      pendingDraw: 0,
    });
    const primero = playCard(s, 0, "Rd");
    if (!primero.ok) {
      throw new Error("deberia valer");
    }
    expect(primero.state.pendingDraw).toBe(2);

    const segundo = playCard(primero.state, 1, "Gd");
    if (!segundo.ok) {
      throw new Error("deberia valer");
    }
    expect(segundo.state.pendingDraw).toBe(4);
  });
});

describe("robar", () => {
  it("sin castigo se roba una y se pasa turno", () => {
    const r = drawCards(mesa(), 0, 1);
    if (!r.ok) {
      throw new Error("deberia valer");
    }
    expect(r.drawn).toHaveLength(1);
    expect(r.state.hands[0]).toHaveLength(2);
    expect(r.state.turnSeat).toBe(1);
  });

  it("con castigo se roban todas las acumuladas", () => {
    const r = drawCards(mesa({ pendingDraw: 4 }), 0, 1);
    if (!r.ok) {
      throw new Error("deberia valer");
    }
    expect(r.drawn).toHaveLength(4);
    expect(r.state.pendingDraw).toBe(0);
  });

  it("no deja robar fuera de turno", () => {
    expect(drawCards(mesa(), 2, 1)).toEqual({
      ok: false,
      error: "not-your-turn",
    });
  });

  it("cuando se acaba el monton se recicla lo tirado", () => {
    // Sin esto, una partida larga se queda sin cartas y se bloquea.
    const s = mesa({ deck: [], discard: ["R2", "R3", "R4", "G1"] });
    const r = drawCards(s, 0, 9);
    if (!r.ok) {
      throw new Error("deberia valer");
    }
    expect(r.drawn).toHaveLength(1);
    // La de arriba se queda en la mesa: es a lo que se juega.
    expect(r.state.discard).toEqual(["G1"]);
    expect(r.state.deck.length).toBe(2);
  });

  it("sin cartas en ningun sitio no se bloquea", () => {
    const s = mesa({ deck: [], discard: ["R2"], pendingDraw: 4 });
    const r = drawCards(s, 0, 1);
    if (!r.ok) {
      throw new Error("deberia valer");
    }
    expect(r.drawn).toEqual([]);
    expect(r.state.turnSeat).toBe(1);
  });
});

describe("abandonos", () => {
  it("sus cartas vuelven al monton", () => {
    // Si se esfumasen, no quedaria baraja para terminar la partida.
    const s = mesa({ hands: { 0: ["R5"], 1: ["B7", "B8"], 2: ["G3"] } });
    const out = removeSeat(s, 1);
    expect(out.seats).toEqual([0, 2]);
    expect(out.deck).toContain("B7");
    expect(out.hands[1]).toBeUndefined();
  });

  it("si el que se va tenia el turno, pasa al siguiente", () => {
    const out = removeSeat(mesa({ turnSeat: 1 }), 1);
    expect(out.turnSeat).toBe(2);
  });

  it("quedarse solo es ganar", () => {
    const s = mesa({ seats: [0, 1], hands: { 0: ["R5"], 1: ["B7"] } });
    const out = removeSeat(s, 1);
    expect(out.finished).toBe(true);
    expect(out.winner).toBe(0);
  });

  it("irse de una partida acabada no cambia nada", () => {
    const s = mesa({ finished: true });
    expect(removeSeat(s, 1)).toEqual(s);
  });
});

describe("turnos", () => {
  it("da la vuelta a la mesa", () => {
    const s = mesa();
    expect(nextSeat(s, 2)).toBe(0);
    expect(nextSeat({ ...s, direction: -1 }, 0)).toBe(2);
  });
});

describe("lo que ve la mesa", () => {
  it("la vista publica no lleva ninguna mano ni el monton", () => {
    // Enseñar el orden del monton es enseñar todas las cartas que van a salir.
    const v = publicView(mesa());
    expect(v).not.toHaveProperty("hands");
    expect(v).not.toHaveProperty("deck");
    expect(v.deckSize).toBe(6);
    expect(v.handSizes).toEqual({ 0: 1, 1: 1, 2: 1 });
  });

  it("cuenta cartas por asiento", () => {
    const s = mesa({ hands: { 0: ["R5", "R6"], 1: [], 2: ["G3"] } });
    expect(handSizes(s)).toEqual({ 0: 2, 1: 0, 2: 1 });
  });

  it("partir y volver a juntar devuelve lo mismo", () => {
    const s = mesa();
    const { shared, hands } = splitState(s);
    expect(shared).not.toHaveProperty("hands");
    expect(mergeState(shared, hands)).toEqual(s);
  });

  it("las cartas se leen en cristiano", () => {
    expect(renderCard("R5")).toContain("5");
    expect(renderCard("Gs")).toContain("salta");
    expect(renderCard("Bd")).toContain("+2");
    expect(renderCard("Yr")).toContain("cambio");
    expect(renderCard("W4")).toContain("+4");
    expect(renderCard("W")).toContain("comodín");
  });
});

describe("validacion de estado guardado", () => {
  it("acepta uno bueno", () => {
    expect(isValidColorCardsState(mesa())).toBe(true);
  });

  it.each([
    null,
    undefined,
    {},
    { ...mesa(), discard: [] },
    { ...mesa(), activeColor: "X" },
    { ...mesa(), direction: 0 },
    { ...mesa(), pendingDraw: -1 },
    { ...mesa(), seats: [] },
  ])("rechaza un estado corrupto", (value) => {
    expect(isValidColorCardsState(value)).toBe(false);
  });

  it("los colores son exactamente cuatro", () => {
    expect(COLORS).toHaveLength(4);
  });
});

describe("una partida entera", () => {
  it("termina con alguien sin cartas y sin dejar de cuadrar", () => {
    let state = startGame([0, 1, 2], 4) as ColorCardsState;
    expect(state).not.toBeNull();

    const CARTAS_INICIALES =
      buildDeck().length; /* todas las cartas siguen existiendo */

    for (let turno = 0; turno < 600 && !state.finished; turno += 1) {
      const seat = state.turnSeat;
      const opciones = playableCards(state, seat);
      const carta = opciones[0] as Card | undefined;
      if (carta === undefined) {
        const r = drawCards(state, seat, turno);
        if (!r.ok) {
          throw new Error(`robo rechazado: ${r.error}`);
        }
        state = r.state;
        continue;
      }
      const r = playCard(state, seat, carta, "R");
      if (!r.ok) {
        throw new Error(`tirada rechazada: ${r.error}`);
      }
      state = r.state;

      // Ninguna carta se pierde ni se duplica por el camino.
      const total =
        state.deck.length +
        state.discard.length +
        Object.values(state.hands).reduce((n, m) => n + m.length, 0);
      expect(total).toBe(CARTAS_INICIALES);
    }

    expect(state.finished).toBe(true);
    expect(state.hands[state.winner as number]).toEqual([]);
  });
});
