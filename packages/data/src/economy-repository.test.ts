import { describe, expect, it } from "vitest";
import { InMemoryEconomyRepository } from "./economy-repository.js";

const T = "t1";
const C = "c1";

describe("InMemoryEconomyRepository", () => {
  it("crea la cartera con el saldo de bienvenida solo la primera vez", async () => {
    const repo = new InMemoryEconomyRepository();
    expect(await repo.ensureWallet(T, C, 1n, 100)).toEqual({
      balance: 100,
      lastEarnedMs: 0,
    });
    // El segundo intento NO vuelve a regalar: seria una fuente infinita para
    // quien supiera provocarlo.
    expect(await repo.ensureWallet(T, C, 1n, 100)).toEqual({
      balance: 100,
      lastEarnedMs: 0,
    });
  });

  it("abona una vez por (motivo, refId) aunque se reintente", async () => {
    const repo = new InMemoryEconomyRepository();
    const first = await repo.credit(T, C, 1n, 50, "earn", "2026-08-11");
    const second = await repo.credit(T, C, 1n, 50, "earn", "2026-08-11");

    expect(first).toEqual({ ok: true, balance: 50 });
    // ok:false aqui significa "ya estaba hecho", y el saldo no se movio.
    expect(second).toEqual({ ok: false, balance: 50 });
  });

  it("permite repetir el mismo motivo con refId distinto", async () => {
    const repo = new InMemoryEconomyRepository();
    await repo.credit(T, C, 1n, 50, "earn", "2026-08-11");
    const otroDia = await repo.credit(T, C, 1n, 50, "earn", "2026-08-12");
    expect(otroDia).toEqual({ ok: true, balance: 100 });
  });

  it("no deja el saldo en negativo", async () => {
    const repo = new InMemoryEconomyRepository();
    await repo.credit(T, C, 1n, 30, "earn", "a");
    const res = await repo.debit(T, C, 1n, 100, "fine", "b");
    expect(res).toEqual({ ok: false, balance: 30 });
  });

  it("mueve saldo entre dos personas dejando las dos patas del apunte", async () => {
    const repo = new InMemoryEconomyRepository();
    await repo.credit(T, C, 1n, 100, "earn", "a");

    const res = await repo.move({
      tenantId: T,
      chatId: C,
      fromId: 1n,
      toId: 2n,
      amount: 40,
      fromReason: "donate-out",
      toReason: "donate-in",
      refId: "mov-1",
    });

    expect(res).toEqual({ ok: true, fromBalance: 60 });
    expect((await repo.getWallet(T, C, 2n))?.balance).toBe(40);

    const delQueDona = await repo.history(T, C, 1n, 10);
    const delQueRecibe = await repo.history(T, C, 2n, 10);
    expect(delQueDona[0]).toMatchObject({ delta: -40, reason: "donate-out" });
    expect(delQueRecibe[0]).toMatchObject({ delta: 40, reason: "donate-in" });
  });

  it("rechaza moverse saldo a uno mismo", async () => {
    const repo = new InMemoryEconomyRepository();
    await repo.credit(T, C, 1n, 100, "earn", "a");
    const res = await repo.move({
      tenantId: T,
      chatId: C,
      fromId: 1n,
      toId: 1n,
      amount: 10,
      fromReason: "donate-out",
      toReason: "donate-in",
      refId: "mov-1",
    });
    expect(res.ok).toBe(false);
    expect(res.error).toBe("self");
  });

  it("rechaza un importe negativo: seria una donacion que roba", async () => {
    const repo = new InMemoryEconomyRepository();
    await repo.credit(T, C, 1n, 10, "earn", "a");
    await repo.credit(T, C, 2n, 500, "earn", "b");

    // Sin esta guarda, -100 le restaria 100 a la victima y se los sumaria a
    // quien "dona". La comprobacion de saldo no lo ve: 10 >= -100 es cierto.
    const res = await repo.move({
      tenantId: T,
      chatId: C,
      fromId: 1n,
      toId: 2n,
      amount: -100,
      fromReason: "donate-out",
      toReason: "donate-in",
      refId: "mov-1",
    });

    expect(res.ok).toBe(false);
    expect((await repo.getWallet(T, C, 1n))?.balance).toBe(10);
    expect((await repo.getWallet(T, C, 2n))?.balance).toBe(500);
  });

  it("no mueve nada cuando al origen no le llega", async () => {
    const repo = new InMemoryEconomyRepository();
    await repo.credit(T, C, 1n, 10, "earn", "a");
    const res = await repo.move({
      tenantId: T,
      chatId: C,
      fromId: 1n,
      toId: 2n,
      amount: 40,
      fromReason: "donate-out",
      toReason: "donate-in",
      refId: "mov-1",
    });
    expect(res).toEqual({ ok: false, error: "insufficient", fromBalance: 10 });
    expect((await repo.getWallet(T, C, 2n))?.balance).toBe(0);
  });

  it("ordena el ranking por saldo y deja fuera a los que estan a cero", async () => {
    const repo = new InMemoryEconomyRepository();
    await repo.credit(T, C, 1n, 10, "earn", "a");
    await repo.credit(T, C, 2n, 90, "earn", "b");
    await repo.credit(T, C, 3n, 50, "earn", "c");
    await repo.ensureWallet(T, C, 4n);

    expect(await repo.top(T, C, 10)).toEqual([
      { userTelegramId: 2n, balance: 90 },
      { userTelegramId: 3n, balance: 50 },
      { userTelegramId: 1n, balance: 10 },
    ]);
  });

  it("mantiene separadas las carteras de dos chats distintos", async () => {
    const repo = new InMemoryEconomyRepository();
    await repo.credit(T, "chatA", 1n, 100, "earn", "a");
    await repo.credit(T, "chatB", 1n, 5, "earn", "a");

    expect((await repo.getWallet(T, "chatA", 1n))?.balance).toBe(100);
    expect((await repo.getWallet(T, "chatB", 1n))?.balance).toBe(5);
    expect(await repo.top(T, "chatB", 10)).toEqual([
      { userTelegramId: 1n, balance: 5 },
    ]);
  });

  it("devuelve el historial del mas reciente al mas antiguo", async () => {
    const repo = new InMemoryEconomyRepository();
    await repo.credit(T, C, 1n, 10, "earn", "a");
    await repo.credit(T, C, 1n, 20, "earn", "b");
    await repo.debit(T, C, 1n, 5, "fine", "c");

    const movimientos = await repo.history(T, C, 1n, 10);
    expect(movimientos.map((m) => m.delta)).toEqual([-5, 20, 10]);
  });
});

