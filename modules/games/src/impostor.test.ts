import { describe, expect, it } from "vitest";
import {
  aliveOf,
  closeRound,
  dealRoles,
  type ImpostorState,
  isValidImpostorState,
  leaveMatch,
  MAX_PLAYERS,
  MIN_PLAYERS,
  submitClue,
  submitVote,
  tallyVotes,
  WORD_PAIRS,
} from "./impostor.js";

const PAIR = { crew: "playa", impostor: "piscina" };
const CUATRO = ["a", "b", "c", "d"];

const repartir = (ids = CUATRO, seed = 7) => {
  const dealt = dealRoles(ids, PAIR, seed);
  if (!dealt) {
    throw new Error("el reparto deberia haber funcionado");
  }
  return dealt;
};

/** Todos sueltan una pista para llegar a la votacion. */
const pistasDeTodos = (
  state: ImpostorState,
  alive: readonly string[],
): ImpostorState => {
  let s = state;
  for (const id of alive) {
    const r = submitClue(s, id, `pista-${id}`, alive, PAIR.crew);
    if (!r.ok) {
      throw new Error(`pista rechazada: ${r.error}`);
    }
    s = r.state;
  }
  return s;
};

describe("reparto", () => {
  it("da la palabra del grupo a todos menos a uno", () => {
    const { state, secrets } = repartir();
    const impostores = [...secrets.values()].filter(
      (s) => s.role === "impostor",
    );
    expect(impostores).toHaveLength(1);
    expect(impostores[0]?.word).toBe(PAIR.impostor);
    expect(secrets.size).toBe(CUATRO.length);
    expect(secrets.get(state.impostorId)?.role).toBe("impostor");
  });

  it("al impostor le da una palabra, no lo deja con las manos vacias", () => {
    // Sin palabra no puede decir nada concreto y cae en la primera ronda.
    const { state, secrets } = repartir();
    expect(secrets.get(state.impostorId)?.word).toBeTruthy();
    expect(secrets.get(state.impostorId)?.word).not.toBe(PAIR.crew);
  });

  it("la misma semilla reparte igual", () => {
    expect(repartir(CUATRO, 42).state.impostorId).toBe(
      repartir(CUATRO, 42).state.impostorId,
    );
  });

  it("semillas distintas no siempre señalan al mismo asiento", () => {
    const elegidos = new Set(
      Array.from(
        { length: 40 },
        (_, i) => repartir(CUATRO, i).state.impostorId,
      ),
    );
    expect(elegidos.size).toBeGreaterThan(1);
  });

  it("rechaza mesas demasiado pequeñas o demasiado grandes", () => {
    const pocos = Array.from({ length: MIN_PLAYERS - 1 }, (_, i) => `p${i}`);
    const muchos = Array.from({ length: MAX_PLAYERS + 1 }, (_, i) => `p${i}`);
    expect(dealRoles(pocos, PAIR, 1)).toBeNull();
    expect(dealRoles(muchos, PAIR, 1)).toBeNull();
  });

  it("rechaza una lista con alguien repetido", () => {
    // Dos asientos de la misma persona darian dos votos a una sola cabeza.
    expect(dealRoles(["a", "b", "c", "a"], PAIR, 1)).toBeNull();
  });
});

