import { describe, expect, it } from "vitest";

import {
  informeDeCrossposting,
  informeDeTemasEmergentes,
  informeDeTemasInactivos,
  type MensajeConTema,
} from "./informes-de-temas.js";

const AHORA = new Date("2026-08-22T12:00:00Z").getTime();
const UN_DIA = 24 * 60 * 60 * 1000;

const m = (parcial: Partial<MensajeConTema> = {}): MensajeConTema => ({
  temaId: "1",
  texto: "hola",
  enMs: AHORA,
  ...parcial,
});

describe("sin datos, los tres lo dicen", () => {
  it("crossposting", () => {
    expect(informeDeCrossposting([])).toContain("No hay mensajes");
  });

  it("temas emergentes", () => {
    expect(informeDeTemasEmergentes([], AHORA)).toContain("No hay actividad");
  });

  it("temas inactivos", () => {
    // Y ademas sugiere la causa mas probable, que es que el grupo no use temas.
    expect(informeDeTemasInactivos([], AHORA, 7)).toContain("temas de foro");
  });
});

describe("informeDeTemasEmergentes compara dos ventanas de 24h", () => {
  it("un tema que sube de actividad sale como emergente", () => {
    const mensajes = [
      // Ayer: uno.
      m({ temaId: "9", enMs: AHORA - UN_DIA - 3600_000 }),
      // Hoy: cuatro.
      m({ temaId: "9", enMs: AHORA - 1000 }),
      m({ temaId: "9", enMs: AHORA - 2000 }),
      m({ temaId: "9", enMs: AHORA - 3000 }),
      m({ temaId: "9", enMs: AHORA - 4000 }),
    ];

    expect(informeDeTemasEmergentes(mensajes, AHORA)).toContain("tema 9");
  });

  it("lo de hace mas de 48h no cuenta para ninguna ventana", () => {
    const viejo = [m({ temaId: "9", enMs: AHORA - UN_DIA * 5 })];

    expect(informeDeTemasEmergentes(viejo, AHORA)).toContain(
      "No hay actividad",
    );
  });

  it("un mensaje del FUTURO se descarta", () => {
    // Un reloj mal puesto en un cliente no puede inventar actividad. Es el
    // caso que no tenia test cuando esto vivia en el nucleo.
    const futuro = [m({ temaId: "9", enMs: AHORA + UN_DIA })];

    expect(informeDeTemasEmergentes(futuro, AHORA)).toContain(
      "No hay actividad",
    );
  });
});

describe("informeDeTemasInactivos cuenta desde el ULTIMO mensaje", () => {
  it("un tema con actividad reciente no sale", () => {
    const mensajes = [
      m({ temaId: "3", enMs: AHORA - UN_DIA * 30 }),
      m({ temaId: "3", enMs: AHORA - 1000 }),
    ];

    expect(informeDeTemasInactivos(mensajes, AHORA, 7)).toContain(
      "Ningún tema",
    );
  });

  it("un tema parado mas dias de los pedidos si sale", () => {
    const mensajes = [m({ temaId: "3", enMs: AHORA - UN_DIA * 20 })];

    const texto = informeDeTemasInactivos(mensajes, AHORA, 7);
    expect(texto).toContain("tema 3");
    expect(texto).toContain("20d");
  });

  it("el umbral de dias lo pone quien llama", () => {
    const mensajes = [m({ temaId: "3", enMs: AHORA - UN_DIA * 10 })];

    expect(informeDeTemasInactivos(mensajes, AHORA, 7)).toContain("tema 3");
    expect(informeDeTemasInactivos(mensajes, AHORA, 30)).toContain(
      "Ningún tema",
    );
  });
});

describe("informeDeCrossposting", () => {
  it("los mensajes sin texto no cuentan", () => {
    expect(informeDeCrossposting([m({ texto: "" })])).toContain(
      "No hay mensajes",
    );
  });

  it("sin repeticiones, lo dice en vez de callarse", () => {
    const mensajes = [
      m({ temaId: "1", texto: "una cosa completamente distinta aqui" }),
      m({ temaId: "2", texto: "otra cosa que no se parece en nada" }),
    ];

    expect(informeDeCrossposting(mensajes)).toContain("Sin crossposting");
  });
});
