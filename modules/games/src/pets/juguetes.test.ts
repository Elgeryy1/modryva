import { describe, expect, it } from "vitest";
import { ANIMO_POR_HORA, ANIMO_POR_JUEGO, MAXIMO } from "./estado.js";
import {
  esJugueteId,
  JUGUETES,
  JUGUETES_EN_ORDEN,
  JUGUETES_POR_DIA,
  usarJuguete,
} from "./juguetes.js";

describe("el catalogo de juguetes", () => {
  it("el orden nombra a todos y solo a los que hay", () => {
    expect([...JUGUETES_EN_ORDEN].sort()).toEqual(Object.keys(JUGUETES).sort());
  });

  it("cada id se reconoce y nada mas", () => {
    for (const id of JUGUETES_EN_ORDEN) {
      expect(esJugueteId(id)).toBe(true);
    }
    expect(esJugueteId("navaja")).toBe(false);
    expect(esJugueteId("")).toBe(false);
  });

  it("el caro rinde mejor por moneda que el barato", () => {
    // Si no, no habria decision: se compraria siempre el mismo.
    const porMoneda = (id: keyof typeof JUGUETES) =>
      JUGUETES[id].animo / JUGUETES[id].precio;
    expect(porMoneda("ovillo")).toBeGreaterThan(porMoneda("pelota"));
  });

  it("la cometa llena la barra venga de donde venga", () => {
    expect(JUGUETES.cometa.animo).toBe(MAXIMO);
  });
});

describe("el tope diario", () => {
  it("con juguetes se puede tapar el desgaste del dia, y sin ellos no", () => {
    // ESTA es la cuenta que justifica que existan. El dia quita 24; jugar
    // gratis devuelve 15, asi que sin comprar nada el animo siempre baja.
    const pierdeAlDia = 24 * ANIMO_POR_HORA;
    expect(ANIMO_POR_JUEGO).toBeLessThan(pierdeAlDia);

    const conDosPelotas = ANIMO_POR_JUEGO + 2 * JUGUETES.pelota.animo;
    expect(conDosPelotas).toBeGreaterThan(pierdeAlDia);
  });

  it("tres al dia no regalan la barra llena por poco dinero", () => {
    // El tope es lo que impide que el animo mida el saldo en vez del cuidado.
    const loMaximoQueSeCompra = JUGUETES_POR_DIA * JUGUETES.cometa.precio;
    expect(loMaximoQueSeCompra).toBeGreaterThan(4000);
  });
});

describe("usarJuguete", () => {
  it("sube el animo lo que dice el juguete", () => {
    const salida = usarJuguete({
      juguete: JUGUETES.pelota,
      animo: 30,
      usadosHoy: 0,
    });
    expect(salida).toEqual({ ok: true, animo: 45, subida: 15 });
  });

  it("no se pasa del tope, y la subida es solo lo que cupo", () => {
    const salida = usarJuguete({
      juguete: JUGUETES.ovillo,
      animo: 80,
      usadosHoy: 0,
    });
    expect(salida).toEqual({ ok: true, animo: MAXIMO, subida: 20 });
  });

  it("la cometa llena desde donde sea", () => {
    for (const animo of [0, 1, 55, 99]) {
      const salida = usarJuguete({
        juguete: JUGUETES.cometa,
        animo,
        usadosHoy: 0,
      });
      expect(salida.ok && salida.animo).toBe(MAXIMO);
    }
  });

  it("con la barra llena se dice que no, en vez de cobrar por nada", () => {
    // Cobrar 1.500 por una cometa que no cambia nada es la mentira que este
    // repo persigue en todas partes.
    const salida = usarJuguete({
      juguete: JUGUETES.cometa,
      animo: MAXIMO,
      usadosHoy: 0,
    });
    expect(salida).toEqual({ ok: false, motivo: "yaLlena" });
  });

  it("al llegar al tope del dia no deja usar mas", () => {
    const salida = usarJuguete({
      juguete: JUGUETES.pelota,
      animo: 10,
      usadosHoy: JUGUETES_POR_DIA,
    });
    expect(salida).toEqual({ ok: false, motivo: "topeDiario" });
  });

  it("el ultimo del dia si entra", () => {
    const salida = usarJuguete({
      juguete: JUGUETES.pelota,
      animo: 10,
      usadosHoy: JUGUETES_POR_DIA - 1,
    });
    expect(salida.ok).toBe(true);
  });

  it("el tope lo puede pisar el grupo", () => {
    expect(
      usarJuguete({
        juguete: JUGUETES.pelota,
        animo: 10,
        usadosHoy: 1,
        topeDiario: 1,
      }),
    ).toEqual({ ok: false, motivo: "topeDiario" });
  });

  it("un tope de cero apaga los juguetes del todo", () => {
    expect(
      usarJuguete({
        juguete: JUGUETES.pelota,
        animo: 10,
        usadosHoy: 0,
        topeDiario: 0,
      }),
    ).toEqual({ ok: false, motivo: "topeDiario" });
  });

  it("un animo negativo o fuera de rango no rompe la cuenta", () => {
    const salida = usarJuguete({
      juguete: JUGUETES.pelota,
      animo: -20,
      usadosHoy: 0,
    });
    expect(salida).toEqual({ ok: true, animo: 15, subida: 15 });
  });
});
