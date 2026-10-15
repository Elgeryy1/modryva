/**
 * Abrir un huevo: que especie sale y con que rasgos.
 *
 * Todo sale del **commit-reveal que ya usa el casino**: el hash de la semilla se
 * enseña al comprar el huevo y la semilla se revela al abrirlo, asi que
 * cualquiera puede recomputar su resultado. No es adorno. El dia que a alguien
 * le salga tres veces seguidas lo que no queria va a decir que el bot le odia,
 * y la unica respuesta que sirve es *"recomputalo tu mismo"*.
 *
 * El principio que ordena las tablas: **eliges la direccion, el azar elige el
 * detalle.** El huevo basico no se elige y solo saca comunes; el de familia
 * elige familia y el azar la especie de dentro. Nunca al reves, y nunca las dos
 * cosas.
 *
 * Puro y determinista: sin reloj, sin azar propio y sin I/O. El azar entra como
 * semilla y sale siempre igual para la misma semilla.
 */

import { fairFloat, fairInt } from "../fairness.js";
import {
  type Especie,
  type EspecieId,
  especiesDeFamilia,
  especiesPorRareza,
  type Rareza,
} from "./especies.js";
import type { FamiliaId } from "./familias.js";
import { RASGOS_EN_ORDEN, type RasgoId, sonCompatibles } from "./rasgos.js";

/**
 * Los dos huevos que se compran.
 *
 * Hay mas vias de conseguir un bicho —cria, expedicion, cofre, mercado, hito—
 * pero las demas o no pasan por aqui o llegan con la especie ya decidida.
 */
export type TipoDeHuevo = "basico" | "familia";

/**
 * La tabla del huevo de familia.
 *
 * Suma 1. Se lee como "de cada cien, sesenta comunes". El basico no tiene tabla
 * porque solo saca comunes: una loteria de seis es aceptable y garantiza que el
 * primer bicho de alguien sirve para algo. Meter las veinticinco en el huevo de
 * entrada convertiria el debut de todo el mundo en una decepcion estadistica.
 */
export const TABLA_DE_FAMILIA: readonly (readonly [Rareza, number])[] = [
  ["comun", 0.6],
  ["pocoComun", 0.32],
  ["raro", 0.08],
];

/** Cuantos huevos de familia seguidos sin rara garantizan la siguiente. */
export const HUEVOS_SIN_RARA_PARA_GARANTIA = 5;

export interface PeticionDeEclosion {
  readonly tipo: TipoDeHuevo;
  /** Obligatoria en el huevo de familia; se ignora en el basico. */
  readonly familia?: FamiliaId;
  /** La semilla secreta, ya revelada. */
  readonly serverSeed: string;
  /** La semilla que eligio quien juega. */
  readonly clientSeed: string;
  /** Sube en cada huevo de la misma persona. */
  readonly nonce: number;
  /**
   * Huevos de familia seguidos sin sacar una rara. Al llegar al tope, la
   * siguiente rara esta garantizada — y el contador es publico, que es la
   * unica forma de contestar a "este bot me odia" con algo mejor que "confia".
   */
  readonly huevosSinRara?: number;
}

export interface Eclosion {
  readonly especie: EspecieId;
  readonly rasgos: readonly RasgoId[];
  /** Si ha salido por la garantia y no por la tirada. Se dice al abrirlo. */
  readonly porGarantia: boolean;
}

/**
 * Cursores distintos para que las decisiones no se correlacionen entre si.
 *
 * `fairFloat` acepta cursor; `fairInt` no —su firma termina en (min, max)— asi
 * que las decisiones enteras se separan variando el `clientSeed` con un sufijo.
 * Es el mismo efecto: entradas distintas al HMAC, flujos independientes.
 */
const CURSOR_RAREZA = 0;
const CURSOR_CUANTOS_RASGOS = 2;

/** La rareza que toca segun la tirada, leyendo la tabla de arriba. */
const rarezaSegunTirada = (tirada: number): Rareza => {
  let acumulado = 0;
  for (const [rareza, peso] of TABLA_DE_FAMILIA) {
    acumulado += peso;
    if (tirada < acumulado) {
      return rareza;
    }
  }
  // Solo se llega aqui por redondeo del ultimo tramo.
  return "comun";
};

/**
 * Baja de rareza hasta encontrar algo que exista.
 *
 * Hace falta porque el catalogo sale por tandas: hoy solo hay comunes
 * declaradas, asi que una tirada de "raro" no tiene a quien elegir. Sin esto,
 * el huevo devolveria nada el ocho por ciento de las veces. Bajar y no subir es
 * deliberado: un catalogo incompleto nunca debe regalar mas de lo que promete.
 */
