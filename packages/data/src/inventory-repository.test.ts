import { describe, expect, it } from "vitest";
import { InMemoryInventoryRepository } from "./inventory-repository.js";

const T = "t1";
const C = "c1";
const YO = 1n;
const AHORA = 1_000_000_000_000;
const HORA_MS = 3_600_000;

describe("InMemoryInventoryRepository", () => {
  it("guarda un consumible con sus usos", async () => {
    const repo = new InMemoryInventoryRepository();
    const fila = await repo.grant({
      tenantId: T,
      chatId: C,
      userTelegramId: YO,
      itemId: "navaja",
      addUses: 1,
      nowMs: AHORA,
    });
    expect(fila).toEqual({ itemId: "navaja", uses: 1 });
  });

  it("comprar el mismo consumible dos veces suma usos, no duplica filas", async () => {
    const repo = new InMemoryInventoryRepository();
    const compra = () =>
      repo.grant({
        tenantId: T,
        chatId: C,
        userTelegramId: YO,
        itemId: "navaja",
        addUses: 1,
        nowMs: AHORA,
      });
    await compra();
    expect((await compra()).uses).toBe(2);
    expect(await repo.list(T, C, YO)).toHaveLength(1);
  });

  it("un temporal nace con fecha y sin gastar usos", async () => {
    const repo = new InMemoryInventoryRepository();
    const fila = await repo.grant({
      tenantId: T,
      chatId: C,
      userTelegramId: YO,
      itemId: "escudo",
      extendMs: 24 * HORA_MS,
      nowMs: AHORA,
    });
    // Nace con 1 uso aunque no se gaste: con 0, `isUsable` lo leeria como
    // agotado nada mas comprarlo.
    expect(fila).toEqual({
      itemId: "escudo",
      uses: 1,
      expiresAtMs: AHORA + 24 * HORA_MS,
    });
  });

  it("el segundo temporal alarga el primero en vez de tirarlo", async () => {
    const repo = new InMemoryInventoryRepository();
    await repo.grant({
      tenantId: T,
      chatId: C,
      userTelegramId: YO,
      itemId: "escudo",
      extendMs: 24 * HORA_MS,
      nowMs: AHORA,
    });
    // Tres horas despues, con 21 aun por delante: pagar no puede costar tiempo.
    const segundo = await repo.grant({
      tenantId: T,
      chatId: C,
      userTelegramId: YO,
      itemId: "escudo",
      extendMs: 24 * HORA_MS,
      nowMs: AHORA + 3 * HORA_MS,
    });
    expect(segundo.expiresAtMs).toBe(AHORA + 48 * HORA_MS);
  });

  it("si el temporal ya caduco, cuenta desde ahora", async () => {
    const repo = new InMemoryInventoryRepository();
    await repo.grant({
      tenantId: T,
      chatId: C,
      userTelegramId: YO,
      itemId: "escudo",
      extendMs: HORA_MS,
      nowMs: AHORA,
    });
    const despues = AHORA + 5 * HORA_MS;
    const segundo = await repo.grant({
      tenantId: T,
      chatId: C,
      userTelegramId: YO,
      itemId: "escudo",
      extendMs: HORA_MS,
      nowMs: despues,
    });
    expect(segundo.expiresAtMs).toBe(despues + HORA_MS);
  });

  it("renovar sin escribir el texto no borra el que habia", async () => {
    const repo = new InMemoryInventoryRepository();
    await repo.grant({
      tenantId: T,
      chatId: C,
      userTelegramId: YO,
      itemId: "mote",
      extendMs: HORA_MS,
      payload: "el rata",
      nowMs: AHORA,
    });
    const renovado = await repo.grant({
      tenantId: T,
      chatId: C,
      userTelegramId: YO,
      itemId: "mote",
      extendMs: HORA_MS,
      nowMs: AHORA,
    });
    expect(renovado.payload).toBe("el rata");
  });

  it("gasta un uso y deja el resto", async () => {
    const repo = new InMemoryInventoryRepository();
    await repo.grant({
      tenantId: T,
      chatId: C,
      userTelegramId: YO,
      itemId: "navaja",
      addUses: 2,
      nowMs: AHORA,
    });
    expect(
      await repo.consume({
        tenantId: T,
        chatId: C,
        userTelegramId: YO,
        itemId: "navaja",
        nowMs: AHORA,
      }),
    ).toEqual({ ok: true, remaining: 1 });
  });

  it("no gasta lo que no se tiene", async () => {
    const repo = new InMemoryInventoryRepository();
    expect(
      await repo.consume({
        tenantId: T,
        chatId: C,
        userTelegramId: YO,
        itemId: "navaja",
        nowMs: AHORA,
      }),
    ).toEqual({ ok: false, remaining: 0 });
  });

  it("no se puede gastar dos veces el ultimo uso", async () => {
    // El caso que de verdad importa: si dos golpes simultaneos gastaran la
    // misma navaja, el objeto se usaria dos veces pagandolo una.
    const repo = new InMemoryInventoryRepository();
    await repo.grant({
      tenantId: T,
      chatId: C,
      userTelegramId: YO,
      itemId: "navaja",
      addUses: 1,
      nowMs: AHORA,
    });
    const gasto = {
      tenantId: T,
      chatId: C,
      userTelegramId: YO,
      itemId: "navaja",
      nowMs: AHORA,
    };
    expect((await repo.consume(gasto)).ok).toBe(true);
    expect((await repo.consume(gasto)).ok).toBe(false);
  });

  it("no gasta un objeto caducado", async () => {
    const repo = new InMemoryInventoryRepository();
    await repo.grant({
      tenantId: T,
      chatId: C,
      userTelegramId: YO,
      itemId: "escudo",
      extendMs: HORA_MS,
      nowMs: AHORA,
    });
    const res = await repo.consume({
      tenantId: T,
      chatId: C,
      userTelegramId: YO,
      itemId: "escudo",
      nowMs: AHORA + 2 * HORA_MS,
    });
    expect(res.ok).toBe(false);
  });

  it("el inventario es de cada chat, no del bot entero", async () => {
    // La moneda es por grupo; lo que se compra con ella tambien tiene que
    // serlo, o una navaja pagada en un grupo serviria para robar en otro.
    const repo = new InMemoryInventoryRepository();
    await repo.grant({
      tenantId: T,
      chatId: C,
      userTelegramId: YO,
      itemId: "navaja",
      addUses: 1,
      nowMs: AHORA,
    });
    expect(await repo.list(T, "otro-chat", YO)).toEqual([]);
  });
});

