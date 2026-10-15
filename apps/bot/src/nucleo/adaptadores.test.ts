import type { ContextoDeUpdate } from "@superbot/domain";
import { describe, expect, it } from "vitest";

import {
  ajustesDelChat,
  aleatoriedadDeSecuencia,
  auditoriaDelUpdate,
  idempotenciaConRepositorio,
  permisosDelUpdate,
  relojFijo,
  telegramDelUpdate,
} from "./adaptadores.js";

/**
 * Los adaptadores se prueban SUELTOS, sin instanciar nada grande.
 *
 * Eso es la mitad del objetivo de la modularizacion y aqui ya se nota: montar
 * un `BotUpdateService` en un test pide 56 dependencias posicionales, y por eso
 * el fichero de tests del servicio son 17.253 lineas con 72 construcciones a
 * mano. Un adaptador cabe en cuatro lineas de preparacion.
 */

const CONTEXTO: ContextoDeUpdate = {
  tenantId: "t1",
  chatId: "c1",
  userId: "u1",
  membershipRole: "member",
};

describe("relojFijo", () => {
  it("no avanza entre llamadas", () => {
    const reloj = relojFijo(new Date("2026-08-20T10:00:00.000Z"));
    expect(reloj.ahoraMs()).toBe(reloj.ahoraMs());
    expect(reloj.ahora().toISOString()).toBe("2026-08-20T10:00:00.000Z");
  });

  it("devuelve una copia, no la fecha original", () => {
    const instante = new Date("2026-08-20T10:00:00.000Z");
    const reloj = relojFijo(instante);
    reloj.ahora().setFullYear(1999);
    // Si devolviera la misma instancia, un test que la mutara envenenaria al
    // siguiente.
    expect(reloj.ahora().getFullYear()).toBe(2026);
  });
});

describe("aleatoriedadDeSecuencia", () => {
  it("entrega los valores en orden y luego da la vuelta", () => {
    const azar = aleatoriedadDeSecuencia(["a", "b"]);
    expect([azar.uuid(), azar.uuid(), azar.uuid()]).toEqual(["a", "b", "a"]);
  });
});

describe("idempotenciaConRepositorio", () => {
  it("ata la reserva al tenant del update, no al que pida el modulo", () => {
    const recibido: unknown[] = [];
    const puerto = idempotenciaConRepositorio(CONTEXTO, async (entrada) => {
      recibido.push(entrada);
      return true;
    });

    puerto.reservar({ namespace: "economia", key: "u9" });

    // El modulo no elige tenant. Si pudiera, podria reservar en nombre de otro
    // y saltarse la proteccion del suyo.
    expect(recibido[0]).toMatchObject({ tenantId: "t1", key: "u9" });
  });

  it("propaga el veredicto del repositorio tal cual", async () => {
    const noReserva = idempotenciaConRepositorio(CONTEXTO, async () => false);
    await expect(
      noReserva.reservar({ namespace: "economia", key: "u9" }),
    ).resolves.toBe(false);
  });
});

describe("auditoriaDelUpdate", () => {
  it("ata el registro al tenant y al actor de este update", async () => {
    const registros: Record<string, unknown>[] = [];
    const puerto = auditoriaDelUpdate(CONTEXTO, async (entrada) => {
      registros.push(entrada);
    });

    await puerto.registrar({ accion: "prueba", recurso: "chat" });

    expect(registros[0]).toMatchObject({
      tenantId: "t1",
      actorId: "u1",
      actorType: "user",
      action: "prueba",
      resourceType: "chat",
    });
  });

  it("sin usuario, el actor es el sistema", async () => {
    const registros: Record<string, unknown>[] = [];
    const puerto = auditoriaDelUpdate(
      { ...CONTEXTO, userId: undefined },
      async (entrada) => {
        registros.push(entrada);
      },
    );

    await puerto.registrar({ accion: "prueba", recurso: "chat" });

    expect(registros[0]?.actorType).toBe("system");
    expect(registros[0]).not.toHaveProperty("actorId");
  });
});

