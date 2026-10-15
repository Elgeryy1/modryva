import { describe, expect, it } from "vitest";

import { InMemoryEconomyRepository } from "./economy-repository.js";

/**
 * Ejecutar → fallar → reintentar, con el efecto ocurriendo EXACTAMENTE una vez.
 *
 * Es la propiedad de la que depende todo el arreglo del ciclo de updates. Desde
 * que el poller dejo de perder los updates que fallan, un update se reprocesa
 * ENTERO cuando un intento anterior murio a mitad — con los efectos que aquel
 * intento ya aplico. Sin idempotencia, arreglar la perdida de updates habria
 * cambiado un problema por otro peor: en vez de no pagar, pagar dos veces.
 *
 * Lo que hace correcta a la clave es que sea **determinista**. Estos tests
 * prueban las dos caras: con una clave estable el efecto ocurre una vez, y con
 * una que cambia en cada intento ocurre dos. La segunda es la que da sentido a
 * la primera, y es exactamente el fallo que tenian diez sitios del servicio.
 */

const TENANT = "t1";
const CHAT = "c1";
const USUARIO = 7n;

/**
 * Un intento de pago que aplica el abono y **despues** revienta.
 *
 * Es el caso que importa: el efecto ya ocurrio, el pipeline murio antes de
 * marcar el update como procesado, y Telegram lo va a reenviar.
 */
const intentoQueMuereDespuesDeCobrar = async (
  economia: InMemoryEconomyRepository,
  clave: string,
): Promise<void> => {
  await economia.credit(TENANT, CHAT, USUARIO, 100, "earn", clave);
  throw new Error("el pipeline murio despues de aplicar el efecto");
};

describe("reintento con clave determinista", () => {
  it("el abono ocurre UNA vez aunque el update se reprocese", async () => {
    const economia = new InMemoryEconomyRepository();
    // Deterministica: derivada del updateId, igual en los dos intentos.
    const clave = "u12345:premio";

    // Primer intento: cobra y revienta.
    await expect(
      intentoQueMuereDespuesDeCobrar(economia, clave),
    ).rejects.toThrow();

    // Telegram reenvia el update y el pipeline corre entero otra vez.
    const reintento = await economia.credit(
      TENANT,
      CHAT,
      USUARIO,
      100,
      "earn",
      clave,
    );

    // `ok: false` aqui significa "ya estaba hecho", no un error.
    expect(reintento.ok).toBe(false);
    expect(reintento.balance).toBe(100);
  });

  it("tres reintentos seguidos siguen dejando el saldo en uno", async () => {
    const economia = new InMemoryEconomyRepository();
    const clave = "u12345:premio";

    for (let intento = 0; intento < 4; intento += 1) {
      await economia.credit(TENANT, CHAT, USUARIO, 100, "earn", clave);
    }

    const { balance } = await economia.credit(
      TENANT,
      CHAT,
      USUARIO,
      0,
      "earn",
      "u12345:consulta",
    );
    expect(balance).toBe(100);
  });

  it("dos efectos DISTINTOS del mismo update no se estorban", async () => {
    const economia = new InMemoryEconomyRepository();

    // El cobro de una fianza y su devolucion son dos apuntes del mismo update:
    // por eso la clave lleva sufijo. Si compartieran clave, la devolucion no
    // ocurriria nunca.
    await economia.credit(TENANT, CHAT, USUARIO, 100, "earn", "u9:cobro");
    const segundo = await economia.credit(
      TENANT,
      CHAT,
      USUARIO,
      50,
      "earn",
      "u9:devolucion",
    );

    expect(segundo.ok).toBe(true);
    expect(segundo.balance).toBe(150);
  });
});

describe("por que la clave tiene que ser determinista", () => {
  it("con una clave que cambia en cada intento, el abono ocurre DOS veces", async () => {
    const economia = new InMemoryEconomyRepository();

    // Esto es lo que hacian diez sitios del servicio hasta el 2026-08-19:
    // `randomUUID()` como refId. El mecanismo de idempotencia existia y no
    // protegia de nada, porque el segundo intento traia otra clave.
    await expect(
      intentoQueMuereDespuesDeCobrar(economia, "aleatoria-1"),
    ).rejects.toThrow();

    const reintento = await economia.credit(
      TENANT,
      CHAT,
      USUARIO,
      100,
      "earn",
      "aleatoria-2",
    );

    // Pagado dos veces. Este test documenta el fallo, no lo aprueba: si algun
    // dia empieza a dar 100, es que el repositorio dejo de mirar el refId.
    expect(reintento.ok).toBe(true);
    expect(reintento.balance).toBe(200);
  });

  it("una clave con la hora dentro falla al cruzar el minuto", async () => {
    const economia = new InMemoryEconomyRepository();

    // El otro caso real que se encontro: `m${minuto}` como clave. Protege
    // dentro del mismo minuto y deja de proteger justo despues, que es cuando
    // llega un reintento con backoff.
    const minuto = (ms: number) => `m${Math.floor(ms / 60_000)}`;
    const alFallar = 1_800_000_000_000;
    const alReintentar = alFallar + 61_000;

    await economia.credit(TENANT, CHAT, USUARIO, 100, "earn", minuto(alFallar));
    const reintento = await economia.credit(
      TENANT,
      CHAT,
      USUARIO,
      100,
      "earn",
      minuto(alReintentar),
    );

    expect(reintento.balance).toBe(200);
  });
});
