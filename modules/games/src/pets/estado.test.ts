import { describe, expect, it } from "vitest";
import { HAMBRE_POR_RACION } from "./alimentar.js";

import {
  ANIMO_POR_HORA,
  ANIMO_POR_JUEGO,
  animoTrasJugar,
  aplicarPasoDelTiempo,
  caraDe,
  type EstadoDeMascota,
  estaDormida,
  HAMBRE_POR_HORA,
  MAXIMO,
  msHastaDormirse,
} from "./estado.js";

const HORA = 3_600_000;

const sano: EstadoDeMascota = { hambre: 100, animo: 100, nivel: 1, xp: 0 };

describe("el paso del tiempo", () => {
  it("baja el hambre al ritmo declarado", () => {
    const despues = aplicarPasoDelTiempo(sano, 10 * HORA);
    expect(despues.hambre).toBe(MAXIMO - 10 * HAMBRE_POR_HORA);
  });

  it("baja el animo tres veces mas despacio que el hambre", () => {
    const despues = aplicarPasoDelTiempo(sano, 10 * HORA);
    expect(despues.animo).toBe(MAXIMO - 10 * ANIMO_POR_HORA);
    expect(MAXIMO - despues.animo).toBeLessThan(MAXIMO - despues.hambre);
  });

  it("no toca el nivel ni la experiencia", () => {
    const conNivel = { ...sano, nivel: 4, xp: 120 };
    const despues = aplicarPasoDelTiempo(conNivel, 50 * HORA);
    expect(despues.nivel).toBe(4);
    expect(despues.xp).toBe(120);
  });

  it("aguanta 49 horas con la barra llena, y a las 50 esta dormida", () => {
    // Este es EL numero del diseño: dos dias liados no cuestan el bicho, tres
    // si. Subio de 33 a 50 el 2026-09-02 al bajar el desgaste de 3 a 2 por
    // hora, y el motivo esta medido: a 3 hacian falta tres raciones diarias
    // —450 monedas— solo para no perder terreno, y en produccion habia 26 de
    // 41 mascotas dormidas a hambre cero.
    // Las 50 son exactas —100 puntos a 2 por hora— asi que a esa hora clavada
    // ya esta a cero. El limite util es la hora de antes.
    expect(estaDormida(aplicarPasoDelTiempo(sano, 49 * HORA))).toBe(false);
    expect(estaDormida(aplicarPasoDelTiempo(sano, 50 * HORA))).toBe(true);
  });

  it("dos raciones al dia mantienen la barra, que es el punto de la calibracion", () => {
    // La cuenta que decide si la feature es sostenible: 48 puntos de desgaste
    // al dia contra 50 que dan dos raciones. Si esto se pone en negativo, la
    // barra vuelve a caer sola para todo el mundo por mucho que se cuide.
    const desgasteDiario = 24 * HAMBRE_POR_HORA;
    expect(2 * HAMBRE_POR_RACION).toBeGreaterThan(desgasteDiario);
  });

  it("nunca baja de cero por mucho que se la deje", () => {
    const despues = aplicarPasoDelTiempo(sano, 1000 * HORA);
    expect(despues.hambre).toBe(0);
    expect(despues.animo).toBe(0);
  });

  it("un reloj que va hacia atras no alimenta gratis", () => {
    const hambriento = { ...sano, hambre: 40, animo: 40 };
    expect(aplicarPasoDelTiempo(hambriento, -5 * HORA)).toEqual(hambriento);
    expect(aplicarPasoDelTiempo(hambriento, Number.NaN)).toEqual(hambriento);
  });

  it("acota los valores que ya venian fuera de rango", () => {
    const imposible = { hambre: 150, animo: -20, nivel: 1, xp: 0 };
    const despues = aplicarPasoDelTiempo(imposible, 0);
    expect(despues.hambre).toBe(MAXIMO);
    expect(despues.animo).toBe(0);
  });

  it("el dormilon aguanta mas que uno normal en el mismo tiempo", () => {
    const normal = aplicarPasoDelTiempo(sano, 20 * HORA);
    const dormilon = aplicarPasoDelTiempo(sano, 20 * HORA, ["dormilon"]);
    expect(dormilon.hambre).toBeGreaterThan(normal.hambre);
  });

  it("el gloton no cambia el ritmo del hambre, solo lo que come", () => {
    // Es apetito, no metabolismo: si el gloton se vaciara antes, seria un
    // dormilon al reves y cobraria dos veces por el mismo rasgo.
    const normal = aplicarPasoDelTiempo(sano, 20 * HORA);
    const gloton = aplicarPasoDelTiempo(sano, 20 * HORA, ["gloton"]);
    expect(gloton.hambre).toBe(normal.hambre);
  });
});

