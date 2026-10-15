/**
 * Las dos propiedades atomicas de las mascotas, contra POSTGRES REAL.
 *
 * POR QUE ESTE FICHERO EXISTE. Las dos cosas que aqui se prueban **no se pueden
 * probar con un doble en memoria**, porque las dos dependen de garantias que
 * pone la base de datos y no el codigo:
 *
 * 1. **Comer es atomico.** Que dos raciones simultaneas no cobren dos veces lo
 *    garantiza `updateMany` con el saldo en el WHERE, que es una condicion
 *    evaluada por Postgres. Un fake que lea, decida y escriba en JavaScript
 *    pasaria el test y fallaria en produccion.
 * 2. **El rendimiento se paga una vez al dia.** Lo garantiza el unique de
 *    `economy_ledger` sobre (tenant, chat, persona, motivo, refId). Un fake que
 *    guarde en un Map con otra clave no lo comprueba.
 * 3. **Operar de urgencia es atomico**, y es la que mas dinero mueve: la
 *    factura es "todo lo que tienes menos un resto", asi que puede vaciar una
 *    cartera de cientos de millones. Lo que la sostiene es que la cura va
 *    PRIMERO y condicionada a que siga enferma, dentro de la misma transaccion
 *    que el cobro: dos `/operar` seguidos —y llegan seguidos, porque el primero
 *    tarda y la gente repite— no pueden cobrar dos veces. Eso es exclusion
 *    mutua de Postgres, no de JavaScript.
 *
 * Es justo el aviso que da `tenant-isolation.integration.test.ts`: la suite
 * entera corre contra fakes, y varios indexan por menos claves que la base real.
 *
 * COMO EJECUTARLO (necesita Docker):
 *   docker compose up -d postgres
 *   DATABASE_URL=postgresql://superbot:superbot@127.0.0.1:5433/superbot \
 *     node node_modules/prisma/build/index.js migrate deploy --schema packages/data/prisma/schema.prisma
 *   TEST_DATABASE_URL=postgresql://superbot:superbot@127.0.0.1:5433/superbot \
 *     node node_modules/vitest/vitest.mjs run packages/data/src/pet-repository.integration.test.ts
 *
 * Sin `TEST_DATABASE_URL` se salta entero, para que la suite normal no dependa
 * de tener una base de datos levantada.
 */

import { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaPetRepository } from "./pet-repository.js";

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

const TENANT = "tenant-pets-integracion";
const CHAT = "chat-pets-integracion";
const PERSONA = 987_654_321n;
const DIA = "2026-08-28";

const describeSiHayBase = TEST_DATABASE_URL ? describe : describe.skip;

