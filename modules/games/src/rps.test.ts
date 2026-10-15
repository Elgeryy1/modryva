import { describe, expect, it } from "vitest";
import {
  forfeit,
  isValidRpsState,
  parseThrow,
  publicRound,
  type RpsState,
  renderScore,
  startRps,
  submitThrow,
  THROWS,
  type Throw,
  winnerOf,
} from "./rps.js";

/** Juega una ronda entera y devuelve el estado resultante. */
const ronda = (state: RpsState, host: Throw, guest: Throw): RpsState => {
  const uno = submitThrow(state, "host", host);
  if (!uno.ok) {
    throw new Error(`tirada rechazada: ${uno.error}`);
  }
  const dos = submitThrow(uno.state, "guest", guest);
  if (!dos.ok) {
    throw new Error(`tirada rechazada: ${dos.error}`);
  }
  return dos.state;
};

describe("quien gana a quien", () => {
  it("piedra rompe tijera, papel envuelve piedra, tijera corta papel", () => {
    expect(winnerOf("piedra", "tijera")).toBe("host");
    expect(winnerOf("papel", "piedra")).toBe("host");
    expect(winnerOf("tijera", "papel")).toBe("host");
  });

  it("y al reves pierde", () => {
    expect(winnerOf("tijera", "piedra")).toBe("guest");
    expect(winnerOf("piedra", "papel")).toBe("guest");
    expect(winnerOf("papel", "tijera")).toBe("guest");
  });

  it("lo mismo contra lo mismo empata", () => {
    for (const t of THROWS) {
      expect(winnerOf(t, t)).toBeNull();
    }
  });

  it("ninguna tirada gana ni pierde contra todas", () => {
    // Si una lo hiciera, elegirla seria la unica jugada del juego.
    for (const mia of THROWS) {
      const resultados = THROWS.map((suya) => winnerOf(mia, suya));
      expect(resultados).toContain("host");
      expect(resultados).toContain("guest");
      expect(resultados).toContain(null);
    }
  });
});

describe("tiradas", () => {
  it("la primera tirada no resuelve nada", () => {
    const r = submitThrow(startRps(), "host", "piedra");
    expect(r).toMatchObject({ ok: true, roundResolved: false });
  });

  it("la segunda cierra la ronda", () => {
    const uno = submitThrow(startRps(), "host", "piedra");
    if (!uno.ok) {
      throw new Error("deberia valer");
    }
    const dos = submitThrow(uno.state, "guest", "tijera");
    expect(dos).toMatchObject({
      ok: true,
      roundResolved: true,
      roundWinner: "host",
    });
  });

  it("no deja cambiar una tirada ya hecha", () => {
    // Si no, quien tira segundo veria resolverse la ronda y pediria otra.
    const uno = submitThrow(startRps(), "host", "piedra");
    if (!uno.ok) {
      throw new Error("deberia valer");
    }
    expect(submitThrow(uno.state, "host", "papel")).toEqual({
      ok: false,
      error: "already-thrown",
    });
  });

  it("una partida acabada no admite mas tiradas", () => {
    let s = startRps(1);
    s = ronda(s, "piedra", "tijera");
    expect(submitThrow(s, "host", "papel")).toEqual({
      ok: false,
      error: "match-over",
    });
  });
});