describe("historico de compras", () => {
  const compra = (
    repo: InMemoryInventoryRepository,
    itemId: string,
    price: number,
    target?: bigint,
  ) =>
    repo.recordPurchase({
      tenantId: T,
      chatId: C,
      userTelegramId: YO,
      itemId,
      price,
      ...(target !== undefined ? { targetTelegramId: target } : {}),
    });

  it("devuelve la ultima compra dirigida contra alguien", async () => {
    const repo = new InMemoryInventoryRepository();
    await compra(repo, "mute1", 1500, 2n);
    await compra(repo, "mute10", 12000, 2n);
    const ultima = await repo.lastPurchaseAgainst(T, C, 2n, [
      "mute1",
      "mute5",
      "mute10",
    ]);
    // De aqui sale el precio de la fianza: el doble de lo ULTIMO que te cayo.
    expect(ultima?.itemId).toBe("mute10");
    expect(ultima?.price).toBe(12000);
  });

  it("no mezcla lo que le compraron a otra persona", async () => {
    const repo = new InMemoryInventoryRepository();
    await compra(repo, "mute1", 1500, 3n);
    expect(await repo.lastPurchaseAgainst(T, C, 2n, ["mute1"])).toBeNull();
  });

  it("ignora las compras que no van contra nadie", async () => {
    const repo = new InMemoryInventoryRepository();
    await compra(repo, "navaja", 300);
    expect(await repo.lastPurchaseAgainst(T, C, 2n, ["navaja"])).toBeNull();
  });

  it("sin objetos que mirar no hay nada que devolver", async () => {
    const repo = new InMemoryInventoryRepository();
    await compra(repo, "mute1", 1500, 2n);
    expect(await repo.lastPurchaseAgainst(T, C, 2n, [])).toBeNull();
  });
});