describe("pistas", () => {
  it("pasa a votacion cuando han hablado todos", () => {
    const { state } = repartir();
    const s = pistasDeTodos(state, CUATRO);
    expect(s.phase).toBe("voting");
  });

  it("no deja hablar dos veces", () => {
    const { state } = repartir();
    const uno = submitClue(state, "a", "sol", CUATRO, PAIR.crew);
    if (!uno.ok) {
      throw new Error("la primera pista deberia valer");
    }
    expect(submitClue(uno.state, "a", "otra", CUATRO, PAIR.crew)).toEqual({
      ok: false,
      error: "already-said",
    });
  });

  it("no deja hablar a quien no juega", () => {
    const { state } = repartir();
    expect(submitClue(state, "z", "sol", CUATRO, PAIR.crew)).toEqual({
      ok: false,
      error: "not-playing",
    });
  });

  it("exige UNA palabra", () => {
    // Una frase permite describir la palabra secreta entera.
    const { state } = repartir();
    expect(submitClue(state, "a", "arena y sol", CUATRO, PAIR.crew)).toEqual({
      ok: false,
      error: "too-many-words",
    });
    expect(submitClue(state, "a", "   ", CUATRO, PAIR.crew)).toEqual({
      ok: false,
      error: "empty",
    });
  });

  it("no deja soltar la palabra secreta como pista", () => {
    // Decirla le regala al impostor justo lo que le falta.
    const { state } = repartir();
    expect(submitClue(state, "a", "PLAYA", CUATRO, PAIR.crew)).toEqual({
      ok: false,
      error: "gives-it-away",
    });
  });

  it("no admite pistas mientras se vota", () => {
    const { state } = repartir();
    const s = pistasDeTodos(state, CUATRO);
    expect(submitClue(s, "a", "sol", CUATRO, PAIR.crew)).toEqual({
      ok: false,
      error: "wrong-phase",
    });
  });
});

describe("votos", () => {
  const enVotacion = () => {
    const { state } = repartir();
    return pistasDeTodos(state, CUATRO);
  };

  it("no deja votarse a uno mismo", () => {
    // Es la forma de saltarse la ronda sin señalar a nadie.
    expect(submitVote(enVotacion(), "a", "a", CUATRO)).toEqual({
      ok: false,
      error: "self-vote",
    });
  });

  it("no deja votar dos veces", () => {
    const primero = submitVote(enVotacion(), "a", "b", CUATRO);
    if (!primero.ok) {
      throw new Error("el primer voto deberia valer");
    }
    expect(submitVote(primero.state, "a", "c", CUATRO)).toEqual({
      ok: false,
      error: "already-voted",
    });
  });

  it("no deja votar a un eliminado", () => {
    const s = { ...enVotacion(), eliminated: ["d"] };
    expect(submitVote(s, "a", "d", ["a", "b", "c"])).toEqual({
      ok: false,
      error: "target-not-playing",
    });
  });

  it("avisa cuando han votado todos", () => {
    let s = enVotacion();
    const pares: [string, string][] = [
      ["a", "b"],
      ["b", "a"],
      ["c", "b"],
      ["d", "b"],
    ];
    let complete = false;
    for (const [votante, votado] of pares) {
      const r = submitVote(s, votante, votado, CUATRO);
      if (!r.ok) {
        throw new Error(`voto rechazado: ${r.error}`);
      }
      s = r.state;
      complete = r.complete;
    }
    expect(complete).toBe(true);
    expect(tallyVotes(s).eliminated).toBe("b");
  });
});