describeSiHayBase("PrismaPetRepository contra Postgres real", () => {
  const client = new PrismaClient({
    datasources: { db: { url: TEST_DATABASE_URL ?? "" } },
  });
  const repo = new PrismaPetRepository(client);

  const limpiar = async (): Promise<void> => {
    await client.pet.deleteMany({ where: { tenantId: TENANT } });
    await client.economyLedger.deleteMany({ where: { tenantId: TENANT } });
    await client.economyWallet.deleteMany({ where: { tenantId: TENANT } });
  };

  const conSaldo = async (saldo: number): Promise<void> => {
    await client.economyWallet.create({
      data: {
        tenantId: TENANT,
        chatId: CHAT,
        userTelegramId: PERSONA,
        balance: saldo,
      },
    });
  };

  const nacer = async () =>
    repo.crear({
      tenantId: TENANT,
      chatId: CHAT,
      userTelegramId: PERSONA,
      especie: "abeja",
      rasgos: ["dormilon"],
      ahora: new Date("2026-08-28T10:00:00Z"),
    });

  beforeEach(limpiar);

  afterAll(async () => {
    await limpiar();
    await client.$disconnect();
  });

  it("guarda y devuelve la mascota con sus rasgos", async () => {
    const creada = await nacer();
    const leida = await repo.obtener(TENANT, CHAT, PERSONA);
    expect(leida?.id).toBe(creada.id);
    expect(leida?.especie).toBe("abeja");
    expect(leida?.rasgos).toEqual(["dormilon"]);
    expect(leida?.hambre).toBe(100);
    expect(leida?.regalada).toBe(false);
  });

  it("una persona no puede tener dos mascotas en el mismo grupo", async () => {
    await nacer();
    await expect(nacer()).rejects.toThrow();
  });

  it("comer cobra y llena en la misma transaccion", async () => {
    await conSaldo(1000);
    const mascota = await nacer();
    const salida = await repo.servirRacion({
      id: mascota.id,
      tenantId: TENANT,
      chatId: CHAT,
      userTelegramId: PERSONA,
      coste: 150,
      hambreNueva: 90,
      xpNueva: 3,
      nivelNuevo: 1,
      diaUtc: DIA,
    });
    expect(salida.ok).toBe(true);
    expect(salida.ok === true && salida.saldo).toBe(850);
    const leida = await repo.obtener(TENANT, CHAT, PERSONA);
    expect(leida?.hambre).toBe(90);
    expect(leida?.racionesHoy).toBe(1);
  });

  it("sin saldo no cobra NI llena: ninguna de las dos mitades", async () => {
    await conSaldo(10);
    const mascota = await nacer();
    const salida = await repo.servirRacion({
      id: mascota.id,
      tenantId: TENANT,
      chatId: CHAT,
      userTelegramId: PERSONA,
      coste: 150,
      hambreNueva: 90,
      xpNueva: 3,
      nivelNuevo: 1,
      diaUtc: DIA,
    });
    expect(salida.ok).toBe(false);
    const leida = await repo.obtener(TENANT, CHAT, PERSONA);
    // La mitad que importa: el hambre NO ha subido. Si hubiera subido, seria
    // comida gratis.
    expect(leida?.hambre).toBe(100);
    const cartera = await client.economyWallet.findFirst({
      where: { tenantId: TENANT },
    });
    expect(cartera?.balance).toBe(10);
  });

  it("dos raciones a la vez no cobran dos veces con saldo para una", async () => {
    // ESTE es el test que un doble en memoria no puede dar. El saldo llega
    // justo para una racion; las dos salen a la vez.
    await conSaldo(150);
    const mascota = await nacer();
    const peticion = {
      id: mascota.id,
      tenantId: TENANT,
      chatId: CHAT,
      userTelegramId: PERSONA,
      coste: 150,
      hambreNueva: 90,
      xpNueva: 3,
      nivelNuevo: 1,
      diaUtc: DIA,
    };
    const resultados = await Promise.allSettled([
      repo.servirRacion(peticion),
      repo.servirRacion(peticion),
    ]);
    const servidas = resultados.filter(
      (r) => r.status === "fulfilled" && r.value.ok,
    ).length;
    expect(servidas).toBe(1);
    const cartera = await client.economyWallet.findFirst({
      where: { tenantId: TENANT },
    });
    expect(cartera?.balance).toBe(0);
  });

  it("jugar sube el animo una vez al dia, y solo una", async () => {
    const mascota = await nacer();
    const primera = await repo.jugar({
      id: mascota.id,
      animoNuevo: 60,
      xpNueva: 5,
      nivelNuevo: 1,
      diaUtc: DIA,
    });
    expect(primera).toEqual({ ok: true, animo: 60, nivel: 1 });

    // El segundo intento del mismo dia no sube nada, y devuelve el animo real
    // en vez del que se pretendia dejar: decir 80 sin haberlo puesto seria la
    // misma mentira que un /ban que contesta "hecho" sin banear.
    const segunda = await repo.jugar({
      id: mascota.id,
      animoNuevo: 80,
      xpNueva: 10,
      nivelNuevo: 1,
      diaUtc: DIA,
    });
    // Ni el animo NI la XP: van en el mismo `updateMany`, asi que jugar dos
    // veces el mismo dia no puede sumar experiencia la segunda.
    expect(segunda).toEqual({ ok: false, animo: 60, nivel: 1 });
    const tras = await repo.obtener(TENANT, CHAT, PERSONA);
    expect(tras?.xp).toBe(5);
  });

  it("dos toques a la vez suben el animo UNA vez", async () => {
    // La carrera que un doble en memoria no puede dar: jugar es gratis, asi
    // que sin el dia en el WHERE bastaria con pulsar dos veces seguidas.
    const mascota = await nacer();
    const peticion = {
      id: mascota.id,
      animoNuevo: 70,
      xpNueva: 5,
      nivelNuevo: 1,
      diaUtc: DIA,
    };
    const resultados = await Promise.allSettled([
      repo.jugar(peticion),
      repo.jugar(peticion),
    ]);
    const jugadas = resultados.filter(
      (r) => r.status === "fulfilled" && r.value.ok,
    ).length;
    expect(jugadas).toBe(1);
  });

  it("al dia siguiente se puede volver a jugar", async () => {
    const mascota = await nacer();
    await repo.jugar({
      id: mascota.id,
      animoNuevo: 60,
      xpNueva: 5,
      nivelNuevo: 1,
      diaUtc: DIA,
    });
    const otroDia = await repo.jugar({
      id: mascota.id,
      animoNuevo: 75,
      xpNueva: 10,
      nivelNuevo: 1,
      diaUtc: "2999-01-02",
    });
    expect(otroDia).toEqual({ ok: true, animo: 75, nivel: 1 });
  });

  it("el contador de raciones se reinicia al cambiar el dia", async () => {
    await conSaldo(1000);
    const mascota = await nacer();
    const base = {
      id: mascota.id,
      tenantId: TENANT,
      chatId: CHAT,
      userTelegramId: PERSONA,
      coste: 150,
      hambreNueva: 90,
      xpNueva: 3,
      nivelNuevo: 1,
    };
    await repo.servirRacion({ ...base, diaUtc: DIA });
    const otroDia = await repo.servirRacion({
      ...base,
      diaUtc: "2026-08-29",
    });
    expect(otroDia.ok === true && otroDia.racionesHoy).toBe(1);
  });

  it("el rendimiento del dia se paga una sola vez", async () => {
    // La propiedad que impide que reiniciar el worker imprima dinero.
    await conSaldo(0);
    await nacer();
    const entrada = {
      tenantId: TENANT,
      chatId: CHAT,
      userTelegramId: PERSONA,
      monedas: 380,
      diaUtc: DIA,
    };
    const primera = await repo.pagarRendimiento(entrada);
    const segunda = await repo.pagarRendimiento(entrada);
    expect(primera.ok).toBe(true);
    expect(segunda.ok).toBe(false);
    expect(segunda.ok === false && segunda.motivo).toBe("yaPagadoHoy");
    const cartera = await client.economyWallet.findFirst({
      where: { tenantId: TENANT },
    });
    expect(cartera?.balance).toBe(380);
  });

  it("el segundo intento no deja saldo a medias", async () => {
    // El apunte va antes que el abono a proposito: si el dia ya estaba pagado,
    // el unique lanza sin haber tocado el saldo.
    await conSaldo(0);
    await nacer();
    const entrada = {
      tenantId: TENANT,
      chatId: CHAT,
      userTelegramId: PERSONA,
      monedas: 100,
      diaUtc: DIA,
    };
    await repo.pagarRendimiento(entrada);
    await repo.pagarRendimiento(entrada);
    await repo.pagarRendimiento(entrada);
    const apuntes = await client.economyLedger.count({
      where: { tenantId: TENANT, reason: "pet-yield" },
    });
    expect(apuntes).toBe(1);
  });

  it("dias distintos se pagan los dos", async () => {
    await conSaldo(0);
    await nacer();
    const base = {
      tenantId: TENANT,
      chatId: CHAT,
      userTelegramId: PERSONA,
      monedas: 100,
    };
    await repo.pagarRendimiento({ ...base, diaUtc: DIA });
    const otro = await repo.pagarRendimiento({
      ...base,
      diaUtc: "2026-08-29",
    });
    expect(otro.ok).toBe(true);
    expect(otro.ok === true && otro.saldo).toBe(200);
  });

  it("el corral ordena por nivel y no se mezcla con otros grupos", async () => {
    await nacer();
    await client.pet.create({
      data: {
        tenantId: TENANT,
        chatId: CHAT,
        userTelegramId: 111n,
        especie: "zorro",
        rasgos: [],
        nivel: 7,
        vistaEn: new Date(),
      },
    });
    await client.pet.create({
      data: {
        tenantId: TENANT,
        chatId: "otro-chat",
        userTelegramId: 222n,
        especie: "buho",
        rasgos: [],
        nivel: 99,
        vistaEn: new Date(),
      },
    });
    const corral = await repo.corral(TENANT, CHAT);
    expect(corral).toHaveLength(2);
    expect(corral[0]?.nivel).toBe(7);
    // El bicho de nivel 99 vive en otro grupo: no puede aparecer aqui.
    expect(corral.some((p) => p.especie === "buho")).toBe(false);
  });

  it("la cola del tick trae las mas olvidadas primero", async () => {
    await client.pet.create({
      data: {
        tenantId: TENANT,
        chatId: CHAT,
        userTelegramId: 333n,
        especie: "abeja",
        rasgos: [],
        vistaEn: new Date("2026-08-01T00:00:00Z"),
      },
    });
    await client.pet.create({
      data: {
        tenantId: TENANT,
        chatId: CHAT,
        userTelegramId: 444n,
        especie: "abeja",
        rasgos: [],
        vistaEn: new Date("2026-08-20T00:00:00Z"),
      },
    });
    const cola = await repo.paraElTick(new Date("2026-08-25T00:00:00Z"), 10);
    const mias = cola.filter((p) => p.tenantId === TENANT);
    expect(mias[0]?.userTelegramId).toBe(333n);
  });
  describe("saldo sin fondo", () => {
    // El incidente del 2026-09-11. La bandera `unlimited` se repartio por la
    // puerta comun de la economia y estos cuatro caminos siguieron con su
    // propio `update`: las raciones restaban de carteras congeladas y el
    // rendimiento, con la cartera en el techo del `integer`, reventaba una vez
    // por minuto. Todo esto lo garantiza el WHERE de Postgres, no un `if`, y
    // por eso vive aqui y no en un doble en memoria.
    const conSaldoSinFondo = async (saldo: number): Promise<void> => {
      await client.economyWallet.create({
        data: {
          tenantId: TENANT,
          chatId: CHAT,
          userTelegramId: PERSONA,
          balance: saldo,
          unlimited: true,
        },
      });
    };

    const saldo = async (): Promise<number | undefined> =>
      (
        await client.economyWallet.findFirst({
          where: { tenantId: TENANT, userTelegramId: PERSONA },
        })
      )?.balance;

    it("come sin que se le cobre, y el libro lo anota igual", async () => {
      await conSaldoSinFondo(10);
      const mascota = await nacer();

      const salida = await repo.servirRacion({
        id: mascota.id,
        tenantId: TENANT,
        chatId: CHAT,
        userTelegramId: PERSONA,
        coste: 150,
        hambreNueva: 90,
        xpNueva: 3,
        nivelNuevo: 1,
        diaUtc: DIA,
      });

      // Diez de saldo y una racion de ciento cincuenta: una cartera normal se
      // quedaria sin comer. Esta come y la cifra no se mueve.
      expect(salida.ok).toBe(true);
      expect(await saldo()).toBe(10);
      expect((await repo.obtener(TENANT, CHAT, PERSONA))?.hambre).toBe(90);
      const apuntes = await client.economyLedger.findMany({
        where: { tenantId: TENANT, reason: "pet-feed" },
      });
      expect(apuntes.map((a) => a.delta)).toEqual([-150]);
    });

    it("el rendimiento no desborda una cartera que esta en el techo", async () => {
      // El caso exacto del incidente: 2.147.483.647 mas cualquier cosa pasa del
      // `integer`. Antes esto lanzaba "integer out of range".
      await conSaldoSinFondo(2_147_483_647);

      const pago = await repo.pagarRendimiento({
        tenantId: TENANT,
        chatId: CHAT,
        userTelegramId: PERSONA,
        monedas: 524,
        diaUtc: DIA,
      });

      expect(pago).toEqual({ ok: true, saldo: 2_147_483_647 });
      const apuntes = await client.economyLedger.findMany({
        where: { tenantId: TENANT, reason: "pet-yield" },
      });
      expect(apuntes.map((a) => a.delta)).toEqual([524]);
    });

    it("devolver lo robado tampoco la mueve, pero si salda el pendiente", async () => {
      await conSaldoSinFondo(2_147_483_647);
      const mascota = await nacer();
      await client.pet.update({
        where: { id: mascota.id },
        data: { robadoPendiente: 500 },
      });

      const vuelta = await repo.devolverRobado({
        id: mascota.id,
        tenantId: TENANT,
        chatId: CHAT,
        userTelegramId: PERSONA,
        monedas: 500,
        diaUtc: DIA,
      });

      expect(vuelta.ok).toBe(true);
      expect(await saldo()).toBe(2_147_483_647);
      expect(
        (await client.pet.findUnique({ where: { id: mascota.id } }))
          ?.robadoPendiente,
      ).toBe(0);
    });

    it("operar la cura sin tocar la cifra", async () => {
      const mascota = await nacer();
      await conSaldoSinFondo(3_000);
      await repo.enfermar({
        id: mascota.id,
        desde: new Date("2026-09-02T12:00:00Z"),
        motivo: "colico",
        coste: 997_500,
        resto: 2_500,
        vence: new Date("2026-09-05T12:00:00Z"),
      });

      const salida = await repo.operar({
        id: mascota.id,
        tenantId: TENANT,
        chatId: CHAT,
        userTelegramId: PERSONA,
        aPagar: 997_500,
        resto: 2_500,
        refId: `${mascota.id}:2026-09-02`,
      });

      // Tres mil de saldo y una factura de casi un millon: paga, se cura, y la
      // cartera no se queda en el resto porque no hay fondo que vaciar.
      expect(salida).toEqual({ ok: true, pagado: 997_500, saldo: 3_000 });
      expect(await saldo()).toBe(3_000);
      expect(
        (await repo.obtener(TENANT, CHAT, PERSONA))?.enfermaDesde,
      ).toBeNull();
      const apuntes = await client.economyLedger.findMany({
        where: { tenantId: TENANT, reason: "pet-surgery" },
      });
      expect(apuntes.map((a) => a.delta)).toEqual([-997_500]);
    });
  });

  describe("operar de urgencia", () => {
    const enfermarla = async (
      id: string,
      opciones: { coste: number; resto: number; vence?: Date },
    ) =>
      repo.enfermar({
        id,
        desde: new Date("2026-09-02T12:00:00Z"),
        motivo: "colico",
        coste: opciones.coste,
        resto: opciones.resto,
        vence: opciones.vence ?? new Date("2026-09-05T12:00:00Z"),
      });

    it("cura y cobra dejando la cartera en el resto pactado", async () => {
      const mascota = await nacer();
      await conSaldo(500_000_000);
      await enfermarla(mascota.id, { coste: 499_997_500, resto: 2_500 });

      const salida = await repo.operar({
        id: mascota.id,
        tenantId: TENANT,
        chatId: CHAT,
        userTelegramId: PERSONA,
        aPagar: 499_997_500,
        resto: 2_500,
        refId: `${mascota.id}:2026-09-02`,
      });

      expect(salida.ok).toBe(true);
      const cartera = await client.economyWallet.findFirst({
        where: { tenantId: TENANT, userTelegramId: PERSONA },
      });
      expect(cartera?.balance).toBe(2_500);
      const leida = await repo.obtener(TENANT, CHAT, PERSONA);
      expect(leida?.enfermaDesde).toBeNull();
      expect(leida?.curaCoste).toBeNull();
    });

    it("dos operaciones a la vez cobran UNA sola vez", async () => {
      // La propiedad que este fichero existe para probar. La cura va primero y
      // condicionada a que siga enferma, asi que la segunda no encuentra fila y
      // no llega a cobrar. Un doble en memoria que lea, decida y escriba en
      // JavaScript pasaria este test y fallaria en produccion.
      const mascota = await nacer();
      await conSaldo(1_000_000);
      await enfermarla(mascota.id, { coste: 997_500, resto: 2_500 });

      const peticion = {
        id: mascota.id,
        tenantId: TENANT,
        chatId: CHAT,
        userTelegramId: PERSONA,
        aPagar: 997_500,
        resto: 2_500,
        refId: `${mascota.id}:2026-09-02`,
      };
      const [a, b] = await Promise.all([
        repo.operar(peticion),
        repo.operar(peticion),
      ]);

      expect([a?.ok, b?.ok].filter(Boolean)).toHaveLength(1);
      const cartera = await client.economyWallet.findFirst({
        where: { tenantId: TENANT, userTelegramId: PERSONA },
      });
      expect(cartera?.balance).toBe(2_500);
      const apuntes = await client.economyLedger.findMany({
        where: { tenantId: TENANT, reason: "pet-surgery" },
      });
      expect(apuntes).toHaveLength(1);
    });

    it("sin saldo no cura: la transaccion se deshace entera", async () => {
      // Es el agujero mas caro que podria tener esto. Si el fallo del cobro
      // dejara la cura escrita, bastaria con vaciar la cartera para salvar al
      // bicho gratis.
      const mascota = await nacer();
      await conSaldo(1_000);
      await enfermarla(mascota.id, { coste: 997_500, resto: 2_500 });

      const salida = await repo.operar({
        id: mascota.id,
        tenantId: TENANT,
        chatId: CHAT,
        userTelegramId: PERSONA,
        aPagar: 997_500,
        resto: 2_500,
        refId: `${mascota.id}:2026-09-02`,
      });

      expect(salida.ok).toBe(false);
      const leida = await repo.obtener(TENANT, CHAT, PERSONA);
      expect(leida?.enfermaDesde).not.toBeNull();
      const cartera = await client.economyWallet.findFirst({
        where: { tenantId: TENANT, userTelegramId: PERSONA },
      });
      expect(cartera?.balance).toBe(1_000);
    });

    it("la caja fuerte no puede quedar por encima del saldo", async () => {
      // `protectedBalance` cuenta DENTRO de `balance` y es lo que `/robar` no
      // toca. Uno por encima del saldo real vuelve a alguien intocable sin que
      // se vea por que.
      const mascota = await nacer();
      await client.economyWallet.create({
        data: {
          tenantId: TENANT,
          chatId: CHAT,
          userTelegramId: PERSONA,
          balance: 1_000_000,
          protectedBalance: 900_000,
        },
      });
      await enfermarla(mascota.id, { coste: 997_500, resto: 2_500 });

      await repo.operar({
        id: mascota.id,
        tenantId: TENANT,
        chatId: CHAT,
        userTelegramId: PERSONA,
        aPagar: 997_500,
        resto: 2_500,
        refId: `${mascota.id}:2026-09-02`,
      });

      const cartera = await client.economyWallet.findFirst({
        where: { tenantId: TENANT, userTelegramId: PERSONA },
      });
      expect(cartera?.balance).toBe(2_500);
      expect(cartera?.protectedBalance).toBe(2_500);
    });

    it("una segunda enfermedad SI se puede pagar", async () => {
      // El `refId` lleva la fecha del diagnostico y no solo el id: sin ella, el
      // unique del libro mayor haria que la segunda enfermedad de su vida
      // saliera gratis.
      const mascota = await nacer();
      await conSaldo(1_000_000);
      await enfermarla(mascota.id, { coste: 497_500, resto: 500_000 });
      await repo.operar({
        id: mascota.id,
        tenantId: TENANT,
        chatId: CHAT,
        userTelegramId: PERSONA,
        aPagar: 497_500,
        resto: 500_000,
        refId: `${mascota.id}:2026-09-02`,
      });

      await repo.enfermar({
        id: mascota.id,
        desde: new Date("2026-09-10T12:00:00Z"),
        motivo: "otra vez",
        coste: 497_500,
        resto: 2_500,
        vence: new Date("2026-09-13T12:00:00Z"),
      });
      const segunda = await repo.operar({
        id: mascota.id,
        tenantId: TENANT,
        chatId: CHAT,
        userTelegramId: PERSONA,
        aPagar: 497_500,
        resto: 2_500,
        refId: `${mascota.id}:2026-09-10`,
      });

      expect(segunda.ok).toBe(true);
      const cartera = await client.economyWallet.findFirst({
        where: { tenantId: TENANT, userTelegramId: PERSONA },
      });
      expect(cartera?.balance).toBe(2_500);
    });

    it("no se puede enfermar dos veces a la vez", async () => {
      const mascota = await nacer();
      const [a, b] = await Promise.all([
        enfermarla(mascota.id, { coste: 100, resto: 10 }),
        enfermarla(mascota.id, { coste: 999, resto: 10 }),
      ]);
      expect([a, b].filter(Boolean)).toHaveLength(1);
    });

    it("una muerta sale de la cola del tick", async () => {
      // Como el barrido es quien mueve `vistaEn`, una muerta se quedaria con el
      // reloj parado y volveria a salir en cada lote para siempre.
      const mascota = await nacer();
      await enfermarla(mascota.id, { coste: 100, resto: 10 });
      await repo.fallecer(mascota.id, new Date("2026-09-05T12:00:00Z"));

      const cola = await repo.paraElTick(new Date("2026-09-06T00:00:00Z"), 50);
      expect(cola.filter((p) => p.id === mascota.id)).toEqual([]);

      // Y al revivirla vuelve, con el reloj puesto a ese momento.
      const vuelta = new Date("2026-09-06T12:00:00Z");
      await repo.revivir(mascota.id, vuelta);
      const leida = await repo.obtener(TENANT, CHAT, PERSONA);
      expect(leida?.fallecidaEn).toBeNull();
      expect(leida?.vistaEn.getTime()).toBe(vuelta.getTime());
    });
  });
});
