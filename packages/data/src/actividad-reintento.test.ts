import { describe, expect, it } from "vitest";

import {
  InMemoryChatActivityRepository,
  PrismaChatActivityRepository,
} from "./chat-activity-repository.js";

/**
 * Ejecucion → fallo → reintento, con efecto **exactamente una vez**.
 *
 * Desde que el poller dejo de perder los updates que fallan, un update se
 * reprocesa ENTERO cuando un intento anterior murio a mitad. El registro de
 * actividad es de los primeros handlers de la cadena, asi que en un reintento
 * vuelve a correr siempre — incluso si quien fallo fue el handler numero 90.
 *
 * Sin esto, cada reintento sumaba otro mensaje al contador de esa persona.
 */

/** Un cliente Prisma minimo: solo la tabla de actividad. */
const clienteFalso = () => {
  const filas: {
    tenantId: string;
    chatId: string;
    kind: string;
    messageId: bigint | null;
  }[] = [];

  const cliente = {
    chatActivityEvent: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        filas.push({
          tenantId: String(data.tenantId),
          chatId: String(data.chatId),
          kind: String(data.kind),
          messageId: (data.messageId as bigint | null) ?? null,
        });
        return { id: `e${filas.length}` };
      },
      findFirst: async ({
        where,
      }: {
        where: {
          tenantId: string;
          chatId: string;
          kind: string;
          messageId: bigint;
        };
      }) => {
        const encontrada = filas.find(
          (f) =>
            f.tenantId === where.tenantId &&
            f.chatId === where.chatId &&
            f.kind === where.kind &&
            f.messageId === where.messageId,
        );
        return encontrada ? { id: "e" } : null;
      },
    },
  };

  return { cliente, filas };
};

const repo = (cliente: unknown) =>
  new PrismaChatActivityRepository(
    cliente as ConstructorParameters<typeof PrismaChatActivityRepository>[0],
  );

const MENSAJE = {
  tenantId: "t1",
  chatId: "c1",
  kind: "message",
  telegramUserId: 7n,
  text: "hola",
  messageId: 42n,
};

describe("un mensaje deja una fila, se reintente lo que se reintente", () => {
  it("tres intentos del mismo update dejan UNA fila", async () => {
    const { cliente, filas } = clienteFalso();
    const actividad = repo(cliente);

    // El tope de reintentos del poller son 3. Este es el peor caso real.
    await actividad.record(MENSAJE);
    await actividad.record(MENSAJE);
    await actividad.record(MENSAJE);

    expect(filas).toHaveLength(1);
  });

  it("dos mensajes distintos siguen siendo dos filas", async () => {
    // La otra mitad: deduplicar no puede comerse actividad de verdad.
    const { cliente, filas } = clienteFalso();
    const actividad = repo(cliente);

    await actividad.record(MENSAJE);
    await actividad.record({ ...MENSAJE, messageId: 43n });

    expect(filas).toHaveLength(2);
  });

  it("el mismo messageId en otro chat es otro mensaje", async () => {
    // Los ids de mensaje de Telegram son por chat, no globales.
    const { cliente, filas } = clienteFalso();
    const actividad = repo(cliente);

    await actividad.record(MENSAJE);
    await actividad.record({ ...MENSAJE, chatId: "c2" });

    expect(filas).toHaveLength(2);
  });

  it("lo que no es 'message' no se toca", async () => {
    // `reaction` comparte messageId entre todos los que reaccionan: deduplicar
    // ahi se comeria las reacciones de los demas.
    const { cliente, filas } = clienteFalso();
    const actividad = repo(cliente);

    await actividad.record({ ...MENSAJE, kind: "reaction" });
    await actividad.record({ ...MENSAJE, kind: "reaction" });

    expect(filas).toHaveLength(2);
  });

  it("un mensaje sin messageId tampoco se deduplica", async () => {
    // Sin clave natural no hay nada por donde deduplicar sin inventarsela.
    const { cliente, filas } = clienteFalso();
    const actividad = repo(cliente);
    const { messageId: _sinId, ...sinMessageId } = MENSAJE;

    await actividad.record(sinMessageId);
    await actividad.record(sinMessageId);

    expect(filas).toHaveLength(2);
  });
});

describe("el doble en memoria se comporta igual", () => {
  it("tres intentos, una entrada", async () => {
    // Si el doble no deduplicara, los tests que lo usan darian verde sobre un
    // comportamiento que la base no tiene.
    const actividad = new InMemoryChatActivityRepository();

    await actividad.record(MENSAJE);
    await actividad.record(MENSAJE);
    await actividad.record(MENSAJE);

    expect(await actividad.listRecent("t1", "c1", "message")).toHaveLength(1);
  });

  it("y dos mensajes distintos siguen siendo dos", async () => {
    const actividad = new InMemoryChatActivityRepository();

    await actividad.record(MENSAJE);
    await actividad.record({ ...MENSAJE, messageId: 43n });

    expect(await actividad.listRecent("t1", "c1", "message")).toHaveLength(2);
  });
});
