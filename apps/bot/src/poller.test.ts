import { describe, expect, it } from "vitest";
import {
  calcularSiguienteOffset,
  chatDeUpdate,
  decidirTrasFallo,
  ejecutarConLimite,
  fechaDeUpdate,
  ordenarPorUrgencia,
  repartirEnCarriles,
} from "./poller.js";

/** Un update cualquiera del lote, con la clave que lo distingue. */
const update = (
  update_id: number,
  clave: "message" | "chat_join_request" | "callback_query",
) => ({ update_id, [clave]: {} });

describe("ordenarPorUrgencia", () => {
  it("saca delante la solicitud de unión aunque llegara la última", () => {
    const lote = [
      update(1, "message"),
      update(2, "message"),
      update(3, "chat_join_request"),
    ];
    expect(ordenarPorUrgencia(lote).map((u) => u.update_id)).toEqual([3, 1, 2]);
  });

  it("mantiene el orden de llegada entre los mensajes", () => {
    // Lo que depende de esto: la moderación y los contadores leen los mensajes
    // de un chat en orden. Adelantar la solicitud no puede barajar el resto.
    const lote = [
      update(10, "message"),
      update(11, "callback_query"),
      update(12, "chat_join_request"),
      update(13, "message"),
      update(14, "chat_join_request"),
    ];
    expect(ordenarPorUrgencia(lote).map((u) => u.update_id)).toEqual([
      12, 14, 10, 11, 13,
    ]);
  });

  it("no toca un lote sin solicitudes de unión", () => {
    const lote = [update(7, "message"), update(8, "callback_query")];
    expect(ordenarPorUrgencia(lote).map((u) => u.update_id)).toEqual([7, 8]);
  });

  it("deja el lote original intacto", () => {
    // El bucle fija el offset recorriendo `data.result` antes de reordenar, así
    // que ordenar no puede mutar lo que Telegram devolvió.
    const lote = [update(1, "message"), update(2, "chat_join_request")];
    ordenarPorUrgencia(lote);
    expect(lote.map((u) => u.update_id)).toEqual([1, 2]);
  });

  it("aguanta un lote vacío", () => {
    expect(ordenarPorUrgencia([])).toEqual([]);
  });
});

/**
 * Regresion del fallo por el que el bot perdia updates.
 *
 * El offset se adelantaba con el lote entero ANTES de procesarlo, asi que un
 * `processWebhook` que lanzara dejaba ese update fuera de cobertura: Telegram
 * no lo reenviaba nunca y la fila de `update_inbox` se quedaba reclamada y sin
 * `processedAt`, sin nadie que la reprocesara. Un fallo transitorio de red o de
 * Postgres bastaba para tirar a la basura una solicitud de union.
 */
describe("calcularSiguienteOffset", () => {
  it("sin fallos, avanza hasta el final del lote", () => {
    expect(calcularSiguienteOffset(10, [10, 11, 12], [])).toBe(13);
  });

  it("no confirma por encima del update que fallo", () => {
    // 11 fallo: el offset se queda en 11 para que Telegram lo reenvie.
    expect(calcularSiguienteOffset(10, [10, 11, 12], [11])).toBe(11);
  });

  it("con varios fallos retrocede hasta el menor", () => {
    expect(calcularSiguienteOffset(10, [10, 11, 12, 13], [13, 11])).toBe(11);
  });

  it("un fallo en el primer update del lote no avanza nada", () => {
    expect(calcularSiguienteOffset(10, [10, 11, 12], [10])).toBe(10);
  });

  it("un lote vacio deja el offset como estaba", () => {
    expect(calcularSiguienteOffset(42, [], [])).toBe(42);
  });

  it("nunca retrocede por debajo del offset ya confirmado", () => {
    // Updates viejos reenviados por Telegram no deben desconfirmar nada.
    expect(calcularSiguienteOffset(100, [10, 11], [])).toBe(100);
  });
});

describe("decidirTrasFallo", () => {
  it("reintenta mientras queden intentos", () => {
    expect(decidirTrasFallo(1)).toBe("reintentar");
    expect(decidirTrasFallo(2)).toBe("reintentar");
  });

  it("descarta al agotarlos, para no congelar la cola con un envenenado", () => {
    expect(decidirTrasFallo(3)).toBe("descartar");
    expect(decidirTrasFallo(9)).toBe("descartar");
  });
});

/**
 * Concurrencia por carriles: el lote deja de procesarse en serie, pero los
 * updates de un mismo chat siguen en orden estricto.
 */
describe("repartirEnCarriles", () => {
  const msg = (update_id: number, chatId: number) => ({
    update_id,
    message: { chat: { id: chatId } },
  });

  it("separa los chats en carriles distintos", () => {
    const carriles = repartirEnCarriles([
      msg(1, 100),
      msg(2, 200),
      msg(3, 100),
    ]);
    expect(carriles).toHaveLength(2);
    expect(carriles[0]?.map((u) => u.update_id)).toEqual([1, 3]);
    expect(carriles[1]?.map((u) => u.update_id)).toEqual([2]);
  });

  it("mantiene el orden de llegada dentro de un chat", () => {
    const carriles = repartirEnCarriles([
      msg(5, 100),
      msg(6, 100),
      msg(7, 100),
    ]);
    expect(carriles).toHaveLength(1);
    expect(carriles[0]?.map((u) => u.update_id)).toEqual([5, 6, 7]);
  });

  it("mantiene la prioridad de las solicitudes de union", () => {
    const carriles = repartirEnCarriles([
      msg(1, 100),
      { update_id: 2, chat_join_request: { chat: { id: 100 } } },
    ]);
    // Misma sala, asi que un solo carril, y la solicitud va delante.
    expect(carriles).toHaveLength(1);
    expect(carriles[0]?.map((u) => u.update_id)).toEqual([2, 1]);
  });

  it("agrupa en un solo carril lo que no se puede atribuir a un chat", () => {
    const carriles = repartirEnCarriles([
      { update_id: 1, poll_answer: {} },
      { update_id: 2, poll_answer: {} },
    ]);
    expect(carriles).toHaveLength(1);
  });
});

