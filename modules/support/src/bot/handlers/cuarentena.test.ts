import type { MessageContentFlags } from "@superbot/domain";
import { describe, expect, it, vi } from "vitest";

import type { QuarantineItemView } from "../../d1.js";
import {
  aplicarCuarentena,
  type MensajeParaCuarentena,
  type PuertosDeCuarentena,
} from "./cuarentena.js";

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

/** Un texto que la evaluacion da por sospechoso con severidad alta. */
const SOSPECHOSO = "regalo gratis, escribeme por privado para el airdrop";

const ITEM: QuarantineItemView = {
  id: "item_1",
  actorTelegramId: 7n,
  username: "alguien",
  text: SOSPECHOSO,
  reason: "url sospechosa",
  status: "pendiente",
};

const mensaje = (
  parcial: Partial<MensajeParaCuarentena> = {},
): MensajeParaCuarentena => ({
  esComando: false,
  contenido: { ...SIN_NADA, hasUrl: true },
  texto: SOSPECHOSO,
  tieneMensajeId: true,
  ...parcial,
});

const puertos = (
  parcial: Partial<PuertosDeCuarentena> = {},
): PuertosDeCuarentena => ({
  esAdministrador: async () => false,
  ajustes: async () => ({ enabled: true, strictness: "alta" }),
  borrarMensaje: async () => undefined,
  crearItem: async () => ITEM,
  anotarSenalDeRiesgo: async () => undefined,
  registrarEnBitacora: async () => undefined,
  ...parcial,
});

describe("aplicarCuarentena", () => {
  it("un admin no pasa por cuarentena, y no se lee ni la configuracion", async () => {
    const ajustes = vi.fn(async () => ({
      enabled: true,
      strictness: "alta",
    }));

    expect(
      await aplicarCuarentena(
        mensaje(),
        puertos({ esAdministrador: async () => true, ajustes }),
      ),
    ).toBeNull();
    expect(ajustes).not.toHaveBeenCalled();
  });

  it("con la cuarentena apagada no se toca nada", async () => {
    const borrarMensaje = vi.fn(async () => undefined);

    expect(
      await aplicarCuarentena(
        mensaje(),
        puertos({
          ajustes: async () => ({ enabled: false, strictness: "alta" }),
          borrarMensaje,
        }),
      ),
    ).toBeNull();
    expect(borrarMensaje).not.toHaveBeenCalled();
  });

  it("un comando no entra en cuarentena", async () => {
    const esAdministrador = vi.fn(async () => false);

    expect(
      await aplicarCuarentena(
        mensaje({ esComando: true }),
        puertos({ esAdministrador }),
      ),
    ).toBeNull();
    expect(esAdministrador).not.toHaveBeenCalled();
  });
});

describe("el orden de los efectos", () => {
  it("borra ANTES de escribir en la base de datos", async () => {
    // Cada milisegundo que el mensaje siga visible es gente leyendolo, que es
    // justo lo que la cuarentena existe para evitar.
    const orden: string[] = [];

    await aplicarCuarentena(
      mensaje(),
      puertos({
        borrarMensaje: async () => {
          orden.push("borrar");
        },
        crearItem: async () => {
          orden.push("crear");
          return ITEM;
        },
      }),
    );

    expect(orden).toEqual(["borrar", "crear"]);
  });

  it("crea el item ANTES de la bitacora, porque el teclado lleva su id", async () => {
    // Es la dependencia real entre los dos: al reves saldria un boton de
    // aprobar/rechazar que no apunta a nada.
    const orden: string[] = [];

    await aplicarCuarentena(
      mensaje(),
      puertos({
        crearItem: async () => {
          orden.push("crear");
          return ITEM;
        },
        registrarEnBitacora: async (entrada) => {
          orden.push("bitacora");
          expect(JSON.stringify(entrada.teclado)).toContain(ITEM.id);
        },
      }),
    );

    expect(orden).toEqual(["crear", "bitacora"]);
  });

  it("sin messageId se aparta igual: se pierde el borrado, no la revision", async () => {
    const borrarMensaje = vi.fn(async () => undefined);
    const crearItem = vi.fn(async () => ITEM);

    const aviso = await aplicarCuarentena(
      mensaje({ tieneMensajeId: false }),
      puertos({ borrarMensaje, crearItem }),
    );

    expect(borrarMensaje).not.toHaveBeenCalled();
    expect(crearItem).toHaveBeenCalledTimes(1);
    expect(aviso).toContain("cuarentena");
  });

  it("un mensaje que no da sospechas no dispara ningun efecto", async () => {
    const borrarMensaje = vi.fn(async () => undefined);
    const crearItem = vi.fn(async () => ITEM);

    expect(
      await aplicarCuarentena(
        mensaje({ texto: "buenos dias", contenido: SIN_NADA }),
        puertos({ borrarMensaje, crearItem }),
      ),
    ).toBeNull();
    expect(borrarMensaje).not.toHaveBeenCalled();
    expect(crearItem).not.toHaveBeenCalled();
  });
});