/**
 * El saldo sin fondo.
 *
 * Lo que estos tests fijan no es "un numero muy grande", es que el numero DEJA
 * DE CONTAR: la cartera paga siempre, no se le abona nada, y quien lleva la
 * cuenta de lo que paso es el libro mayor. Si alguna vez el saldo de una
 * cartera ilimitada se mueve, la bandera se ha convertido otra vez en un saldo
 * alto —y un saldo alto se acaba y desborda, que es justo lo que existia antes.
 */
describe("InMemoryEconomyRepository con saldo sin fondo", () => {
  it("paga aunque el saldo no llegue, y el saldo no se mueve", async () => {
    const repo = new InMemoryEconomyRepository();
    await repo.credit(T, C, 1n, 10, "earn", "a");
    await repo.setUnlimited({
      tenantId: T,
      chatId: C,
      userTelegramId: 1n,
      unlimited: true,
    });

    const res = await repo.debit(T, C, 1n, 999_999, "shop-buy", "b");

    expect(res).toEqual({ ok: true, balance: 10 });
  });

  it("tampoco se le abona: esta congelado en los dos sentidos", async () => {
    const repo = new InMemoryEconomyRepository();
    await repo.setUnlimited({
      tenantId: T,
      chatId: C,
      userTelegramId: 1n,
      unlimited: true,
    });

    const res = await repo.credit(T, C, 1n, 500, "earn", "a");

    // Un saldo que sube seria un saldo que un dia se pasa del `integer`. Este
    // no sube nunca, asi que no puede reventar.
    expect(res).toEqual({ ok: true, balance: 0 });
  });

  it("anota en el libro todo lo que el saldo ya no cuenta", async () => {
    const repo = new InMemoryEconomyRepository();
    await repo.setUnlimited({
      tenantId: T,
      chatId: C,
      userTelegramId: 1n,
      unlimited: true,
    });
    await repo.debit(T, C, 1n, 700, "shop-buy", "a");
    await repo.credit(T, C, 1n, 40, "earn", "b");

    const movimientos = await repo.history(T, C, 1n, 10);
    expect(movimientos.map((m) => m.delta)).toEqual([40, -700]);
  });

  it("dona sin fondo y el destinatario cobra de verdad", async () => {
    const repo = new InMemoryEconomyRepository();
    await repo.setUnlimited({
      tenantId: T,
      chatId: C,
      userTelegramId: 1n,
      unlimited: true,
    });

    const res = await repo.move({
      tenantId: T,
      chatId: C,
      fromId: 1n,
      toId: 2n,
      amount: 250_000,
      fromReason: "donate-out",
      toReason: "donate-in",
      refId: "d1",
    });

    expect(res).toEqual({ ok: true, fromBalance: 0 });
    // La pata que SI mueve dinero es la del que recibe: el grifo esta abierto
    // en un solo sentido y la otra cartera es una cartera normal.
    expect((await repo.getWallet(T, C, 2n))?.balance).toBe(250_000);
  });

  it("apagarla devuelve la guarda de saldo tal y como estaba", async () => {
    const repo = new InMemoryEconomyRepository();
    await repo.credit(T, C, 1n, 10, "earn", "a");
    await repo.setUnlimited({
      tenantId: T,
      chatId: C,
      userTelegramId: 1n,
      unlimited: true,
    });
    await repo.setUnlimited({
      tenantId: T,
      chatId: C,
      userTelegramId: 1n,
      unlimited: false,
    });

    expect(await repo.debit(T, C, 1n, 999, "shop-buy", "b")).toEqual({
      ok: false,
      balance: 10,
    });
  });

  it("lista quien la tiene, y solo en ese chat", async () => {
    const repo = new InMemoryEconomyRepository();
    await repo.credit(T, C, 1n, 10, "earn", "a");
    await repo.credit(T, "otroChat", 2n, 10, "earn", "b");
    await repo.setUnlimited({
      tenantId: T,
      chatId: C,
      userTelegramId: 1n,
      unlimited: true,
    });
    await repo.setUnlimited({
      tenantId: T,
      chatId: "otroChat",
      userTelegramId: 2n,
      unlimited: true,
    });

    // El privilegio es por cartera, asi que el listado tambien: mezclarlos
    // haria creer que alguien lo tiene aqui cuando lo tiene en otro grupo.
    expect(await repo.unlimitedWallets(T, C)).toEqual([
      { userTelegramId: 1n, balance: 10 },
    ]);
  });

  it("no toca la bandera al guardar un saldo", async () => {
    const repo = new InMemoryEconomyRepository();
    await repo.setUnlimited({
      tenantId: T,
      chatId: C,
      userTelegramId: 1n,
      unlimited: true,
    });
    // `setWallet` sirve para guardar lo ganado hablando. No es el sitio desde
    // el que se quita un privilegio, y si lo fuera se quitaria solo al primer
    // mensaje.
    await repo.setWallet(T, C, 1n, { balance: 5, lastEarnedMs: 1 });

    expect((await repo.getWallet(T, C, 1n))?.unlimited).toBe(true);
  });
});