describe("chatDeUpdate", () => {
  it("saca el chat de un callback_query anidado", () => {
    expect(
      chatDeUpdate({ callback_query: { message: { chat: { id: 77 } } } }),
    ).toBe("77");
  });

  it("cae en sin-chat cuando no hay forma de saberlo", () => {
    expect(chatDeUpdate({ poll_answer: {} })).toBe("sin-chat");
  });
});

/**
 * El objeto `Update` de Telegram NO tiene `date`. El poller lo leia de la raiz
 * y la guarda no se cumplia nunca, asi que el histograma de retraso —la metrica
 * con la que se iba a diagnosticar Guardian— llevaba desde siempre vacio.
 */
describe("fechaDeUpdate", () => {
  it("NO lee la raiz del update, que es donde nunca esta", () => {
    expect(fechaDeUpdate({ date: 1700000000 })).toBeUndefined();
  });

  it("saca la fecha del payload de un mensaje", () => {
    expect(fechaDeUpdate({ message: { date: 1700000000 } })).toBe(1700000000);
  });

  it("saca la fecha de una solicitud de union", () => {
    // El caso que importa: es el update de Guardian.
    expect(fechaDeUpdate({ chat_join_request: { date: 1700000042 } })).toBe(
      1700000042,
    );
  });

  it("en una edicion manda edit_date, no la del original", () => {
    // `date` puede ser de hace semanas y daria un retraso absurdo.
    expect(
      fechaDeUpdate({
        edited_message: { date: 1600000000, edit_date: 1700000000 },
      }),
    ).toBe(1700000000);
  });

  it("se calla en vez de inventar un cero cuando no hay fecha", () => {
    // Un cero inventado bajaria la media y taparia el retraso que se busca.
    expect(fechaDeUpdate({ poll_answer: {} })).toBeUndefined();
    expect(fechaDeUpdate({ message: { date: "ayer" } })).toBeUndefined();
  });

  it("ignora el mensaje de un callback_query", () => {
    // Ese mensaje puede ser un menu de ayer: mediria la edad del botón, no el
    // retraso de la entrega.
    expect(
      fechaDeUpdate({ callback_query: { message: { date: 1600000000 } } }),
    ).toBeUndefined();
  });
});

describe("ejecutarConLimite", () => {
  it("no ejecuta mas de N tareas a la vez", async () => {
    let enVuelo = 0;
    let maximo = 0;
    const tareas = Array.from({ length: 20 }, () => async () => {
      enVuelo += 1;
      maximo = Math.max(maximo, enVuelo);
      await new Promise((r) => setTimeout(r, 5));
      enVuelo -= 1;
    });
    await ejecutarConLimite(tareas, 4);
    expect(maximo).toBeLessThanOrEqual(4);
  });

  it("ejecuta todas las tareas", async () => {
    const hechas: number[] = [];
    const tareas = Array.from({ length: 9 }, (_, i) => async () => {
      hechas.push(i);
    });
    await ejecutarConLimite(tareas, 3);
    expect(hechas.sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  });
});

/**
 * Banco de pruebas reproducible del cambio: mismo lote, misma latencia
 * simulada por update, en serie contra por carriles.
 *
 * No mide la maquina, mide la FORMA de ejecucion: 12 updates repartidos en 4
 * chats, 20 ms cada uno. En serie son 12 tandas; por carriles con tope 4 son 3.
 * La asercion se deja holgada a proposito para que no sea un test flaky.
 */
describe("banco de pruebas: serie contra carriles", () => {
  const LATENCIA_MS = 20;
  const lote = Array.from({ length: 12 }, (_, i) => ({
    update_id: i + 1,
    message: { chat: { id: 100 + (i % 4) } },
  }));

  const trabajo = async (): Promise<void> => {
    await new Promise((r) => setTimeout(r, LATENCIA_MS));
  };

  it("los carriles terminan claramente antes que la serie", async () => {
    const inicioSerie = Date.now();
    for (const _ of ordenarPorUrgencia(lote)) await trabajo();
    const serieMs = Date.now() - inicioSerie;

    const inicioCarriles = Date.now();
    await ejecutarConLimite(
      repartirEnCarriles(lote).map((carril) => async () => {
        for (const _ of carril) await trabajo();
      }),
      4,
    );
    const carrilesMs = Date.now() - inicioCarriles;

    // 12 tandas frente a 3: el margen real ronda 4x. Se exige solo 2x para no
    // depender de la carga de la maquina que ejecute los tests.
    expect(carrilesMs * 2).toBeLessThan(serieMs);
  });

  it("y aun asi respetan el orden dentro de cada chat", async () => {
    const vistos: Record<string, number[]> = {};
    await ejecutarConLimite(
      repartirEnCarriles(lote).map((carril) => async () => {
        for (const update of carril) {
          await trabajo();
          const chat = chatDeUpdate(update);
          const yaVistos = vistos[chat] ?? [];
          yaVistos.push(update.update_id);
          vistos[chat] = yaVistos;
        }
      }),
      4,
    );
    for (const ids of Object.values(vistos)) {
      expect(ids).toEqual([...ids].sort((a, b) => a - b));
    }
  });
});
