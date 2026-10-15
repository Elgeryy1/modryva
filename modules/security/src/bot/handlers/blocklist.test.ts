import { describe, expect, it } from "vitest";

import {
  accionParaModoDeBlocklist,
  type ModoDeBlocklist,
  textoBlocklistAplicado,
  textoBlocklistSinAccion,
} from "./blocklist.js";

/**
 * Lo que estaba enterrado en el handler era una cadena de ternarios:
 *
 *   mode === "ban" ? "ban" : mode === "kick" ? "ban" : "mute"
 *
 * Con un detalle que no se ve leyendola por encima: "kick" NO existe en la Bot
 * API. Se banea y se desbanea acto seguido. Si alguien simplifica el ternario y
 * se lleva el desbaneo, `kick` pasa a ser un baneo permanente y nadie se entera
 * hasta que alguien reclama.
 */
describe("accionParaModoDeBlocklist", () => {
  it("delete solo borra: ni accion ni aviso", () => {
    expect(accionParaModoDeBlocklist("delete")).toEqual({
      accion: null,
      desbanearDespues: false,
      avisar: false,
    });
  });

  it("warn abre aviso y no toca a la persona en Telegram", () => {
    const plan = accionParaModoDeBlocklist("warn");
    expect(plan.avisar).toBe(true);
    expect(plan.accion).toBeNull();
  });

  it("ban banea y NO desbanea", () => {
    expect(accionParaModoDeBlocklist("ban")).toEqual({
      accion: "ban",
      desbanearDespues: false,
      avisar: false,
    });
  });

  it("kick banea Y desbanea: es la unica forma de expulsar sin vetar", () => {
    // Este es el test que importa. Si `desbanearDespues` pasa a false, kick se
    // convierte en un baneo para siempre.
    expect(accionParaModoDeBlocklist("kick")).toEqual({
      accion: "ban",
      desbanearDespues: true,
      avisar: false,
    });
  });

  it("mute silencia", () => {
    expect(accionParaModoDeBlocklist("mute").accion).toBe("mute");
  });

  it("solo ban y kick banean, y solo kick desbanea", () => {
    const modos: ModoDeBlocklist[] = ["delete", "warn", "mute", "ban", "kick"];
    const banean = modos.filter(
      (m) => accionParaModoDeBlocklist(m).accion === "ban",
    );
    const desbanean = modos.filter(
      (m) => accionParaModoDeBlocklist(m).desbanearDespues,
    );
    expect(banean).toEqual(["ban", "kick"]);
    expect(desbanean).toEqual(["kick"]);
  });
});

describe("los textos de blocklist", () => {
  it("dice el modo en castellano y NO nombra el disparador", () => {
    // Que no aparezca "cripto" es el punto entero de este test: publicar en el
    // grupo la palabra que salto le da a quien hace spam la pista exacta para
    // dar con la variante que pasa el filtro.
    const texto = textoBlocklistAplicado("cripto", "ban");
    expect(texto).not.toContain("cripto");
    expect(texto).toBe(
      "🚷 Mensaje borrado: infringe las normas del grupo. baneo a quien lo envio.",
    );
  });

  it("el de fallo dice que el mensaje SI se borro, y sin filtrar nada", () => {
    // Importa la distincion: la persona tiene que saber que el mensaje se fue
    // aunque la sancion no se aplicara. Lo que no puede salir es ni el
    // disparador ni el error en ingles de la Bot API.
    const texto = textoBlocklistSinAccion(
      "cripto",
      "mute",
      "not enough rights",
    );
    expect(texto).not.toContain("cripto");
    expect(texto).not.toContain("not enough rights");
    expect(texto).toBe(
      "🚷 Mensaje borrado: infringe las normas del grupo. No he podido hacer lo demas (silencio a quien lo envio): me faltan permisos.",
    );
  });
});

describe("un modo desconocido", () => {
  it("acaba en mute, que es lo que ya hacia el servicio", () => {
    // El ternario del handler tenia "mute" como ultimo caso y se tragaba todo
    // lo que no fuera ban ni kick. Se conserva porque esto es una extraccion.
    //
    // Pero conste que silenciar a alguien porque el ajuste tiene una errata es
    // un mal comportamiento: esta anotado como decision de producto pendiente,
    // no colado en una refactorizacion.
    expect(accionParaModoDeBlocklist("modo-que-no-existe")).toEqual({
      accion: "mute",
      desbanearDespues: false,
      avisar: false,
    });
  });
});
