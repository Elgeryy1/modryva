import { describe, expect, it } from "vitest";

import {
  type BloqueosPorTema,
  resolverBloqueoDeContenido,
} from "./bloqueos.js";

/**
 * La precedencia entre los dos niveles de bloqueo estaba repartida entre un
 * `let` reasignado y dos bloques del handler. Aqui esta con nombre y con tests,
 * porque invertirla no rompe nada visible: solo reporta el TIPO equivocado, y
 * ese tipo es justo lo que se le dice a la persona.
 */

const SIN_NADA = {
  hasUrl: false,
  hasMention: false,
  hasPhoto: false,
  hasSticker: false,
  hasVideo: false,
  hasDocument: false,
  hasVoice: false,
  hasForward: false,
  hasVideoNote: false,
  hasAudio: false,
  hasPoll: false,
  hasContact: false,
  hasLocation: false,
  hasGame: false,
  hasVia: false,
  hasAnimation: false,
  hasText: false,
  isForward: false,
  viaBot: false,
} as const;

const SIN_TEMAS: BloqueosPorTema = { base: { lockedTypes: [] }, overrides: {} };

describe("resolverBloqueoDeContenido", () => {
  it("sin nada bloqueado no salta", () => {
    expect(
      resolverBloqueoDeContenido({
        contenido: { ...SIN_NADA, hasSticker: true },
        bloqueadosEnElChat: [],
        bloqueosPorTema: SIN_TEMAS,
        temaId: undefined,
      }),
    ).toBeNull();
  });

  it("la lista del chat salta y devuelve el tipo, no un booleano", () => {
    // El tipo es lo que se le dice a la persona: "no se permiten stickers".
    expect(
      resolverBloqueoDeContenido({
        contenido: { ...SIN_NADA, hasSticker: true },
        bloqueadosEnElChat: ["sticker"],
        bloqueosPorTema: SIN_TEMAS,
        temaId: undefined,
      }),
    ).toBe("sticker");
  });

  it("contenido que no esta bloqueado no salta aunque haya lista", () => {
    expect(
      resolverBloqueoDeContenido({
        contenido: { ...SIN_NADA, hasPhoto: true },
        bloqueadosEnElChat: ["sticker"],
        bloqueosPorTema: SIN_TEMAS,
        temaId: undefined,
      }),
    ).toBeNull();
  });
});

describe("precedencia entre chat y tema", () => {
  it("un tema puede bloquear lo que el chat permite", () => {
    const soloEnEseTema: BloqueosPorTema = {
      base: { lockedTypes: [] },
      overrides: { "10": { lockedTypes: ["sticker"] } },
    };

    expect(
      resolverBloqueoDeContenido({
        contenido: { ...SIN_NADA, hasSticker: true },
        bloqueadosEnElChat: [],
        bloqueosPorTema: soloEnEseTema,
        temaId: "10",
      }),
    ).toBe("sticker");

    // Y fuera de ese tema no bloquea: la lista del chat sigue mandando.
    expect(
      resolverBloqueoDeContenido({
        contenido: { ...SIN_NADA, hasSticker: true },
        bloqueadosEnElChat: [],
        bloqueosPorTema: soloEnEseTema,
        temaId: "99",
      }),
    ).toBeNull();
  });

  it("cuando los dos niveles saltan, gana el del chat", () => {
    // Es la propiedad que se pierde si alguien invierte el orden: el tipo que
    // se reporta —y por tanto lo que se le dice a la persona— seria otro.
    const temaBloqueaFoto: BloqueosPorTema = {
      base: { lockedTypes: [] },
      overrides: { "10": { lockedTypes: ["photo"] } },
    };

    expect(
      resolverBloqueoDeContenido({
        contenido: { ...SIN_NADA, hasSticker: true, hasPhoto: true },
        bloqueadosEnElChat: ["sticker"],
        bloqueosPorTema: temaBloqueaFoto,
        temaId: "10",
      }),
    ).toBe("sticker");
  });
});
