import { describe, expect, it } from "vitest";

import {
  avisosQueTocan,
  decidirOperacion,
  diagnosticar,
  estadoDeSalud,
  type FichaClinica,
  MARGEN_DE_LA_FACTURA,
  msDeDuelo,
  msHastaElPlazo,
  sigueDeDuelo,
  tocaFallecer,
} from "./enfermedad.js";

const AHORA = new Date("2026-09-02T12:00:00.000Z");
const HORA = 3_600_000;

const sana: FichaClinica = {
  enfermaDesde: null,
  curaCoste: null,
  curaResto: null,
  curaVence: null,
  curaAvisos: 0,
  fallecidaEn: null,
};

const enferma = (parcial: Partial<FichaClinica> = {}): FichaClinica => ({
  enfermaDesde: AHORA,
  curaCoste: 499_997_500,
  curaResto: 2_500,
  curaVence: new Date(AHORA.getTime() + 72 * HORA),
  curaAvisos: 0,
  fallecidaEn: null,
  ...parcial,
});

describe("estadoDeSalud", () => {
  it("una recien nacida esta sana", () => {
    expect(estadoDeSalud(sana, AHORA)).toBe("sana");
  });

  it("dentro del plazo esta enferma", () => {
    expect(estadoDeSalud(enferma(), AHORA)).toBe("enferma");
  });

  it("separa vencida de muerta", () => {
    // Entre que vence el plazo y que pasa el barrido hay hasta quince minutos.
    // Durante ese rato ya no se puede salvar, pero todavia no ha muerto:
    // confundirlas dejaria cobrar una operacion por un bicho condenado.
    const pasada = enferma({ curaVence: new Date(AHORA.getTime() - HORA) });
    expect(estadoDeSalud(pasada, AHORA)).toBe("vencida");
    expect(tocaFallecer(pasada, AHORA)).toBe(true);

    const muerta = enferma({ fallecidaEn: new Date(AHORA.getTime() - HORA) });
    expect(estadoDeSalud(muerta, AHORA)).toBe("muerta");
    expect(tocaFallecer(muerta, AHORA)).toBe(false);
  });

  it("la muerte manda sobre todo lo demas", () => {
    const rara = enferma({ fallecidaEn: AHORA, curaVence: null });
    expect(estadoDeSalud(rara, AHORA)).toBe("muerta");
  });
});

describe("diagnosticar", () => {
  const base = {
    ficha: sana,
    hambre: 80,
    saldo: 500_000_000,
    resto: 2_500,
    horasDePlazo: 72,
    motivo: "colico por listo",
    ahora: AHORA,
  };

  it("la factura es todo lo que tiene menos el resto pactado", () => {
    const salida = diagnosticar(base);
    expect(salida.ok).toBe(true);
    if (!salida.ok) {
      return;
    }
    expect(salida.dolencia.coste).toBe(499_997_500);
    expect(salida.dolencia.resto).toBe(2_500);
    expect(salida.dolencia.vence.getTime()).toBe(AHORA.getTime() + 72 * HORA);
    expect(salida.dolencia.motivo).toBe("colico por listo");
  });

  it("no reenferma a una que ya lo esta", () => {
    // Es el fallo mas facil de cometer: escribes el mando dos veces porque no
    // viste la primera respuesta, y le regalas tres dias mas de plazo.
    const salida = diagnosticar({ ...base, ficha: enferma() });
    expect(salida).toEqual({ ok: false, motivo: "yaEnferma" });
  });

  it("no enferma a una muerta", () => {
    const salida = diagnosticar({
      ...base,
      ficha: enferma({ fallecidaEn: AHORA }),
    });
    expect(salida).toEqual({ ok: false, motivo: "yaMuerta" });
  });

  it("no enferma a una dormida", () => {
    // A hambre cero lleva dias sin dueño: nadie va a leer la factura y el plazo
    // vence solo. Eso no es una decision, es un accidente con pasos extra.
    const salida = diagnosticar({ ...base, hambre: 0 });
    expect(salida).toEqual({ ok: false, motivo: "dormida" });
  });

  it("exige motivo", () => {
    expect(diagnosticar({ ...base, motivo: "   " })).toEqual({
      ok: false,
      motivo: "sinMotivo",
    });
  });

  it("no enferma a quien no tiene mas que el resto", () => {
    // Una operacion de cero monedas no es una operacion, y matarla porque no
    // tiene nada seria castigar la pobreza.
    expect(diagnosticar({ ...base, saldo: 2_500 })).toEqual({
      ok: false,
      motivo: "sinSaldo",
    });
    expect(diagnosticar({ ...base, saldo: 40 })).toEqual({
      ok: false,
      motivo: "sinSaldo",
    });
  });

  it("un plazo absurdo cae a las 72 horas", () => {
    const salida = diagnosticar({ ...base, horasDePlazo: Number.NaN });
    expect(salida.ok).toBe(true);
    if (salida.ok) {
      expect(salida.dolencia.vence.getTime()).toBe(AHORA.getTime() + 72 * HORA);
    }
  });
});

