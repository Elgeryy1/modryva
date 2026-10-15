import { describe, expect, it } from "vitest";

import {
  AJUSTES_POR_DEFECTO,
  PETS_SETTINGS_KEY,
  parsearAjustes,
} from "./ajustes.js";
import type { EstadoDeMascota } from "./estado.js";
import {
  cerrarDia,
  NIVEL_DE_EVOLUCION,
  NIVEL_MAXIMO,
  nivelParaXp,
  progresoDeNivel,
  XP_POR_DIA_CUIDADO,
  xpParaNivel,
  xpParaSiguiente,
} from "./nivel.js";

const bien: EstadoDeMascota = { hambre: 80, animo: 80, nivel: 1, xp: 0 };

describe("la curva de niveles", () => {
  it("empieza en el uno con cero", () => {
    expect(nivelParaXp(0)).toBe(1);
    expect(xpParaNivel(1)).toBe(0);
  });

  it("cada nivel cuesta mas que el anterior", () => {
    for (let n = 2; n < NIVEL_MAXIMO; n += 1) {
      const tramo = xpParaNivel(n + 1) - xpParaNivel(n);
      const anterior = xpParaNivel(n) - xpParaNivel(n - 1);
      expect(tramo).toBeGreaterThan(anterior);
    }
  });

  it("no pasa del tope por mucha experiencia que tenga", () => {
    expect(nivelParaXp(999_999)).toBe(NIVEL_MAXIMO);
  });

  it("aguanta una experiencia corrupta sin romperse", () => {
    expect(nivelParaXp(-50)).toBe(1);
    expect(nivelParaXp(Number.NaN)).toBe(1);
  });

  it("la barra va de cero a uno dentro del nivel", () => {
    expect(progresoDeNivel({ ...bien, xp: 0 })).toBe(0);
    const mitad = progresoDeNivel({ ...bien, xp: xpParaNivel(2) / 2 });
    expect(mitad).toBeGreaterThan(0);
    expect(mitad).toBeLessThan(1);
  });

  it("al tope la barra esta llena, no a medias", () => {
    expect(progresoDeNivel({ ...bien, xp: 999_999 })).toBe(1);
    expect(xpParaSiguiente({ ...bien, xp: 999_999 })).toBe(0);
  });

  it("llegar al nivel 10 cuesta un par de meses de cuidado", () => {
    // El nivel de evolucion tiene que sentirse como una meta. Si cayera en dos
    // semanas, evolucionar dejaria de significar nada.
    const dias = xpParaNivel(NIVEL_DE_EVOLUCION) / XP_POR_DIA_CUIDADO;
    expect(dias).toBeGreaterThan(45);
    expect(dias).toBeLessThan(120);
  });
});

describe("cerrar el dia", () => {
  it("un dia bien cuidado suma experiencia", () => {
    const cierre = cerrarDia(bien);
    expect(cierre.cuidada).toBe(true);
    expect(cierre.estado.xp).toBe(XP_POR_DIA_CUIDADO);
  });

  it("un dia con el bicho hambriento no suma nada", () => {
    const cierre = cerrarDia({ ...bien, hambre: 20 });
    expect(cierre.cuidada).toBe(false);
    expect(cierre.estado.xp).toBe(0);
    // Y no castiga: no resta. La XP ganada no se pierde por un mal dia.
    expect(cierre.estado).toEqual({ ...bien, hambre: 20 });
  });

  it("avisa el dia que sube de nivel, y solo ese dia", () => {
    const justoAntes = { ...bien, xp: xpParaNivel(2) - XP_POR_DIA_CUIDADO };
    expect(cerrarDia(justoAntes).haSubido).toBe(true);
    expect(cerrarDia({ ...bien, xp: 0 }).haSubido).toBe(false);
  });

  it("avisa de la evolucion justo al cruzar el nivel 10", () => {
    const justoAntes = {
      ...bien,
      xp: xpParaNivel(NIVEL_DE_EVOLUCION) - XP_POR_DIA_CUIDADO,
    };
    const cierre = cerrarDia(justoAntes);
    expect(cierre.evoluciona).toBe(true);
    // Y no lo repite al dia siguiente, que seria anunciar dos veces lo mismo.
    expect(cerrarDia(cierre.estado).evoluciona).toBe(false);
  });

  it("el nivel guardado queda al dia con la experiencia", () => {
    const cierre = cerrarDia({ ...bien, xp: xpParaNivel(3) });
    expect(cierre.estado.nivel).toBe(nivelParaXp(cierre.estado.xp));
  });
});

describe("los ajustes del grupo", () => {
  it("la clave no cambia: es donde estan los ajustes ya guardados", () => {
    expect(PETS_SETTINGS_KEY).toBe("group_pets");
  });

  it("sale apagado", () => {
    expect(AJUSTES_POR_DEFECTO.activo).toBe(false);
    expect(parsearAjustes(undefined).activo).toBe(false);
  });

  it("los avisos salen apagados, y ademas se piden uno a uno", () => {
    expect(AJUSTES_POR_DEFECTO.avisos).toBe(false);
  });

  it("el primer huevo es gratis salvo que el grupo diga lo contrario", () => {
    expect(AJUSTES_POR_DEFECTO.primerHuevoGratis).toBe(true);
    expect(parsearAjustes({ primerHuevoGratis: false }).primerHuevoGratis).toBe(
      false,
    );
  });

  it("acepta lo que entiende y deja el resto como estaba", () => {
    const leidos = parsearAjustes({ activo: true, precioRacion: 200 });
    expect(leidos.activo).toBe(true);
    expect(leidos.precioRacion).toBe(200);
    expect(leidos.racionesPorDia).toBe(AJUSTES_POR_DEFECTO.racionesPorDia);
  });

  it("un cero es 'no he puesto nada', no comida gratis", () => {
    expect(parsearAjustes({ precioRacion: 0 }).precioRacion).toBe(
      AJUSTES_POR_DEFECTO.precioRacion,
    );
    expect(
      parsearAjustes({ topeDiarioPorMascota: 0 }).topeDiarioPorMascota,
    ).toBe(AJUSTES_POR_DEFECTO.topeDiarioPorMascota);
  });

  it("basura guardada no deja al grupo sin mascotas", () => {
    expect(parsearAjustes("cualquier cosa")).toEqual(AJUSTES_POR_DEFECTO);
    expect(parsearAjustes(null)).toEqual(AJUSTES_POR_DEFECTO);
    expect(parsearAjustes({ precioRacion: "mucho" }).precioRacion).toBe(
      AJUSTES_POR_DEFECTO.precioRacion,
    );
  });

  it("el tope del grupo es de otro orden que el de una mascota", () => {
    // Son dos cinturones para dos fallos distintos: un bicho roto y un grupo
    // con mas mascotas de las previstas.
    expect(AJUSTES_POR_DEFECTO.topeDiarioDeGrupo).toBeGreaterThan(
      AJUSTES_POR_DEFECTO.topeDiarioPorMascota * 10,
    );
  });
});