describe("telegramDelUpdate", () => {
  const gatewayFalso = () => {
    const llamadas: Record<string, unknown>[] = [];
    return {
      llamadas,
      gateway: {
        sendMessage: async (e: Record<string, unknown>) => {
          llamadas.push({ metodo: "sendMessage", ...e });
          return { ok: true, messageId: 1 };
        },
        deleteMessage: async (e: Record<string, unknown>) => {
          llamadas.push({ metodo: "deleteMessage", ...e });
          return { ok: true };
        },
        restrictChatMember: async (e: Record<string, unknown>) => {
          llamadas.push({ metodo: "restrictChatMember", ...e });
          return { ok: true };
        },
        banChatMember: async (e: Record<string, unknown>) => {
          llamadas.push({ metodo: "banChatMember", ...e });
          return { ok: true };
        },
      },
    };
  };

  it("usa siempre el token con el que se construyo", async () => {
    const { gateway, llamadas } = gatewayFalso();
    const puerto = telegramDelUpdate("token-del-hijo", gateway);

    await puerto.enviarMensaje({ chatId: 5n, respuesta: { text: "hola" } });
    await puerto.expulsarMiembro({ chatId: 5n, userId: 9n });

    // Ningun metodo del puerto acepta token: el que se use es el que el nucleo
    // ato al construirlo. Es lo que impide que un bot hijo conteste como el
    // padre.
    expect(llamadas.every((l) => l.token === "token-del-hijo")).toBe(true);
  });

  it("convierte la fecha de fin de restriccion a segundos unix", async () => {
    const { gateway, llamadas } = gatewayFalso();
    const puerto = telegramDelUpdate("t", gateway);

    await puerto.restringirMiembro({
      chatId: 5n,
      userId: 9n,
      hasta: new Date("2026-08-20T10:00:00.000Z"),
    });

    expect(llamadas[0]?.untilDate).toBe(
      Math.floor(new Date("2026-08-20T10:00:00.000Z").getTime() / 1000),
    );
  });

  it("omite untilDate cuando no hay fecha, en vez de mandar cero", async () => {
    const { gateway, llamadas } = gatewayFalso();
    const puerto = telegramDelUpdate("t", gateway);

    await puerto.restringirMiembro({ chatId: 5n, userId: 9n });

    // Un `untilDate: 0` significa "para siempre" en la Bot API. Mandarlo por
    // accidente convertiria un silencio temporal en uno permanente.
    expect(llamadas[0]).not.toHaveProperty("untilDate");
  });
});

describe("permisosDelUpdate", () => {
  it("responde cada pregunta con SU comprobacion, no con una comun", async () => {
    // El caso que importa: alguien nombrado admin con /admin. Es admin de
    // Telegram de verdad, asi que puede moderar; pero no puede tocar la
    // configuracion, o abriria los ajustes y apagaria al guardia que le vigila.
    const puerto = permisosDelUpdate(
      {},
      {},
      async () => true,
      async () => false,
    );

    expect(await puerto.puedeModerar()).toBe(true);
    expect(await puerto.puedeConfigurar()).toBe(false);
  });
});

describe("ajustesDelChat", () => {
  it("lee y escribe siempre en el chat del update", async () => {
    const escrituras: unknown[][] = [];
    const puerto = ajustesDelChat(
      CONTEXTO,
      async () => "valor",
      async (...args) => {
        escrituras.push(args);
      },
    );

    expect(await puerto.leer("clave")).toBe("valor");
    await puerto.escribir("clave", 7);

    expect(escrituras[0]).toEqual(["t1", "c1", "clave", 7]);
  });

  it("sin chat no inventa uno: no lee ni escribe", async () => {
    let escribio = false;
    const puerto = ajustesDelChat(
      { ...CONTEXTO, chatId: undefined },
      async () => "valor",
      async () => {
        escribio = true;
      },
    );

    expect(await puerto.leer("clave")).toBeUndefined();
    await puerto.escribir("clave", 7);
    expect(escribio).toBe(false);
  });
});