describe("decidirOperacion", () => {
  it("cobra hasta dejarlo en el resto pactado", () => {
    const salida = decidirOperacion({
      ficha: enferma(),
      saldo: 500_000_000,
      ahora: AHORA,
    });
    expect(salida).toEqual({ ok: true, aPagar: 499_997_500, resto: 2_500 });
  });

  it("cuidar al bicho mientras tanto no impide salvarlo", () => {
    // Seis raciones en tres dias son 900 monedas. Sin el margen, quien le da de
    // comer mientras reune el dinero se quedaria sin operar por haberlo
    // cuidado, que es justo al reves de lo que esto premia.
    const salida = decidirOperacion({
      ficha: enferma(),
      saldo: 500_000_000 - 900,
      ahora: AHORA,
    });
    expect(salida.ok).toBe(true);
    if (salida.ok) {
      // Se le cobra menos, y aun asi se queda en el suelo pactado.
      expect(salida.aPagar).toBe(499_996_600);
      expect(salida.resto).toBe(2_500);
    }
  });

  it("esconder el dinero no sale barato", () => {
    // El agujero que tapa el minimo congelado: vaciar la cartera un minuto para
    // operar por cuatro monedas y que te la devuelvan despues.
    const salida = decidirOperacion({
      ficha: enferma(),
      saldo: 100_000,
      ahora: AHORA,
    });
    expect(salida.ok).toBe(false);
    if (!salida.ok) {
      expect(salida.motivo).toBe("noLlega");
    }
  });

  it("el margen es exactamente el que dice la constante", () => {
    const justo = decidirOperacion({
      ficha: enferma(),
      saldo: 500_000_000 - MARGEN_DE_LA_FACTURA,
      ahora: AHORA,
    });
    expect(justo.ok).toBe(true);

    const uno_mas = decidirOperacion({
      ficha: enferma(),
      saldo: 500_000_000 - MARGEN_DE_LA_FACTURA - 1,
      ahora: AHORA,
    });
    expect(uno_mas.ok).toBe(false);
  });

  it("no cobra fuera de plazo", () => {
    // Cobrar cientos de millones por un bicho que se iba a morir igual es la
    // peor forma de que esto falle.
    const salida = decidirOperacion({
      ficha: enferma({ curaVence: new Date(AHORA.getTime() - 1) }),
      saldo: 500_000_000,
      ahora: AHORA,
    });
    expect(salida.ok).toBe(false);
    if (!salida.ok) {
      expect(salida.motivo).toBe("fueraDePlazo");
    }
  });

  it("no cobra a una sana ni a una muerta", () => {
    const deSana = decidirOperacion({ ficha: sana, saldo: 100, ahora: AHORA });
    expect(deSana.ok).toBe(false);
    if (!deSana.ok) {
      expect(deSana.motivo).toBe("sanaYa");
    }

    const deMuerta = decidirOperacion({
      ficha: enferma({ fallecidaEn: AHORA }),
      saldo: 500_000_000,
      ahora: AHORA,
    });
    expect(deMuerta.ok).toBe(false);
    if (!deMuerta.ok) {
      expect(deMuerta.motivo).toBe("yaMuerta");
    }
  });
});

describe("los avisos", () => {
  it("cuentan cuantos tocan, no si toca ahora", () => {
    const ficha = enferma();
    const vence = new Date(AHORA.getTime() + 72 * HORA);
    // Recien declarada: ninguno.
    expect(avisosQueTocan(ficha, AHORA)).toBe(0);
    // A 25 horas del final: todavia ninguno.
    expect(avisosQueTocan(ficha, new Date(vence.getTime() - 25 * HORA))).toBe(
      0,
    );
    // A 20 horas: el primero.
    expect(avisosQueTocan(ficha, new Date(vence.getTime() - 20 * HORA))).toBe(
      1,
    );
    // A 2 horas: los dos.
    expect(avisosQueTocan(ficha, new Date(vence.getTime() - 2 * HORA))).toBe(2);
  });

  it("un worker caido medio dia no se salta ninguno", () => {
    // Es la razon de que esto devuelva un numero y no un booleano: si el
    // barrido no corre entre las 24 y las 6 horas restantes, al volver ve que
    // tocan dos y manda el que falta en vez de perderlo.
    const ficha = enferma({ curaAvisos: 0 });
    const vence = new Date(AHORA.getTime() + 72 * HORA);
    const tarde = new Date(vence.getTime() - 3 * HORA);
    expect(avisosQueTocan(ficha, tarde)).toBe(2);
  });

  it("no avisa de una vencida ni de una muerta", () => {
    const vencida = enferma({ curaVence: new Date(AHORA.getTime() - HORA) });
    expect(avisosQueTocan(vencida, AHORA)).toBe(0);
    expect(avisosQueTocan(enferma({ fallecidaEn: AHORA }), AHORA)).toBe(0);
  });
});

describe("el plazo y el duelo", () => {
  it("dice lo que queda mientras se pueda pagar", () => {
    const ficha = enferma();
    expect(msHastaElPlazo(ficha, AHORA)).toBe(72 * HORA);
    expect(msHastaElPlazo(ficha, new Date(AHORA.getTime() + 80 * HORA))).toBe(
      0,
    );
    expect(msHastaElPlazo(sana, AHORA)).toBe(0);
  });

  it("el duelo impide tener otra hasta que pasa", () => {
    const muerta = enferma({ fallecidaEn: AHORA });
    expect(sigueDeDuelo(muerta, 48, AHORA)).toBe(true);
    expect(msDeDuelo(muerta, 48, AHORA)).toBe(48 * HORA);

    const despues = new Date(AHORA.getTime() + 49 * HORA);
    expect(sigueDeDuelo(muerta, 48, despues)).toBe(false);
    expect(msDeDuelo(muerta, 48, despues)).toBe(0);
  });

  it("una viva nunca esta de duelo", () => {
    expect(sigueDeDuelo(sana, 48, AHORA)).toBe(false);
    expect(sigueDeDuelo(enferma(), 48, AHORA)).toBe(false);
  });
});