describe("cierre de ronda", () => {
  const conVotos = (votes: Record<string, string>): ImpostorState => ({
    phase: "voting",
    round: 1,
    impostorId: "d",
    clues: {},
    votes,
    eliminated: [],
    result: null,
  });

  it("el empate no elimina a nadie y abre otra ronda", () => {
    // Si el empate sacase a alguien por sorteo, al impostor le bastaria con
    // provocar empates para sobrevivir gratis.
    const out = closeRound(
      conVotos({ a: "b", b: "a", c: "d", d: "c" }),
      CUATRO,
    );
    expect(out.tally.eliminated).toBeNull();
    expect(out.tally.tied).toHaveLength(4);
    expect(out.finished).toBe(false);
    expect(out.state.round).toBe(2);
    expect(out.state.eliminated).toEqual([]);
    expect(out.state.phase).toBe("clues");
  });

  it("limpia pistas y votos al abrir ronda nueva", () => {
    const s = { ...conVotos({ a: "b", b: "a" }), clues: { a: "sol" } };
    const out = closeRound(s, CUATRO);
    expect(out.state.clues).toEqual({});
    expect(out.state.votes).toEqual({});
  });

  it("gana el grupo si cae el impostor", () => {
    const out = closeRound(conVotos({ a: "d", b: "d", c: "d" }), CUATRO);
    expect(out.finished).toBe(true);
    expect(out.state.result).toBe("crew");
  });

  it("gana el impostor cuando quedan dos y sigue dentro", () => {
    const s: ImpostorState = {
      ...conVotos({ a: "b", c: "b", d: "b" }),
      eliminated: [],
    };
    // Cae "b" y quedan a, c, d... todavia tres: sigue.
    const primera = closeRound(s, CUATRO);
    expect(primera.finished).toBe(false);

    const segunda = closeRound(
      { ...primera.state, phase: "voting", votes: { a: "c", d: "c" } },
      ["a", "c", "d"],
    );
    expect(segunda.finished).toBe(true);
    expect(segunda.state.result).toBe("impostor");
  });
});

describe("abandonos", () => {
  const base: ImpostorState = {
    phase: "clues",
    round: 1,
    impostorId: "d",
    clues: { a: "sol" },
    votes: {},
    eliminated: [],
    result: null,
  };

  it("irse siendo el impostor no salva la partida: gana el grupo", () => {
    const s = leaveMatch(base, "d", CUATRO);
    expect(s.result).toBe("crew");
  });

  it("se lleva sus pistas y su voto al irse", () => {
    // Si se quedaran, la ronda esperaria para siempre a alguien que ya no esta.
    const s = leaveMatch(base, "a", CUATRO);
    expect(s.clues).toEqual({});
    expect(s.eliminated).toEqual(["a"]);
  });

  it("si al irse quedan dos, gana el impostor", () => {
    const s = leaveMatch({ ...base, eliminated: ["c"] }, "a", ["a", "b", "d"]);
    expect(s.result).toBe("impostor");
  });

  it("una partida acabada no cambia porque alguien se vaya", () => {
    const fin: ImpostorState = { ...base, phase: "finished", result: "crew" };
    expect(leaveMatch(fin, "a", CUATRO)).toEqual(fin);
  });
});

describe("utilidades", () => {
  it("aliveOf quita a los eliminados y conserva el orden", () => {
    const s: ImpostorState = {
      phase: "clues",
      round: 2,
      impostorId: "d",
      clues: {},
      votes: {},
      eliminated: ["b"],
      result: null,
    };
    expect(aliveOf(s, CUATRO)).toEqual(["a", "c", "d"]);
  });

  it("las parejas de palabras son vecinas y sin repetir", () => {
    const vistas = new Set<string>();
    for (const p of WORD_PAIRS) {
      expect(p.crew).not.toBe(p.impostor);
      expect(vistas.has(p.crew)).toBe(false);
      vistas.add(p.crew);
    }
    expect(WORD_PAIRS.length).toBeGreaterThanOrEqual(10);
  });
});

describe("validacion de estado guardado", () => {
  it("acepta uno bueno", () => {
    expect(isValidImpostorState(repartir().state)).toBe(true);
  });

  it.each([
    null,
    undefined,
    {},
    {
      phase: "otra",
      round: 1,
      impostorId: "d",
      clues: {},
      votes: {},
      eliminated: [],
    },
    {
      phase: "clues",
      round: 0,
      impostorId: "d",
      clues: {},
      votes: {},
      eliminated: [],
    },
    {
      phase: "clues",
      round: 1,
      impostorId: "",
      clues: {},
      votes: {},
      eliminated: [],
    },
    {
      phase: "clues",
      round: 1,
      impostorId: "d",
      clues: {},
      votes: {},
      eliminated: "no",
    },
  ])("rechaza %s", (value) => {
    expect(isValidImpostorState(value)).toBe(false);
  });
});