const disponiblesEnFamilia = (
  familia: FamiliaId,
  rareza: Rareza,
): readonly Especie[] => {
  const orden: readonly Rareza[] = ["raro", "pocoComun", "comun"];
  const desde = orden.indexOf(rareza);
  const candidatas = desde < 0 ? orden : orden.slice(desde);
  for (const nivel of candidatas) {
    const hay = especiesDeFamilia(familia).filter(
      (especie) => especie.rareza === nivel,
    );
    if (hay.length > 0) {
      return hay;
    }
  }
  return [];
};

/** Elige uno o dos rasgos compatibles entre si. */
const elegirRasgos = (
  serverSeed: string,
  clientSeed: string,
  nonce: number,
): readonly RasgoId[] => {
  const cuantos =
    fairFloat(serverSeed, clientSeed, nonce, CURSOR_CUANTOS_RASGOS) < 0.6
      ? 1
      : 2;

  const primero =
    RASGOS_EN_ORDEN[
      fairInt(
        serverSeed,
        `${clientSeed}:r1`,
        nonce,
        0,
        RASGOS_EN_ORDEN.length - 1,
      )
    ];
  if (!primero) {
    return [];
  }
  if (cuantos === 1) {
    return [primero];
  }

  // El segundo se busca entre los que SI son compatibles, en vez de tirar y
  // repetir hasta acertar. Un bucle de reintentos con semilla fija puede no
  // terminar; esto siempre termina y sigue siendo reproducible.
  const compatibles = RASGOS_EN_ORDEN.filter((id) =>
    sonCompatibles(primero, id),
  );
  if (compatibles.length === 0) {
    return [primero];
  }
  const segundo =
    compatibles[
      fairInt(serverSeed, `${clientSeed}:r2`, nonce, 0, compatibles.length - 1)
    ];
  return segundo ? [primero, segundo] : [primero];
};

/**
 * Abre un huevo.
 *
 * Devuelve `null` solo si no hay ninguna especie que pueda salir, que hoy solo
 * puede pasar con una familia vacia en el catalogo. Es preferible a inventarse
 * una especie: quien llama tiene que decidir si eso es un fallo de datos o un
 * huevo que no deberia haberse vendido.
 */
export const abrirHuevo = (peticion: PeticionDeEclosion): Eclosion | null => {
  const {
    tipo,
    familia,
    serverSeed,
    clientSeed,
    nonce,
    huevosSinRara = 0,
  } = peticion;

  const rasgos = elegirRasgos(serverSeed, clientSeed, nonce);

  if (tipo === "basico") {
    const comunes = especiesPorRareza("comun");
    const elegida =
      comunes[
        fairInt(serverSeed, `${clientSeed}:e`, nonce, 0, comunes.length - 1)
      ];
    return elegida ? { especie: elegida.id, rasgos, porGarantia: false } : null;
  }

  if (!familia) {
    return null;
  }

  const garantizada = huevosSinRara >= HUEVOS_SIN_RARA_PARA_GARANTIA;
  const rareza = garantizada
    ? "raro"
    : rarezaSegunTirada(
        fairFloat(serverSeed, clientSeed, nonce, CURSOR_RAREZA),
      );

  const candidatas = disponiblesEnFamilia(familia, rareza);
  if (candidatas.length === 0) {
    return null;
  }
  const elegida =
    candidatas[
      fairInt(serverSeed, `${clientSeed}:e`, nonce, 0, candidatas.length - 1)
    ];
  if (!elegida) {
    return null;
  }

  return {
    especie: elegida.id,
    rasgos,
    // Solo cuenta como garantia si de verdad ha salido una rara: con el
    // catalogo incompleto, la garantia puede caer a una comun, y decir que fue
    // "por garantia" seria mentir sobre un premio que no ha llegado.
    porGarantia: garantizada && elegida.rareza === "raro",
  };
};

/**
 * El contador de mala racha despues de abrir.
 *
 * Sube con cada huevo de familia que no saca rara y se pone a cero cuando sale.
 * Los basicos no cuentan: no prometen raras, asi que no pueden deberlas.
 */
export const siguienteRachaSinRara = (
  actual: number,
  tipo: TipoDeHuevo,
  salioRara: boolean,
): number => {
  if (tipo !== "familia") {
    return Math.max(0, actual);
  }
  return salioRara ? 0 : Math.max(0, actual) + 1;
};
