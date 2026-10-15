import { describe, expect, it } from "vitest";

import {
  defaultStealSettings,
  resolveSteal,
  type StealInput,
  type StealSettings,
} from "./steal.js";

/**
 * Robar fichas.
 *
 * Meter todas las monedas en fichas se habia convertido en la forma de esquivar
 * `/robar`: la caja fuerte tiene tope y limite, y el casino no tenia ninguno.
 *
 * **Solo entran las fichas cambiables** (`sellableChips`): el excedente sobre lo
 * comprado con Telegram Stars. Lo pagado con dinero real no entra aqui y no
 * puede entrar — robar eso no es un cambio de juego, es quitarle a alguien algo
 * que pago. Ver la cabecera de `CHIP_REASONS` en `packages/data`.
 */

const AHORA = 1_000_000_000_000;

const ajustes = (over: Partial<StealSettings> = {}): StealSettings => ({
  ...defaultStealSettings,
  enabled: true,
  ...over,
});

const intento = (over: Partial<StealInput> = {}): StealInput => ({
  settings: ajustes(),
  nowMs: AHORA,
  thiefBalance: 100_000,
  victimBalance: 1000,
  successfulSteals: 0,
  lastStealMs: undefined,
  victimLastRobbedMs: undefined,
  samePerson: false,
  // Tirada baja: el robo sale bien.
  roll: 0.01,
  purge: false,
  ...over,
});

describe("sin fichas, todo se comporta como siempre", () => {
  it("el campo ausente no cambia el resultado", () => {
    const sinCampo = resolveSteal(intento());
    const conCero = resolveSteal(intento({ victimSellableChips: 0 }));

    expect(conCero.amount).toBe(sinCampo.amount);
    expect(sinCampo.amountFromChips).toBe(0);
    expect(conCero.amountFromChips).toBe(0);
  });

  it("con monedas de sobra, el botin no toca las fichas", () => {
    // La propiedad que hace seguro el cambio: quien tenga monedas sueltas
    // sigue perdiendo monedas, no fichas.
    const r = resolveSteal(
      intento({ victimBalance: 100_000, victimSellableChips: 50_000 }),
    );

    expect(r.success).toBe(true);
    expect(r.amountFromChips).toBe(0);
  });
});

describe("esconderlo todo en fichas ya no protege", () => {
  it("una victima con TODO en la caja y fichas fuera sigue siendo objetivo", () => {
    // El caso que motiva el cambio: 0 expuesto en monedas, pero 50.000 en
    // fichas cambiables. Antes esto era "victim-too-poor".
    const r = resolveSteal(
      intento({
        victimBalance: 100_000,
        victimProtected: 100_000,
        victimSellableChips: 50_000,
      }),
    );

    expect(r.refusal).toBeUndefined();
    expect(r.success).toBe(true);
    expect(r.amount).toBeGreaterThan(0);
    // Sin monedas expuestas, todo el botin sale de fichas.
    expect(r.amountFromChips).toBe(r.amount);
  });

  it("sin monedas NI fichas sigue siendo demasiado pobre", () => {
    const r = resolveSteal(
      intento({
        victimBalance: 100_000,
        victimProtected: 100_000,
        victimSellableChips: 0,
      }),
    );

    expect(r.refusal).toBe("victim-too-poor");
  });
});

describe("el botin se cobra de monedas primero", () => {
  it("cuando las monedas no llegan, el resto sale de fichas", () => {
    // 10 monedas expuestas y muchas fichas: el botin empieza por las monedas.
    const r = resolveSteal(
      intento({
        victimBalance: 100_010,
        victimProtected: 100_000,
        victimSellableChips: 100_000,
      }),
    );

    expect(r.success).toBe(true);
    expect(r.amountFromChips).toBe(r.amount - 10);
  });

  it("nunca se cobra de fichas mas de las que hay", () => {
    const r = resolveSteal(
      intento({
        victimBalance: 100_000,
        victimProtected: 100_000,
        victimSellableChips: 40,
      }),
    );

    expect(r.amountFromChips).toBeLessThanOrEqual(40);
    expect(r.amount).toBeLessThanOrEqual(40);
  });
});

describe("la multa no toca fichas", () => {
  it("al fallar, lo que se paga sale del saldo del ladron", () => {
    // Es un castigo, no un segundo robo: el ladron paga de lo suyo y las
    // fichas de la victima no entran en la cuenta.
    const r = resolveSteal(
      intento({
        roll: 0.99,
        victimBalance: 100_000,
        victimSellableChips: 50_000,
      }),
    );

    expect(r.success).toBe(false);
    expect(r.amountFromChips).toBe(0);
  });
});
