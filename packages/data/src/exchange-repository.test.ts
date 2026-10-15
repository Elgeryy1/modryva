import { describe, expect, it } from "vitest";
import { InMemoryExchangeRepository } from "./exchange-repository.js";

const base = {
  tenantId: "t1",
  chatId: "c1",
  telegramUserId: 42n,
  refId: "x1",
};

describe("InMemoryExchangeRepository", () => {
  it("cambia monedas por fichas al precio del grupo", async () => {
    const repo = new InMemoryExchangeRepository();
    repo.coins = 1000;

    const res = await repo.buyChipsWithCoins({
      ...base,
      chips: 10,
      costPerChip: 5,
    });

    expect(res).toMatchObject({
      ok: true,
      chips: 10,
      cost: 50,
      coinBalance: 950,
      chipBalance: 10,
    });
  });

  it("esta apagado mientras el grupo no ponga precio", async () => {
    const repo = new InMemoryExchangeRepository();
    repo.coins = 1000;

    const res = await repo.buyChipsWithCoins({
      ...base,
      chips: 10,
      costPerChip: 0,
    });

    expect(res.ok).toBe(false);
    if (res.ok) throw new Error("esperaba un fallo");
    expect(res.error).toBe("disabled");
    expect(repo.coins).toBe(1000);
  });

  it("no cambia nada si no le llegan las monedas", async () => {
    const repo = new InMemoryExchangeRepository();
    repo.coins = 20;

    const res = await repo.buyChipsWithCoins({
      ...base,
      chips: 10,
      costPerChip: 5,
    });

    expect(res).toMatchObject({ ok: false, error: "insufficient", cost: 50 });
    expect(repo.coins).toBe(20);
    expect(repo.chips).toBe(0);
  });

  it("rechaza cantidades no positivas: un negativo imprimiria dinero", async () => {
    const repo = new InMemoryExchangeRepository();
    repo.coins = 1000;

    // Con -10 el coste seria -50, y restar un negativo ABONA monedas ademas de
    // dar fichas negativas.
    const res = await repo.buyChipsWithCoins({
      ...base,
      chips: -10,
      costPerChip: 5,
    });

    expect(res.ok).toBe(false);
    if (res.ok) throw new Error("esperaba un fallo");
    expect(res.error).toBe("invalid-amount");
    expect(repo.coins).toBe(1000);
    expect(repo.chips).toBe(0);
  });

  it("rechaza cantidades con decimales", async () => {
    const repo = new InMemoryExchangeRepository();
    repo.coins = 1000;

    const res = await repo.buyChipsWithCoins({
      ...base,
      chips: 1.5,
      costPerChip: 5,
    });

    expect(res.ok).toBe(false);
    if (res.ok) throw new Error("esperaba un fallo");
    expect(res.error).toBe("invalid-amount");
  });
});

describe("vender fichas por monedas", () => {
  it("paga al precio del grupo menos la comision", async () => {
    const repo = new InMemoryExchangeRepository();
    repo.chips = 500;

    const res = await repo.sellChipsForCoins({
      ...base,
      chips: 100,
      coinsPerChip: 10,
      feePct: 20,
    });

    // 100 * 10 = 1000 brutos, menos el 20% = 800.
    expect(res).toMatchObject({ ok: true, chips: 100, coins: 800 });
    expect(repo.chips).toBe(400);
    expect(repo.coins).toBe(800);
  });

  it("sin comision paga el precio entero", async () => {
    const repo = new InMemoryExchangeRepository();
    repo.chips = 500;

    const res = await repo.sellChipsForCoins({
      ...base,
      chips: 100,
      coinsPerChip: 10,
      feePct: 0,
    });

    expect(res.coins).toBe(1000);
  });

  it("NO deja vender lo comprado con Stars", async () => {
    // Este es el limite legal del cambio: lo pagado con dinero real no puede
    // convertirse en monedas, porque las monedas se roban y se donan.
    const repo = new InMemoryExchangeRepository();
    repo.chips = 5000;
    repo.locked = 5000; // todo comprado, nada ganado

    const res = await repo.sellChipsForCoins({
      ...base,
      chips: 100,
      coinsPerChip: 10,
      feePct: 20,
    });

    expect(res.ok).toBe(false);
    if (res.ok) throw new Error("esperaba un fallo");
    expect(res.error).toBe("locked");
    expect(res.sellable).toBe(0);
    expect(repo.chips).toBe(5000);
    expect(repo.coins).toBe(0);
  });

  it("deja vender solo el excedente sobre lo comprado", async () => {
    const repo = new InMemoryExchangeRepository();
    repo.chips = 6000;
    repo.locked = 5000; // compro 5.000 y gano 1.000 jugando

    const ok = await repo.sellChipsForCoins({
      ...base,
      chips: 1000,
      coinsPerChip: 1,
      feePct: 0,
    });
    expect(ok.ok).toBe(true);

    // Una ficha mas ya seria de las compradas.
    const no = await repo.sellChipsForCoins({
      ...base,
      chips: 1,
      coinsPerChip: 1,
      feePct: 0,
    });
    expect(no.ok).toBe(false);
    if (no.ok) throw new Error("esperaba un fallo");
    expect(no.error).toBe("locked");
  });

  it("distingue no tener de tenerlas bloqueadas", async () => {
    // Son problemas distintos y se arreglan distinto: uno se soluciona jugando
    // y el otro no se soluciona.
    const repo = new InMemoryExchangeRepository();
    repo.chips = 50;
    repo.locked = 0;

    const res = await repo.sellChipsForCoins({
      ...base,
      chips: 100,
      coinsPerChip: 10,
      feePct: 0,
    });

    expect(res.ok).toBe(false);
    if (res.ok) throw new Error("esperaba un fallo");
    expect(res.error).toBe("insufficient");
  });

  it("esta apagado mientras el grupo no ponga precio", async () => {
    const repo = new InMemoryExchangeRepository();
    repo.chips = 500;

    const res = await repo.sellChipsForCoins({
      ...base,
      chips: 100,
      coinsPerChip: 0,
      feePct: 20,
    });

    expect(res.ok).toBe(false);
    if (res.ok) throw new Error("esperaba un fallo");
    expect(res.error).toBe("disabled");
    expect(repo.chips).toBe(500);
  });

  it("rechaza una venta negativa: abonaria fichas y cobraria monedas", async () => {
    const repo = new InMemoryExchangeRepository();
    repo.chips = 500;

    const res = await repo.sellChipsForCoins({
      ...base,
      chips: -100,
      coinsPerChip: 10,
      feePct: 20,
    });

    expect(res.ok).toBe(false);
    if (res.ok) throw new Error("esperaba un fallo");
    expect(res.error).toBe("invalid-amount");
    expect(repo.chips).toBe(500);
    expect(repo.coins).toBe(0);
  });

  it("rechaza una venta que no llegaria ni a una moneda", async () => {
    // Con una comision del 100% el cambio pagaria 0: cobrar fichas y no dar
    // nada es peor que decir que no.
    const repo = new InMemoryExchangeRepository();
    repo.chips = 500;

    const res = await repo.sellChipsForCoins({
      ...base,
      chips: 10,
      coinsPerChip: 1,
      feePct: 100,
    });

    expect(res.ok).toBe(false);
    if (res.ok) throw new Error("esperaba un fallo");
    expect(res.error).toBe("invalid-amount");
    expect(repo.chips).toBe(500);
  });
});
