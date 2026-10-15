/**
 * Las mascotas dentro del robo.
 *
 * Traduce lo que aporta un bicho —el zorro que roba mejor, la tortuga que
 * protege, el erizo que hace pagar a quien falla— a los `StealModifiers` que
 * el motor de `/robar` ya sabe consumir, y **los fusiona con los de los
 * objetos de la tienda**.
 *
 * Vive en su propio fichero y no dentro de `steal.ts` porque son dos cosas que
 * cambian por motivos distintos: el motor cambia cuando cambian las reglas del
 * robo, y esto cambia cuando cambia el catalogo de especies. Tampoco vive en
 * `pets/ventajas.ts`, que no conoce —ni debe conocer— la forma de los
 * modificadores del robo: ahi las ventajas son numeros sueltos y aqui es donde
 * se convierten en la forma de otro sistema.
 *
 * **La fusion no es una suma de todo.** Cada campo se combina como le toca:
 *
 * - Los porcentajes de probabilidad se **suman**, porque asi es como los
 *   entiende `stealChancePct`: son puntos que se anaden o se quitan.
 * - Los multiplicadores se **multiplican**, que es lo que hace que llevar
 *   navaja Y zorro sea mejor que cualquiera de los dos, sin que ninguno anule
 *   al otro.
 * - Los booleanos se combinan con **o**: si cualquiera de los dos concede el
 *   salto, se salta.
 *
 * Sumar los multiplicadores seria el error facil y no se nota hasta que
 * alguien acumula dos: 1.2 mas 1.25 son 2.45 en vez de 1.5, o sea el doble de
 * botin por llevar dos ventajas pequeñas.
 *
 * Puro y determinista: sin reloj, sin azar y sin I/O.
 */

import type { StealModifiers } from "../steal.js";
import { ventajasDe } from "./ventajas.js";

/**
 * Lo que aportan las mascotas de las dos partes de un robo.
 *
 * Las dos especies entran como texto y pueden faltar: quien no tiene bicho es
 * el caso mayoritario en cualquier grupo, y tener que preguntarlo fuera es
 * como se acaba olvidando una de las dos ramas.
 */
export const modificadoresDeRoboPorMascota = (input: {
  /** La especie del bicho de quien ataca, si tiene. */
  readonly deQuienRoba?: string | null;
  /** La especie del bicho de quien lo sufre, si tiene. */
  readonly deLaVictima?: string | null;
}): StealModifiers => {
  const ataque = ventajasDe(input.deQuienRoba).robo;
  const defensa = ventajasDe(input.deLaVictima).robo;

  const modificadores: {
    lootMultiplier?: number;
    cooldownMultiplier?: number;
    victimGuardPct?: number;
    fineMultiplier?: number;
  } = {};

  if (ataque.botinMas > 0) {
    modificadores.lootMultiplier = 1 + ataque.botinMas;
  }
  if (ataque.esperaMenos > 0) {
    modificadores.cooldownMultiplier = 1 - ataque.esperaMenos;
  }
  // La probabilidad declarada de "el robo no llega a cobrarse" se traduce a
  // puntos porcentuales de guardia, que es la forma que el motor entiende. El
  // efecto que ve quien juega es el prometido —a veces el golpe contra ti se
  // va a nada— y de paso hereda el tope y la aritmetica ya probados de
  // `stealChancePct` en vez de estrenar una tirada propia.
  if (defensa.bloqueaRobo > 0) {
    modificadores.victimGuardPct = Math.round(defensa.bloqueaRobo * 100);
  }
  if (defensa.contraataca > 0) {
    modificadores.fineMultiplier = 1 + defensa.contraataca;
  }

  return modificadores;
};

/** Multiplica dos multiplicadores opcionales, respetando el "no hay". */
const multiplicar = (
  a: number | undefined,
  b: number | undefined,
): number | undefined => {
  if (a === undefined && b === undefined) {
    return undefined;
  }
  return (a ?? 1) * (b ?? 1);
};

/** Suma dos porcentajes opcionales, respetando el "no hay". */
const sumar = (
  a: number | undefined,
  b: number | undefined,
): number | undefined => {
  if (a === undefined && b === undefined) {
    return undefined;
  }
  return (a ?? 0) + (b ?? 0);
};

/** Combina dos banderas opcionales con "o", respetando el "no hay". */
const oBien = (
  a: boolean | undefined,
  b: boolean | undefined,
): boolean | undefined => {
  if (a === undefined && b === undefined) {
    return undefined;
  }
  return a === true || b === true;
};

/**
 * Junta los modificadores de los objetos con los de las mascotas.
 *
 * El orden de los dos argumentos da igual: la operacion es conmutativa campo a
 * campo, y hay un test que lo comprueba. Es a proposito — quien lo llame no
 * tiene que acordarse de cual va primero.
 *
 * Los campos ausentes se quedan ausentes en vez de aparecer con su neutro. No
 * es cosmetica: `resolveSteal` distingue "no hay multiplicador" de "hay uno
 * que vale 1" en algun sitio, y devolver un objeto lleno de neutros haria que
 * cualquier cambio futuro en esa distincion se rompiera en silencio.
 */
export const fusionarModificadores = (
  unos: StealModifiers | undefined,
  otros: StealModifiers | undefined,
): StealModifiers => {
  const a = unos ?? {};
  const b = otros ?? {};

  const attackerBonusPct = sumar(a.attackerBonusPct, b.attackerBonusPct);
  const victimGuardPct = sumar(a.victimGuardPct, b.victimGuardPct);
  const lootMultiplier = multiplicar(a.lootMultiplier, b.lootMultiplier);
  const fineMultiplier = multiplicar(a.fineMultiplier, b.fineMultiplier);
  const cooldownMultiplier = multiplicar(
    a.cooldownMultiplier,
    b.cooldownMultiplier,
  );
  const ignoreVictimShield = oBien(a.ignoreVictimShield, b.ignoreVictimShield);
  const ignoreCooldown = oBien(a.ignoreCooldown, b.ignoreCooldown);
  const skipFine = oBien(a.skipFine, b.skipFine);
  const victimImmune = oBien(a.victimImmune, b.victimImmune);

  return {
    ...(attackerBonusPct === undefined ? {} : { attackerBonusPct }),
    ...(victimGuardPct === undefined ? {} : { victimGuardPct }),
    ...(lootMultiplier === undefined ? {} : { lootMultiplier }),
    ...(fineMultiplier === undefined ? {} : { fineMultiplier }),
    ...(cooldownMultiplier === undefined ? {} : { cooldownMultiplier }),
    ...(ignoreVictimShield === undefined ? {} : { ignoreVictimShield }),
    ...(ignoreCooldown === undefined ? {} : { ignoreCooldown }),
    ...(skipFine === undefined ? {} : { skipFine }),
    ...(victimImmune === undefined ? {} : { victimImmune }),
  };
};
