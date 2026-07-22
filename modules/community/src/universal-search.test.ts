import { describe, expect, it } from "vitest";
import { type HumanCommand, parseHumanCommand } from "./universal-search.js";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe("parseHumanCommand - accion", () => {
  it("infiere mute a partir de 'silenciar'", () => {
    expect(parseHumanCommand("silenciar")).toEqual<HumanCommand>({
      action: "mute",
    });
  });

  it("infiere lock a partir de 'bloquear'", () => {
    expect(parseHumanCommand("bloquear")).toEqual<HumanCommand>({
      action: "lock",
    });
  });

  it("infiere unlock a partir de 'desbloquear' sin confundir con lock", () => {
    expect(parseHumanCommand("desbloquear")).toEqual<HumanCommand>({
      action: "unlock",
    });
  });

  it("devuelve unknown cuando no hay verbo conocido", () => {
    expect(parseHumanCommand("hola que tal")).toEqual<HumanCommand>({
      action: "unknown",
    });
  });

  it("toma el primer verbo por posicion", () => {
    expect(parseHumanCommand("silenciar y bloquear")).toEqual<HumanCommand>({
      action: "mute",
    });
  });

  it("acepta mayusculas", () => {
    expect(parseHumanCommand("SILENCIAR LINKS")).toEqual<HumanCommand>({
      action: "mute",
      target: "links",
    });
  });
});

describe("parseHumanCommand - target", () => {
  it("mapea 'enlaces' a links", () => {
    expect(parseHumanCommand("desbloquear enlaces")).toEqual<HumanCommand>({
      action: "unlock",
      target: "links",
    });
  });

  it("mapea 'videos' con acento a media", () => {
    expect(parseHumanCommand("silenciar vídeos")).toEqual<HumanCommand>({
      action: "mute",
      target: "media",
    });
  });

  it("toma el primer tipo por posicion", () => {
    expect(
      parseHumanCommand("bloquear links y stickers"),
    ).toEqual<HumanCommand>({
      action: "lock",
      target: "links",
    });
  });
});

describe("parseHumanCommand - duracion", () => {
  it("interpreta 'una hora'", () => {
    expect(parseHumanCommand("silenciar links una hora")).toEqual<HumanCommand>(
      {
        action: "mute",
        target: "links",
        durationMs: HOUR,
      },
    );
  });

  it("interpreta '30 minutos' con digitos", () => {
    expect(
      parseHumanCommand("bloquear stickers 30 minutos"),
    ).toEqual<HumanCommand>({
      action: "lock",
      target: "stickers",
      durationMs: 30 * MINUTE,
    });
  });

  it("interpreta 'media hora' como medio", () => {
    expect(
      parseHumanCommand("silenciar todo media hora"),
    ).toEqual<HumanCommand>({
      action: "mute",
      target: "all",
      durationMs: HOUR / 2,
    });
  });

  it("interpreta 'dos dias' con grupo", () => {
    expect(parseHumanCommand("bloquear grupo dos dias")).toEqual<HumanCommand>({
      action: "lock",
      target: "all",
      durationMs: 2 * DAY,
    });
  });

  it("acepta duracion sin target", () => {
    expect(parseHumanCommand("silenciar un minuto")).toEqual<HumanCommand>({
      action: "mute",
      durationMs: MINUTE,
    });
  });

  it("usa cantidad 1 cuando no hay numeral antes de la unidad", () => {
    expect(parseHumanCommand("bloquear por horas")).toEqual<HumanCommand>({
      action: "lock",
      durationMs: HOUR,
    });
  });

  it("toma la primera unidad por posicion", () => {
    expect(
      parseHumanCommand("mutear audios 2 horas y 5 minutos"),
    ).toEqual<HumanCommand>({
      action: "mute",
      target: "audio",
      durationMs: 2 * HOUR,
    });
  });
});

describe("parseHumanCommand - bordes y determinismo", () => {
  it("cadena vacia es unknown", () => {
    expect(parseHumanCommand("")).toEqual<HumanCommand>({ action: "unknown" });
  });

  it("no incluye target ni durationMs cuando no aplican", () => {
    const result = parseHumanCommand("silenciar");
    expect(Object.hasOwn(result, "target")).toBe(false);
    expect(Object.hasOwn(result, "durationMs")).toBe(false);
  });

  it("es determinista para la misma entrada", () => {
    const phrase = "silenciar links una hora";
    expect(parseHumanCommand(phrase)).toEqual(parseHumanCommand(phrase));
  });
});
