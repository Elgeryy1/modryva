import { describe, expect, it } from "vitest";
import {
  defaultGroupCurrencySettings,
  formatCurrency,
  parseGroupCurrencySettings,
  sanitizeCurrencyText,
} from "./group-currency.js";

describe("sanitizeCurrencyText", () => {
  it("deja pasar un nombre normal", () => {
    expect(sanitizeCurrencyText("pavos", 20)).toBe("pavos");
  });

  it("quita los caracteres que romperian el Markdown del mensaje", () => {
    expect(sanitizeCurrencyText("*pa_vos*", 20)).toBe("pavos");
    expect(sanitizeCurrencyText("`[chapas]`", 20)).toBe("chapas");
  });

  it("no se come espacios ni parentesis, que son legitimos", () => {
    expect(sanitizeCurrencyText("pavos (de oro)", 20)).toBe("pavos (de oro)");
    expect(sanitizeCurrencyText("dolares & centavos", 20)).toBe(
      "dolares & centavos",
    );
  });

  it("colapsa saltos de linea y espacios repetidos", () => {
    expect(sanitizeCurrencyText("pa  vos\n\nde oro", 40)).toBe("pa vos de oro");
  });

  it("recorta por code points sin partir un emoji", () => {
    expect(sanitizeCurrencyText("🪙🪙🪙🪙🪙🪙", 4)).toBe("🪙🪙🪙🪙");
  });

  it("devuelve null cuando no queda nada util", () => {
    expect(sanitizeCurrencyText("***", 20)).toBeNull();
    expect(sanitizeCurrencyText("   ", 20)).toBeNull();
    expect(sanitizeCurrencyText(42, 20)).toBeNull();
    expect(sanitizeCurrencyText(undefined, 20)).toBeNull();
  });
});

describe("parseGroupCurrencySettings", () => {
  it("cae entero a los valores por defecto con basura", () => {
    expect(parseGroupCurrencySettings(null)).toEqual(
      defaultGroupCurrencySettings,
    );
    expect(parseGroupCurrencySettings("nope")).toEqual(
      defaultGroupCurrencySettings,
    );
  });

  it("nace apagada: nadie se encuentra una economia sin pedirla", () => {
    expect(parseGroupCurrencySettings({}).enabled).toBe(false);
    expect(parseGroupCurrencySettings({ enabled: "si" }).enabled).toBe(false);
    expect(parseGroupCurrencySettings({ enabled: true }).enabled).toBe(true);
  });

  it("respeta lo que el grupo configura", () => {
    const s = parseGroupCurrencySettings({
      enabled: true,
      nombre: "chapas",
      simbolo: "🔩",
      porMensaje: 2,
      cupoDiario: 500,
      minCaracteres: 10,
      cooldownSegundos: 30,
      premioPartida: 40,
      monedasPorFicha: 3,
      comisionVentaPct: 15,
    });
    expect(s).toEqual({
      enabled: true,
      nombre: "chapas",
      simbolo: "🔩",
      porMensaje: 2,
      cupoDiario: 500,
      minCaracteres: 10,
      cooldownSegundos: 30,
      premioPartida: 40,
      monedasPorFicha: 3,
      comisionVentaPct: 15,
    });
  });

  it("el cambio a fichas nace apagado: mezclar monedas es decision del grupo", () => {
    expect(parseGroupCurrencySettings({}).monedasPorFicha).toBe(0);
  });

  it("admite un premio de 0: partidas sin recompensa", () => {
    expect(parseGroupCurrencySettings({ premioPartida: 0 }).premioPartida).toBe(
      0,
    );
  });

  it("ignora numeros imposibles en vez de repartir con ellos", () => {
    const s = parseGroupCurrencySettings({
      porMensaje: -5,
      cupoDiario: 0,
      minCaracteres: 1.5,
      cooldownSegundos: "rapido",
    });
    expect(s.porMensaje).toBe(defaultGroupCurrencySettings.porMensaje);
    expect(s.cupoDiario).toBe(defaultGroupCurrencySettings.cupoDiario);
    expect(s.minCaracteres).toBe(defaultGroupCurrencySettings.minCaracteres);
    expect(s.cooldownSegundos).toBe(
      defaultGroupCurrencySettings.cooldownSegundos,
    );
  });

  it("admite el cero donde significa algo: sin espera y sin minimo", () => {
    const s = parseGroupCurrencySettings({
      minCaracteres: 0,
      cooldownSegundos: 0,
    });
    expect(s.minCaracteres).toBe(0);
    expect(s.cooldownSegundos).toBe(0);
  });

  it("sanea el nombre que escribio el admin", () => {
    expect(parseGroupCurrencySettings({ nombre: "*pavos*" }).nombre).toBe(
      "pavos",
    );
    // Un nombre que se queda en nada cae al defecto, no a cadena vacia.
    expect(parseGroupCurrencySettings({ nombre: "___" }).nombre).toBe(
      defaultGroupCurrencySettings.nombre,
    );
  });
});

describe("formatCurrency", () => {
  it("escribe la cantidad con separador de miles espanol", () => {
    const s = parseGroupCurrencySettings({ nombre: "pavos", simbolo: "🪙" });
    expect(formatCurrency(1234, s)).toBe("1.234 🪙 pavos");
  });

  it("trunca decimales: la moneda son unidades enteras", () => {
    expect(formatCurrency(10.9, defaultGroupCurrencySettings)).toBe(
      "10 🪙 monedas",
    );
  });
});
