import { createLogger } from "@superbot/shared";
import { describe, expect, it } from "vitest";
import type {
  CatalogoDeManejadores,
  ContextoDeManejador,
} from "../despachador.js";
import { FakeUserbot } from "../fake-userbot.js";
import {
  extraerHashDeInvitacion,
  manejadoresDeVinculacion,
  type ResultadoUnirseAGrupo,
} from "./vinculacion.js";

const logger = createLogger("vinculacion-test", "silent");

const unManejador = (catalogo: CatalogoDeManejadores, tipo: string) => {
  const manejador = catalogo[tipo];
  if (!manejador) throw new Error(`falta el manejador de tipo "${tipo}"`);
  return manejador;
};

const crearContexto = (userbot: FakeUserbot): ContextoDeManejador => ({
  userbot,
  logger,
});

describe("extraerHashDeInvitacion", () => {
  it("entiende el formato moderno t.me/+HASH", () => {
    expect(extraerHashDeInvitacion("https://t.me/+AbC-123_xyz")).toBe(
      "AbC-123_xyz",
    );
  });

  it("entiende el formato viejo joinchat, que sigue circulando", () => {
    expect(extraerHashDeInvitacion("https://t.me/joinchat/AbC123")).toBe(
      "AbC123",
    );
  });

  it("acepta sin protocolo, con telegram.me y con barra final", () => {
    expect(extraerHashDeInvitacion("t.me/+abc")).toBe("abc");
    expect(extraerHashDeInvitacion("https://telegram.me/+abc/")).toBe("abc");
  });

  it("rechaza un enlace PUBLICO, que no sirve para entrar", () => {
    // `t.me/migrupo` es un alias publico, no una invitacion: `ImportChatInvite`
    // no lo acepta. Distinguirlo aqui evita gastar una llamada de una cuenta
    // que Telegram vigila.
    expect(extraerHashDeInvitacion("https://t.me/migrupo")).toBeNull();
  });

  it("rechaza basura y cadenas vacias", () => {
    expect(extraerHashDeInvitacion("")).toBeNull();
    expect(extraerHashDeInvitacion("no soy un enlace")).toBeNull();
    expect(extraerHashDeInvitacion("https://ejemplo.com/+abc")).toBeNull();
  });
});

describe("vinculacion.unirse_a_grupo", () => {
  const manejador = () =>
    unManejador(manejadoresDeVinculacion, "vinculacion.unirse_a_grupo");

  it("se une con el enlace y lo dice", async () => {
    const userbot = new FakeUserbot();
    const resultado = (await manejador()(
      { enlace: "https://t.me/+AbC123" },
      crearContexto(userbot),
    )) as ResultadoUnirseAGrupo;

    expect(resultado).toEqual({ ok: true, yaDentro: false, motivo: null });
    expect(userbot.unionesPedidas).toEqual(["https://t.me/+AbC123"]);
  });

  it("estar ya dentro es exito, no fallo", async () => {
    const userbot = new FakeUserbot();
    userbot.resultadoUnirse = { ok: true, yaDentro: true, motivo: null };

    const resultado = (await manejador()(
      { enlace: "https://t.me/+AbC123" },
      crearContexto(userbot),
    )) as ResultadoUnirseAGrupo;

    expect(resultado.ok).toBe(true);
    expect(resultado.yaDentro).toBe(true);
  });

  it("un enlace invalido lanza SIN llamar al userbot", async () => {
    // No se gasta una llamada de MTProto en algo que ya se sabe mal: una
    // cuenta de usuario haciendo peticiones raras es lo que Telegram castiga.
    const userbot = new FakeUserbot();

    await expect(
      manejador()({ enlace: "https://t.me/migrupo" }, crearContexto(userbot)),
    ).rejects.toThrow(/no es una invitacion/);
    expect(userbot.unionesPedidas).toHaveLength(0);
  });

  it("lanza si falta el enlace", async () => {
    await expect(
      manejador()({}, crearContexto(new FakeUserbot())),
    ).rejects.toThrow(/enlace/);
  });

  it("devuelve el motivo cuando el enlace ya no vale", async () => {
    const userbot = new FakeUserbot();
    userbot.resultadoUnirse = {
      ok: false,
      yaDentro: false,
      motivo: "INVITE_HASH_EXPIRED",
    };

    const resultado = (await manejador()(
      { enlace: "https://t.me/+AbC123" },
      crearContexto(userbot),
    )) as ResultadoUnirseAGrupo;

    expect(resultado.ok).toBe(false);
    expect(resultado.motivo).toContain("EXPIRED");
  });

  it("el catalogo son EXACTAMENTE entrar y salir, nada que conceda permisos", () => {
    // El ayudante no se promueve a si mismo: quien reparte poder es el bot,
    // que tiene la auditoria y el `PermisosPort`. Si algun dia aparece aqui un
    // manejador que pida o conceda un cargo, algo se ha torcido.
    expect(Object.keys(manejadoresDeVinculacion).sort()).toEqual([
      "vinculacion.salir_del_grupo",
      "vinculacion.unirse_a_grupo",
    ]);
    for (const clave of Object.keys(manejadoresDeVinculacion)) {
      expect(clave).not.toMatch(/promo|admin|permiso|cargo/i);
    }
  });
});
