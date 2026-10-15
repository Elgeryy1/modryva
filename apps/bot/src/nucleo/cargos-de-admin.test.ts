import type { TelegramChatMemberResult } from "@superbot/telegram";
import { describe, expect, it } from "vitest";
import {
  accionDeEscalada,
  devolverCargo,
  examinarObjetivo,
  notaDeCargo,
  type TelegramParaCargos,
} from "./cargos-de-admin.js";

const CHAT = 1n;
const OBJETIVO = 99n;

/**
 * Un gateway con solo lo que este fichero toca. Se anota con `satisfies` para
 * que `tsc` compruebe las firmas: vitest no typechequea, y un doble al que le
 * falta un campo pasa los tests y revienta en produccion.
 */
const gateway = (opciones: {
  readonly ficha?: TelegramChatMemberResult;
  readonly fichaLanza?: boolean;
  readonly promoteOk?: boolean;
  readonly promoteLanza?: boolean;
}) => {
  const promociones: unknown[] = [];
  const doble = {
    async getChatMember() {
      if (opciones.fichaLanza) {
        throw new Error("timeout");
      }
      return opciones.ficha ?? { ok: true, skipped: false };
    },
    async promoteChatMember(input: unknown) {
      if (opciones.promoteLanza) {
        throw new Error("400");
      }
      promociones.push(input);
      return { ok: opciones.promoteOk ?? true, skipped: false };
    },
  } satisfies TelegramParaCargos;
  return { doble, promociones };
};

const examinar = (
  ficha: TelegramChatMemberResult | undefined,
  accion: Parameters<typeof examinarObjetivo>[0]["accion"] = "mute",
  fichaLanza = false,
) =>
  examinarObjetivo({
    telegram: gateway({ ...(ficha ? { ficha } : {}), fichaLanza }).doble,
    token: "t",
    chatId: CHAT,
    objetivo: OBJETIVO,
    accion,
    quien: "@fulano",
  });

describe("examinarObjetivo", () => {
  it("a quien no tiene cargo se le sanciona y no se guarda nada", async () => {
    const veredicto = await examinar({
      ok: true,
      skipped: false,
      status: "member",
    });
    expect(veredicto).toEqual({ permitir: true });
  });

  it("al admin que nombro el bot se le sanciona guardando su cargo", async () => {
    const veredicto = await examinar({
      ok: true,
      skipped: false,
      status: "administrator",
      canBeEdited: true,
      customTitle: "Capitán",
      adminRights: { can_pin_messages: true, can_promote_members: false },
    });
    expect(veredicto).toEqual({
      permitir: true,
      cargoGuardado: {
        rights: { can_pin_messages: true, can_promote_members: false },
        titulo: "Capitán",
      },
    });
  });

  it("al admin que nombro una persona se le dice que no, y por que", async () => {
    const veredicto = await examinar({
      ok: true,
      skipped: false,
      status: "administrator",
      canBeEdited: false,
    });
    expect(veredicto.permitir).toBe(false);
    if (veredicto.permitir) {
      throw new Error("tenia que haber rechazado");
    }
    expect(veredicto.texto).toContain("silenciar a @fulano");
    expect(veredicto.texto).toContain("Telegram");
  });

  it("al creador del grupo no se le toca", async () => {
    const veredicto = await examinar({
      ok: true,
      skipped: false,
      status: "creator",
      canBeEdited: true,
    });
    expect(veredicto.permitir).toBe(false);
  });

  it("avisar a un admin propio no guarda cargo: no se le quita nada", async () => {
    const veredicto = await examinar(
      {
        ok: true,
        skipped: false,
        status: "administrator",
        canBeEdited: true,
        adminRights: { can_pin_messages: true },
      },
      "warn",
    );
    expect(veredicto).toEqual({ permitir: true });
  });

  it("si Telegram no contesta, la sancion sigue adelante", async () => {
    // Lo contrario —bloquear ante un fallo de red— congelaria la moderacion
    // entera cada vez que la API tosa, y eso pasa en TODOS los casos.
    const veredicto = await examinar(undefined, "mute", true);
    expect(veredicto).toEqual({ permitir: true });
  });

  it("un admin propio sin permisos legibles se guarda igual, con cargo vacio", async () => {
    const veredicto = await examinar({
      ok: true,
      skipped: false,
      status: "administrator",
      canBeEdited: true,
    });
    expect(veredicto).toEqual({
      permitir: true,
      cargoGuardado: { rights: {} },
    });
  });
});

describe("devolverCargo", () => {
  const devolver = (
    cargo: Parameters<typeof devolverCargo>[0]["cargo"],
    opciones: Parameters<typeof gateway>[0] = {},
  ) => {
    const { doble, promociones } = gateway(opciones);
    return devolverCargo({
      telegram: doble,
      token: "t",
      chatId: CHAT,
      objetivo: OBJETIVO,
      cargo,
    }).then((resultado) => ({ resultado, promociones }));
  };

  it("sin cargo guardado no hace nada, y eso no es un fallo", async () => {
    const { resultado, promociones } = await devolver(null);
    expect(resultado).toBe("nada");
    expect(promociones).toHaveLength(0);
  });

  it("devuelve los permisos exactos que se guardaron", async () => {
    const { resultado, promociones } = await devolver({
      rights: { can_pin_messages: true, can_promote_members: false },
      titulo: "Capitán",
    });
    expect(resultado).toBe("devuelto");
    expect(promociones[0]).toMatchObject({
      chatId: CHAT,
      userId: OBJETIVO,
      customTitle: "Capitán",
      rights: { can_pin_messages: true, can_promote_members: false },
    });
  });

  it("con el cargo vacio NO manda `rights`, para no inventarse permisos", async () => {
    // Un objeto vacio haria que el gateway repartiera su juego por defecto, que
    // no es lo que esta persona tenia.
    const { promociones } = await devolver({ rights: {} });
    expect(promociones[0]).not.toHaveProperty("rights");
  });

  it("si Telegram rechaza la promocion se dice que se perdio", async () => {
    const { resultado } = await devolver(
      { rights: { can_pin_messages: true } },
      { promoteOk: false },
    );
    expect(resultado).toBe("perdido");
  });

  it("si la llamada lanza tampoco se calla", async () => {
    const { resultado } = await devolver(
      { rights: { can_pin_messages: true } },
      { promoteLanza: true },
    );
    expect(resultado).toBe("perdido");
  });
});

describe("accionDeEscalada", () => {
  it("las temporales cuentan como su castigo, que la fecha da igual", () => {
    expect(accionDeEscalada("tban")).toBe("ban");
    expect(accionDeEscalada("tmute")).toBe("mute");
    expect(accionDeEscalada("ban")).toBe("ban");
    expect(accionDeEscalada("mute")).toBe("mute");
    expect(accionDeEscalada("kick")).toBe("kick");
  });
});

describe("notaDeCargo", () => {
  it("no dice nada cuando no habia cargo que devolver", () => {
    expect(notaDeCargo("nada")).toBe("");
  });

  it("un cargo perdido SIEMPRE se dice", () => {
    // Quedarse sin cargo y sin aviso es el fallo del 6 de agosto otra vez.
    expect(notaDeCargo("perdido")).not.toBe("");
    expect(notaDeCargo("perdido")).toContain("No he podido devolverle");
  });

  it("y uno devuelto tambien, para que se pueda comprobar", () => {
    expect(notaDeCargo("devuelto")).not.toBe("");
  });
});