describe("la cara", () => {
  const con = (hambre: number, animo: number): EstadoDeMascota => ({
    hambre,
    animo,
    nivel: 1,
    xp: 0,
  });

  it("hambre cero es dormido, no muerto", () => {
    expect(caraDe(con(0, 100))).toBe("dormido");
    expect(caraDe(con(0, 0))).toBe("dormido");
  });

  it("las dos barras por los suelos es enfermo", () => {
    expect(caraDe(con(10, 20))).toBe("enfermo");
  });

  it("el animo bajo manda sobre el hambre baja", () => {
    // Un bicho con hambre Y triste se enseña como triste: es lo que pide accion
    // en las dos cosas, y decir solo "tiene hambre" se queda corto.
    expect(caraDe(con(35, 20))).toBe("triste");
  });

  it("con hambre pero de buen animo", () => {
    expect(caraDe(con(35, 80))).toBe("conHambre");
  });

  it("las dos barras altas es feliz", () => {
    expect(caraDe(con(90, 90))).toBe("feliz");
    expect(caraDe(con(70, 70))).toBe("feliz");
  });

  it("lo de en medio es normal", () => {
    expect(caraDe(con(60, 60))).toBe("normal");
  });
});

describe("cuanto le queda", () => {
  it("cuenta las horas que faltan para dormirse", () => {
    const mitad = { ...sano, hambre: 30 };
    expect(msHastaDormirse(mitad)).toBe((30 / HAMBRE_POR_HORA) * HORA);
  });

  it("una dormida ya no tiene cuenta atras", () => {
    expect(msHastaDormirse({ ...sano, hambre: 0 })).toBe(0);
  });

  it("al dormilon le queda mas tiempo con el mismo hambre", () => {
    const mitad = { ...sano, hambre: 30 };
    expect(msHastaDormirse(mitad, ["dormilon"])).toBeGreaterThan(
      msHastaDormirse(mitad),
    );
  });
});

describe("jugar con ella", () => {
  it("sube el animo lo que dice la constante", () => {
    expect(animoTrasJugar(40)).toBe(40 + ANIMO_POR_JUEGO);
  });

  it("no se pasa del tope", () => {
    // Guardar un 110 dejaria una barra que ninguna pantalla sabe pintar.
    expect(animoTrasJugar(95)).toBe(MAXIMO);
    expect(animoTrasJugar(MAXIMO)).toBe(MAXIMO);
  });

  it("saca de la tristeza a una que estaba a cero", () => {
    // Es LA razon de que exista: hasta ahora el animo solo bajaba y a los
    // cuatro dias toda mascota quedaba triste para siempre.
    expect(animoTrasJugar(0)).toBeGreaterThan(0);
  });

  it("un animo negativo no resta de mas", () => {
    expect(animoTrasJugar(-50)).toBe(ANIMO_POR_JUEGO);
  });

  it("jugar cada dia frena la caida pero no la anula", () => {
    // A proposito: 15 no compensa las 24 que se pierden en un dia. La otra
    // mitad tiene que venir de la actividad en el grupo, que aun no existe.
    expect(ANIMO_POR_JUEGO).toBeLessThan(24 * ANIMO_POR_HORA);
  });
});
