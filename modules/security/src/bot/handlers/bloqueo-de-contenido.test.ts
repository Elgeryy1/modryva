import type { MessageContentFlags } from "@superbot/domain";
import { describe, expect, it, vi } from "vitest";
import {
  aplicarBloqueoDeContenido,
  type MensajeParaBloqueo,
  type PuertosDeBloqueoDeContenido,
  senalDeRiesgoPara,
  tiposBloqueadosValidos,
} from "./bloqueo-de-contenido.js";
import type { BloqueosPorTema } from "./bloqueos.js";

const SIN_NADA = {
  hasText: true,
  hasUrl: false,
  hasMention: false,
  isForward: false,
  viaBot: false,
  hasPhoto: false,
  hasVideo: false,
  hasAnimation: false,
  hasSticker: false,
  hasAudio: false,
  hasVoice: false,
  hasDocument: false,
  hasContact: false,
  hasLocation: false,
  hasPoll: false,
} as const satisfies MessageContentFlags;

const SIN_TEMAS: BloqueosPorTema = { base: { lockedTypes: [] }, overrides: {} };

const mensaje = (
  parcial: Partial<MensajeParaBloqueo> = {},
): MensajeParaBloqueo => ({
  contenido: { ...SIN_NADA, hasSticker: true },
  temaId: undefined,
  ...parcial,
});

const puertos = (
  parcial: Partial<PuertosDeBloqueoDeContenido> = {},
): PuertosDeBloqueoDeContenido => ({
  esAdministrador: async () => false,
  bloqueadosEnElChat: async () => ["sticker"],
  bloqueosPorTema: async () => SIN_TEMAS,
  borrarMensaje: async () => undefined,
  auditar: async () => undefined,
  anotarSenalDeRiesgo: async () => undefined,
  ...parcial,
});

describe("aplicarBloqueoDeContenido", () => {
  it("borra, audita y avisa diciendo QUE tipo era", async () => {
    // El tipo es lo unico que le explica a la persona por que se borro.
    const borrarMensaje = vi.fn(async () => undefined);
    const auditar = vi.fn(async () => undefined);

    const aviso = await aplicarBloqueoDeContenido(
      mensaje(),
      puertos({ borrarMensaje, auditar }),
    );

    expect(borrarMensaje).toHaveBeenCalledTimes(1);
    expect(auditar).toHaveBeenCalledWith("sticker");
    expect(aviso).toContain("sticker");
  });

  it("un admin se lo salta, y no se lee ni la lista", async () => {
    const bloqueadosEnElChat = vi.fn(async () => ["sticker"]);

    expect(
      await aplicarBloqueoDeContenido(
        mensaje(),
        puertos({ esAdministrador: async () => true, bloqueadosEnElChat }),
      ),
    ).toBeNull();
    expect(bloqueadosEnElChat).not.toHaveBeenCalled();
  });

  it("contenido que no esta bloqueado no se toca", async () => {
    const borrarMensaje = vi.fn(async () => undefined);

    expect(
      await aplicarBloqueoDeContenido(
        mensaje({ contenido: { ...SIN_NADA, hasPhoto: true } }),
        puertos({ borrarMensaje }),
      ),
    ).toBeNull();
    expect(borrarMensaje).not.toHaveBeenCalled();
  });

  it("si el borrado falla, el rastro se escribe igual", async () => {
    // Es la propiedad que se pierde si alguien quita el catch: un borrado que
    // Telegram rechaza dejaria el bloqueo sin auditar.
    const auditar = vi.fn(async () => undefined);

    const aviso = await aplicarBloqueoDeContenido(
      mensaje(),
      puertos({
        borrarMensaje: async () => {
          throw new Error("message can't be deleted");
        },
        auditar,
      }),
    );

    expect(auditar).toHaveBeenCalledWith("sticker");
    expect(aviso).toContain("sticker");
  });
});

describe("tiposBloqueadosValidos", () => {
  it("descarta lo que no es un tipo que exista", async () => {
    // Salen de la base de datos: cabe un tipo renombrado hace dos versiones o
    // una errata. El nucleo se fiaba con `locked as LockType[]`.
    expect(tiposBloqueadosValidos(["sticker", "inventado", "url"])).toEqual([
      "sticker",
      "url",
    ]);
  });

  it("un ajuste entero mal no bloquea nada, en vez de bloquearlo todo", async () => {
    // La direccion importa: tratar un tipo desconocido como bloqueo seria
    // borrar mensajes por un ajuste roto.
    const borrarMensaje = vi.fn(async () => undefined);

    expect(
      await aplicarBloqueoDeContenido(
        mensaje(),
        puertos({
          bloqueadosEnElChat: async () => ["esto-no-existe"],
          borrarMensaje,
        }),
      ),
    ).toBeNull();
    expect(borrarMensaje).not.toHaveBeenCalled();
  });
});

describe("senalDeRiesgoPara", () => {
  it("enlaces y reenvios cuentan como link", () => {
    // Alimentan el detector de spam de enlaces; lo demas es un borrado normal.
    expect(senalDeRiesgoPara("url")).toBe("link");
    expect(senalDeRiesgoPara("forward")).toBe("link");
  });

  it("el resto es un borrado normal", () => {
    expect(senalDeRiesgoPara("sticker")).toBe("deleted");
    expect(senalDeRiesgoPara("photo")).toBe("deleted");
  });

  it("la senal llega al puerto, no se queda en el camino", async () => {
    const anotarSenalDeRiesgo = vi.fn(async () => undefined);

    await aplicarBloqueoDeContenido(
      mensaje({ contenido: { ...SIN_NADA, hasUrl: true } }),
      puertos({
        bloqueadosEnElChat: async () => ["url"],
        anotarSenalDeRiesgo,
      }),
    );

    expect(anotarSenalDeRiesgo).toHaveBeenCalledWith("link");
  });
});
