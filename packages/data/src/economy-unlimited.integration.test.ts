/**
 * El saldo sin fondo, contra POSTGRES REAL.
 *
 * POR QUE ESTE FICHERO EXISTE. La bandera no la aplica JavaScript: vive en el
 * WHERE de un `updateMany`, o sea que quien decide si una cartera paga es
 * Postgres. Un doble en memoria que lea, decida y escriba pasa los tests de al
 * lado y no dice nada de esto:
 *
 * 1. **Una cartera ilimitada paga sin fondo y su saldo no se mueve**, ni al
 *    cobrar ni al abonar. Lo hace la condicion `unlimited: false` dentro del
 *    UPDATE, no un `if`.
 * 2. **La guarda de saldo de las carteras normales sigue igual de apretada.**
 *    Es la propiedad que este cambio pudo romper sin que se notara: el cobro se
 *    reescribio entero, y si la guarda dejara de tomar el bloqueo de la fila,
 *    dos cobros simultaneos pasarian los dos y el saldo se iria a negativo. Eso
 *    es exclusion mutua de Postgres y aqui es el unico sitio donde se ve.
 * 3. **El libro mayor sigue contandolo todo.** Cuando el saldo deja de contar,
 *    el libro es la unica cuenta que queda; si tampoco se escribiera, el gasto
 *    de esa cartera seria invisible.
 *
 * COMO EJECUTARLO (necesita Docker):
 *   docker compose up -d postgres
 *   DATABASE_URL=postgresql://superbot:superbot@127.0.0.1:5433/superbot \
 *     node node_modules/prisma/build/index.js migrate deploy --schema packages/data/prisma/schema.prisma
 *   TEST_DATABASE_URL=postgresql://superbot:superbot@127.0.0.1:5433/superbot \
 *     node node_modules/vitest/vitest.mjs run packages/data/src/economy-unlimited.integration.test.ts
 *
 * Sin `TEST_DATABASE_URL` se salta entero, para que la suite normal no dependa
 * de tener una base de datos levantada.
 */

import { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaEconomyRepository } from "./economy-repository.js";

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

const TENANT = "tenant-ilimitado-integracion";
const CHAT = "chat-ilimitado-integracion";
const RICA = 111_222_333n;
const NORMAL = 444_555_666n;

const describeSiHayBase = TEST_DATABASE_URL ? describe : describe.skip;

describeSiHayBase("saldo sin fondo contra Postgres real", () => {
  const client = new PrismaClient({
    datasources: { db: { url: TEST_DATABASE_URL ?? "" } },
  });
  const repo = new PrismaEconomyRepository(client);

  const limpiar = async (): Promise<void> => {
    await client.economyLedger.deleteMany({ where: { tenantId: TENANT } });
    await client.economyWallet.deleteMany({ where: { tenantId: TENANT } });
  };

  const saldoDe = async (persona: bigint): Promise<number> =>
    (await repo.getWallet(TENANT, CHAT, persona))?.balance ?? 0;

  beforeEach(async () => {
    await limpiar();
    await repo.ensureWallet(TENANT, CHAT, RICA, 10);
    await repo.ensureWallet(TENANT, CHAT, NORMAL, 100);
    await repo.setUnlimited({
      tenantId: TENANT,
      chatId: CHAT,
      userTelegramId: RICA,
      unlimited: true,
    });
  });

  afterAll(async () => {
    await limpiar();
    await client.$disconnect();
  });

  it("cobra sin fondo y deja el saldo quieto", async () => {
    const res = await repo.debit(
      TENANT,
      CHAT,
      RICA,
      5_000_000,
      "shop-buy",
      "a",
    );

    expect(res.ok).toBe(true);
    expect(await saldoDe(RICA)).toBe(10);
  });

  it("no abona: el saldo no puede acercarse al techo del integer", async () => {
    await repo.credit(TENANT, CHAT, RICA, 2_000_000_000, "earn", "a");
    await repo.credit(TENANT, CHAT, RICA, 2_000_000_000, "earn", "b");

    // Dos abonos que sumados pasan de 2.147.483.647. En una cartera normal el
    // segundo reventaria con "integer out of range"; aqui ninguno toca el
    // numero, que es lo que hace que el desbordamiento deje de existir.
    expect(await saldoDe(RICA)).toBe(10);
  });

  it("escribe en el libro lo que el saldo ya no cuenta", async () => {
    await repo.debit(TENANT, CHAT, RICA, 700, "shop-buy", "a");
    await repo.credit(TENANT, CHAT, RICA, 40, "earn", "b");

    const movimientos = await repo.history(TENANT, CHAT, RICA, 10);
    expect(movimientos.map((m) => m.delta)).toEqual([40, -700]);
  });

  it("dona sin fondo y quien recibe cobra de verdad", async () => {
    const res = await repo.move({
      tenantId: TENANT,
      chatId: CHAT,
      fromId: RICA,
      toId: NORMAL,
      amount: 250_000,
      fromReason: "donate-out",
      toReason: "donate-in",
      refId: "d1",
    });

    expect(res.ok).toBe(true);
    expect(await saldoDe(RICA)).toBe(10);
    expect(await saldoDe(NORMAL)).toBe(250_100);
  });

  it("sube el nonce al apostar aunque no cobre la apuesta", async () => {
    const antes = await repo.ensureBettingWallet(TENANT, CHAT, RICA);
    const jugada = await repo.placeBet({
      tenantId: TENANT,
      chatId: CHAT,
      userTelegramId: RICA,
      stake: 900_000,
      betId: "b1",
      resolve: () => ({ multiplier: 0 }),
    });

    // El nonce NO es opcional aunque la apuesta sea gratis: de el depende que
    // el resultado se pueda recomputar, y dos apuestas con el mismo nonce
    // darian el mismo resultado.
    expect(jugada.ok).toBe(true);
    expect(jugada.nonce).toBe(antes.nonce + 1);
    expect(await saldoDe(RICA)).toBe(10);
  });

  it("mantiene la guarda de saldo de una cartera normal", async () => {
    const res = await repo.debit(TENANT, CHAT, NORMAL, 101, "shop-buy", "a");

    expect(res).toEqual({ ok: false, balance: 100 });
    expect(await saldoDe(NORMAL)).toBe(100);
  });

  it("no deja que dos cobros simultaneos pasen los dos", async () => {
    // La prueba de que la guarda sigue tomando el bloqueo de la fila. Si el
    // cobro se hubiera vuelto un "leer y luego escribir", los dos verian 100 y
    // el saldo acabaria en -100.
    const [uno, dos] = await Promise.all([
      repo.debit(TENANT, CHAT, NORMAL, 100, "shop-buy", "a"),
      repo.debit(TENANT, CHAT, NORMAL, 100, "shop-buy", "b"),
    ]);

    expect([uno.ok, dos.ok].filter(Boolean)).toHaveLength(1);
    expect(await saldoDe(NORMAL)).toBe(0);
  });

  it("apagarla devuelve la guarda de saldo a su sitio", async () => {
    await repo.setUnlimited({
      tenantId: TENANT,
      chatId: CHAT,
      userTelegramId: RICA,
      unlimited: false,
    });

    expect(
      await repo.debit(TENANT, CHAT, RICA, 5_000, "shop-buy", "a"),
    ).toEqual({
      ok: false,
      balance: 10,
    });
  });
});