describe("marcador", () => {
  it("gana quien llega al objetivo", () => {
    let s = startRps(2);
    s = ronda(s, "piedra", "tijera");
    expect(s.finished).toBe(false);
    s = ronda(s, "papel", "piedra");
    expect(s.finished).toBe(true);
    expect(s.result).toBe("host");
    expect(s.hostWins).toBe(2);
  });

  it("el empate NO gasta ronda", () => {
    // Contarlo haria que un 'mejor de 3' se decidiese con una sola victoria.
    let s = startRps(2);
    s = ronda(s, "piedra", "piedra");
    expect(s.round).toBe(1);
    expect(s.hostWins).toBe(0);
    expect(s.guestWins).toBe(0);
    // Pero queda apuntado en el historial.
    expect(s.history).toHaveLength(1);
    expect(s.history[0]?.winner).toBeNull();
  });

  it("las tiradas se limpian entre rondas", () => {
    const s = ronda(startRps(3), "piedra", "tijera");
    expect(s.hostThrow).toBeNull();
    expect(s.guestThrow).toBeNull();
  });

  it("un objetivo absurdo se corrige a uno", () => {
    expect(startRps(0).target).toBe(1);
    expect(startRps(-5).target).toBe(1);
  });

  it("el marcador se lee de un vistazo", () => {
    const s = ronda(startRps(2), "piedra", "tijera");
    const t = renderScore(s, "Ana", "Luis");
    expect(t).toContain("Ana");
    expect(t).toContain("Luis");
    expect(t).toContain("1");
  });
});

describe("lo que ve el chat", () => {
  it("NUNCA enseña la tirada de quien fue primero", () => {
    // Es todo el juego: si se viera, el segundo ganaria siempre.
    const uno = submitThrow(startRps(), "host", "piedra");
    if (!uno.ok) {
      throw new Error("deberia valer");
    }
    const vista = publicRound(uno.state);
    expect(JSON.stringify(vista)).not.toContain("piedra");
    expect(vista.hostReady).toBe(true);
    expect(vista.guestReady).toBe(false);
    expect(vista.reveal).toBeNull();
  });

  it("enseña las dos cuando la ronda ya se resolvio", () => {
    const s = ronda(startRps(3), "piedra", "tijera");
    const vista = publicRound(s);
    expect(vista.reveal).toEqual({
      host: "piedra",
      guest: "tijera",
      winner: "host",
    });
  });

  it("al empezar la ronda siguiente no queda nada visible de la anterior", () => {
    let s = ronda(startRps(3), "piedra", "tijera");
    const media = submitThrow(s, "guest", "papel");
    if (!media.ok) {
      throw new Error("deberia valer");
    }
    s = media.state;
    // Solo ha tirado el invitado: no puede verse su papel por ningun lado.
    expect(JSON.stringify(publicRound(s))).not.toContain("papel");
  });
});

describe("abandono", () => {
  it("irse da la partida al otro", () => {
    // Irse no es empatar.
    const s = forfeit(startRps(3), "host");
    expect(s.finished).toBe(true);
    expect(s.result).toBe("guest");
  });

  it("no cambia una partida ya acabada", () => {
    const s = ronda(startRps(1), "piedra", "tijera");
    expect(forfeit(s, "host").result).toBe("host");
  });
});

describe("entender lo que escribe la gente", () => {
  it("acepta el nombre, el plural, los acentos y el emoji", () => {
    expect(parseThrow("Piedra")).toBe("piedra");
    expect(parseThrow("  PAPEL ")).toBe("papel");
    expect(parseThrow("tijeras")).toBe("tijera");
    expect(parseThrow("🪨")).toBe("piedra");
    expect(parseThrow("✂️")).toBe("tijera");
  });

  it("no se inventa lo que no entiende", () => {
    expect(parseThrow("lagarto")).toBeNull();
    expect(parseThrow("")).toBeNull();
  });
});

describe("validacion de estado guardado", () => {
  it("acepta uno bueno", () => {
    expect(isValidRpsState(startRps())).toBe(true);
    expect(isValidRpsState(ronda(startRps(3), "piedra", "papel"))).toBe(true);
  });

  it.each([
    null,
    undefined,
    {},
    { ...startRps(), target: 0 },
    { ...startRps(), hostWins: -1 },
    { ...startRps(), hostThrow: "lagarto" },
    { ...startRps(), history: "no" },
  ])("rechaza un estado corrupto", (value) => {
    expect(isValidRpsState(value)).toBe(false);
  });
});
