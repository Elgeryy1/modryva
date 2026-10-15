import { describe, expect, it } from "vitest";

import {
  defaultStealSettings,
  resolveSteal,
  type StealModifiers,
} from "../steal.js";
import {
  fusionarModificadores,
  modificadoresDeRoboPorMascota,
} from "./en-el-robo.js";

describe("las mascotas dentro del robo", () => {
  it("el zorro engorda el botin y acorta la espera", () => {
    const m = modificadoresDeRoboPorMascota({ deQuienRoba: "zorro" });
    expect(m.lootMultiplier).toBeGreaterThan(1);
    expect(m.cooldownMultiplier).toBeLessThan(1);
    expect(m.cooldownMultiplier).toBeGreaterThan(0);
  });

  it("la tortuga defiende a su dueño y no le ayuda a robar", () => {
    const comoVictima = modificadoresDeRoboPorMascota({
      deLaVictima: "tortuga",
    });
    expect(comoVictima.victimGuardPct).toBeGreaterThan(0);

    // El mismo bicho atacando no aporta nada: su efecto es defensivo. Sin esta
    // separacion, una especie protectora seria ademas una ventaja ofensiva
    // gratis.
    const comoLadron = modificadoresDeRoboPorMascota({
      deQuienRoba: "tortuga",
    });
    expect(comoLadron).toEqual({});
  });

  it("quien no tiene bicho no cambia nada del robo", () => {
    // Las tres formas de "no hay bicho": el campo ausente y el nulo. No se
    // prueba pasar `undefined` explicito porque con
    // `exactOptionalPropertyTypes` eso no compila, que es justo lo que se
    // quiere.
    expect(modificadoresDeRoboPorMascota({})).toEqual({});
    expect(modificadoresDeRoboPorMascota({ deQuienRoba: null })).toEqual({});
    expect(
      modificadoresDeRoboPorMascota({ deQuienRoba: null, deLaVictima: null }),
    ).toEqual({});
  });

  it("una especie que ya no existe no rompe el robo", () => {
    expect(
      modificadoresDeRoboPorMascota({ deQuienRoba: "bicho-retirado" }),
    ).toEqual({});
  });
});

describe("fusionar los objetos con las mascotas", () => {
  it("los multiplicadores se multiplican, no se suman", () => {
    // EL error facil de este fichero. Sumandolos, 1.2 y 1.25 darian 2.45 en vez
    // de 1.5: el doble de botin por llevar dos ventajas pequeñas.
    const fusion = fusionarModificadores(
      { lootMultiplier: 1.2 },
      { lootMultiplier: 1.25 },
    );
    expect(fusion.lootMultiplier).toBeCloseTo(1.5);
  });

  it("los porcentajes se suman, que es como los entiende el motor", () => {
    const fusion = fusionarModificadores(
      { victimGuardPct: 15 },
      { victimGuardPct: 20 },
    );
    expect(fusion.victimGuardPct).toBe(35);
  });

  it("las banderas se combinan con un o", () => {
    expect(
      fusionarModificadores({ ignoreCooldown: true }, { ignoreCooldown: false })
        .ignoreCooldown,
    ).toBe(true);
    expect(
      fusionarModificadores({ victimImmune: false }, {}).victimImmune,
    ).toBe(false);
  });

  it("lo que no traen ninguno de los dos se queda sin poner", () => {
    // Y no con su neutro: `resolveSteal` distingue "no hay multiplicador" de
    // "hay uno que vale 1", y llenarlo de neutros haria que cualquier cambio
    // futuro en esa distincion se rompiera en silencio.
    expect(fusionarModificadores({}, {})).toEqual({});
    expect(fusionarModificadores(undefined, undefined)).toEqual({});
  });

  it("da igual el orden de los dos", () => {
    const objetos: StealModifiers = {
      attackerBonusPct: 25,
      lootMultiplier: 1.5,
      ignoreCooldown: true,
    };
    const mascotas = modificadoresDeRoboPorMascota({
      deQuienRoba: "zorro",
      deLaVictima: "tortuga",
    });
    expect(fusionarModificadores(objetos, mascotas)).toEqual(
      fusionarModificadores(mascotas, objetos),
    );
  });
});

describe("el efecto que se nota de verdad", () => {
  const base = {
    settings: { ...defaultStealSettings, enabled: true },
    nowMs: 10_000_000,
    thiefBalance: 5000,
    victimBalance: 5000,
    successfulSteals: 0,
    lastStealMs: undefined,
    victimLastRobbedMs: undefined,
    samePerson: false,
    purge: false,
  };

  it("la tortuga baja de verdad la probabilidad de que le roben", () => {
    const sinBicho = resolveSteal({ ...base, roll: 0 });
    const conTortuga = resolveSteal({
      ...base,
      roll: 0,
      modifiers: modificadoresDeRoboPorMascota({ deLaVictima: "tortuga" }),
    });
    expect(conTortuga.chancePct).toBeLessThan(sinBicho.chancePct);
  });

  it("el zorro se lleva mas cuando acierta", () => {
    // `roll: 0` entra siempre: lo que se compara es el botin, no la suerte.
    const sinBicho = resolveSteal({ ...base, roll: 0 });
    const conZorro = resolveSteal({
      ...base,
      roll: 0,
      modifiers: modificadoresDeRoboPorMascota({ deQuienRoba: "zorro" }),
    });
    expect(sinBicho.success).toBe(true);
    expect(conZorro.success).toBe(true);
    expect(conZorro.amount).toBeGreaterThan(sinBicho.amount);
  });

  it("el zorro puede volver a robar antes que los demas", () => {
    // Media hora de espera por defecto: a los veinte minutos, quien no tiene
    // zorro sigue esperando y el zorro ya ha vuelto.
    const haceVeinteMinutos = base.nowMs - 20 * 60 * 1000;
    const sinBicho = resolveSteal({
      ...base,
      roll: 0,
      lastStealMs: haceVeinteMinutos,
    });
    expect(sinBicho.refusal).toBe("cooldown");

    const conZorro = resolveSteal({
      ...base,
      roll: 0,
      lastStealMs: haceVeinteMinutos,
      modifiers: modificadoresDeRoboPorMascota({ deQuienRoba: "zorro" }),
    });
    expect(conZorro.refusal).toBe("cooldown");
    // No se salta la espera: la acorta. Un cuarto menos de 30 minutos son 22
    // y medio, asi que a los veinte todavia le faltan un par.
    expect(conZorro.retryAfterSeconds).toBeLessThan(
      sinBicho.retryAfterSeconds ?? 0,
    );
  });

  it("un recorte corrupto no alarga la espera en vez de acortarla", () => {
    // Los numeros salen de un catalogo escrito a mano. Un valor mayor que uno
    // convertiria la ventaja en un castigo, y eso no se ve hasta que alguien
    // se queja de que su bicho le hace esperar mas.
    const conBasura = resolveSteal({
      ...base,
      roll: 0,
      lastStealMs: base.nowMs - 40 * 60 * 1000,
      modifiers: { cooldownMultiplier: 5 },
    });
    expect(conBasura.attempted).toBe(true);
  });
});
