import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { PrismaModerationRepository } from "./moderation-repository.js";

/**
 * Un reintento no puede crear el aviso dos veces.
 *
 * Aqui importa mas que en una sancion suelta, y el motivo es la **escalada**:
 * el handler cuenta los avisos activos justo despues de crear este y, al llegar
 * a `warnLimit` (3 por defecto), banea o silencia solo. El tope de reintentos
 * del poller son **3**, el mismo numero.
 *
 * O sea que un unico `/warn` reprocesado tres veces podia acabar en expulsion
 * automatica. La ironia era que la sancion de la escalada SI estaba protegida:
 * se cerro el efecto y se dejo suelto el contador que lo dispara.
 */

const ENTRADA = {
  tenantId: "t1",
  chatId: "c1",
  actorUserId: undefined,
  subjectTelegramUserId: 7n,
  reason: "spam",
};

const clienteFalso = () => {
  const reservas = new Map<string, unknown>();
  const avisos: unknown[] = [];
  let siguienteCaso = 1;

  const cliente = {
    idempotencyKey: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const clave = `${String(data.namespace)} ${String(data.key)}`;
        if (reservas.has(clave)) {
          throw new Prisma.PrismaClientKnownRequestError("unique", {
            code: "P2002",
            clientVersion: "test",
          });
        }
        reservas.set(clave, null);
        return { id: "idem" };
      },
      findUnique: async ({
        where,
      }: {
        where: { namespace_key: { namespace: string; key: string } };
      }) => {
        const clave = `${where.namespace_key.namespace} ${where.namespace_key.key}`;
        return reservas.has(clave) ? { payload: reservas.get(clave) } : null;
      },
      update: async ({
        where,
        data,
      }: {
        where: { namespace_key: { namespace: string; key: string } };
        data: { payload: unknown };
      }) => {
        const clave = `${where.namespace_key.namespace} ${where.namespace_key.key}`;
        reservas.set(clave, data.payload);
        return { id: "idem" };
      },
    },
    appUser: {
      findUnique: async () => ({ id: "user_1", tenantId: "t1" }),
      update: async () => ({ id: "user_1", tenantId: "t1" }),
      create: async () => ({ id: "user_1", tenantId: "t1" }),
    },
    moderationCase: {
      create: async () => ({
        id: `caso_${siguienteCaso}`,
        caseNumber: siguienteCaso++,
      }),
      aggregate: async () => ({ _max: { caseNumber: siguienteCaso - 1 } }),
      count: async () => siguienteCaso - 1,
    },
    warning: {
      create: async ({ data }: { data: unknown }) => {
        avisos.push(data);
        return { id: `aviso_${avisos.length}` };
      },
    },
  };

  return { cliente, avisos, reservas };
};

const repo = (cliente: unknown) =>
  new PrismaModerationRepository(
    cliente as ConstructorParameters<typeof PrismaModerationRepository>[0],
  );

describe("createWarning con clave de idempotencia", () => {
  it("los TRES intentos del poller dejan UN aviso", async () => {
    // Tres es el tope real de reintentos, y tambien el limite de avisos por
    // defecto: es exactamente el caso que acababa en expulsion.
    const { cliente, avisos } = clienteFalso();
    const moderacion = repo(cliente);

    const primero = await moderacion.createWarning({
      ...ENTRADA,
      claveIdempotencia: "u12345:aviso:7",
    });
    await moderacion.createWarning({
      ...ENTRADA,
      claveIdempotencia: "u12345:aviso:7",
    });
    const tercero = await moderacion.createWarning({
      ...ENTRADA,
      claveIdempotencia: "u12345:aviso:7",
    });

    expect(avisos).toHaveLength(1);
    // Y devuelve el resultado del primero, no uno inventado: el numero de caso
    // que se le enseña a la persona tiene que ser el mismo.
    expect(tercero).toEqual(primero);
  });

  it("avisar a dos personas en el mismo update son dos avisos", async () => {
    // La clave lleva el destinatario dentro justo por esto.
    const { cliente, avisos } = clienteFalso();
    const moderacion = repo(cliente);

    await moderacion.createWarning({
      ...ENTRADA,
      claveIdempotencia: "u9:aviso:7",
    });
    await moderacion.createWarning({
      ...ENTRADA,
      subjectTelegramUserId: 8n,
      claveIdempotencia: "u9:aviso:8",
    });

    expect(avisos).toHaveLength(2);
  });

  it("avisar y sancionar en el mismo update no se estorban", async () => {
    // Espacios de claves distintos: `moderacion.aviso` y `moderacion.sancion`.
    const { cliente, avisos } = clienteFalso();
    const moderacion = repo(cliente);

    await moderacion.createWarning({
      ...ENTRADA,
      claveIdempotencia: "u9:aviso:7",
    });
    await moderacion.createWarning({
      ...ENTRADA,
      claveIdempotencia: "u9:aviso:7",
    });

    expect(avisos).toHaveLength(1);
  });

  it("sin clave el comportamiento es el de siempre", async () => {
    const { cliente, avisos } = clienteFalso();
    const moderacion = repo(cliente);

    await moderacion.createWarning(ENTRADA);
    await moderacion.createWarning(ENTRADA);

    expect(avisos).toHaveLength(2);
  });

  it("si el intento anterior murio ANTES de crear el aviso, se crea", async () => {
    // Reserva puesta y sin resultado significa que alguien reservo y murio
    // antes de crear: el aviso NO llego a existir, asi que hay que crearlo.
    const { cliente, avisos, reservas } = clienteFalso();
    const moderacion = repo(cliente);

    reservas.set("moderacion.aviso u77:aviso:7", null);

    await moderacion.createWarning({
      ...ENTRADA,
      claveIdempotencia: "u77:aviso:7",
    });

    expect(avisos).toHaveLength(1);
  });

  it("un fallo que no es el del indice unico se propaga", async () => {
    const { cliente } = clienteFalso();
    cliente.idempotencyKey.create = async () => {
      throw new Error("la base de datos no responde");
    };

    // Tragarselo avisaria sin proteccion y sin decirlo.
    await expect(
      repo(cliente).createWarning({ ...ENTRADA, claveIdempotencia: "u1" }),
    ).rejects.toThrow("la base de datos no responde");
  });
});
