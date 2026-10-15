/**
 * Los juguetes: subir el animo pagando, pero con el reloj por delante.
 *
 * Jugar gratis da 15 al dia y el dia se lleva 24, asi que el animo **siempre
 * bajaba**. Los juguetes son la diferencia, y existen por eso.
 *
 * ## Por que llevan tope diario
 *
 * Sin tope, el animo dejaria de medir si cuidas al bicho y pasaria a medir
 * cuanto dinero tienes. En Grupo Central hay una cartera con 477 millones: quien
 * la tenga compraria la barra llena todos los dias sin mirar a la mascota ni
 * una vez, y la de al lado —que entra cada tarde a jugar— saldria perdiendo.
 * Eso convierte una mecanica de cuidado en una de saldo.
 *
 * Con tope, el dinero **acelera** pero no sustituye: hay que aparecer igual, y
 * lo que se compra es recuperar antes, no dejar de venir.
 *
 * ## Y por que son un sumidero
 *
 * Las mascotas queman 6.978 monedas y acuñan 5.442; el saldo neto es negativo,
 * que es lo que tiene que ser. Los juguetes lo hacen mas negativo sin acuñar
 * nada: no devuelven monedas, devuelven animo.
 *
 * Puro y determinista: sin reloj, sin azar y sin I/O.
 */

import { MAXIMO } from "./estado.js";

/** Los que hay. El id viaja a la tienda y a la base de datos. */
export type JugueteId = "pelota" | "ovillo" | "cometa";

export interface Juguete {
  readonly id: JugueteId;
  readonly nombre: string;
  readonly icono: string;
  /** Cuanto animo da. `MAXIMO` llena la barra sea cual sea el punto de salida. */
  readonly animo: number;
  readonly precio: number;
}

/**
 * El catalogo.
 *
 * Tres y no uno para que haya una decision: la pelota sale a 20 monedas por
 * punto de animo y el ovillo a 17,5, asi que el caro rinde mejor por moneda
 * pero obliga a soltar mas de golpe. La cometa no compite en eficiencia — se
 * compra cuando el bicho esta por los suelos y hay prisa.
 */
export const JUGUETES: Record<JugueteId, Juguete> = {
  pelota: {
    id: "pelota",
    nombre: "Pelota",
    icono: "🎾",
    animo: 15,
    precio: 300,
  },
  ovillo: {
    id: "ovillo",
    nombre: "Ovillo de lana",
    icono: "🧶",
    animo: 40,
    precio: 700,
  },
  cometa: {
    id: "cometa",
    nombre: "Cometa",
    icono: "🪁",
    animo: MAXIMO,
    precio: 1500,
  },
};

export const JUGUETES_EN_ORDEN: readonly JugueteId[] = [
  "pelota",
  "ovillo",
  "cometa",
];

/** Si un texto cualquiera es un juguete conocido. */
export const esJugueteId = (valor: string): valor is JugueteId =>
  Object.hasOwn(JUGUETES, valor);

/**
 * Cuantos se pueden usar al dia.
 *
 * Tres, y el numero sale de la cuenta: el dia quita 24 de animo y jugar gratis
 * devuelve 15. Con dos pelotas ya se cubre el dia y sobra para recuperar, asi
 * que tres deja margen sin regalar la barra llena por 900 monedas diarias.
 */
export const JUGUETES_POR_DIA = 3;

export type FalloDeJuguete = "topeDiario" | "yaLlena";

export type DecisionDeJuguete =
  | { readonly ok: true; readonly animo: number; readonly subida: number }
  | { readonly ok: false; readonly motivo: FalloDeJuguete };

/**
 * Si el juguete se puede usar, y como queda el animo.
 *
 * `yaLlena` no es un tecnicismo: sin el, alguien con la barra a 100 pagaria
 * 1.500 por una cometa que no hace nada. Cobrar por lo que no cambia nada es
 * exactamente lo que este repo persigue en todas partes.
 */
export const usarJuguete = ({
  juguete,
  animo,
  usadosHoy,
  topeDiario = JUGUETES_POR_DIA,
}: {
  readonly juguete: Juguete;
  readonly animo: number;
  readonly usadosHoy: number;
  readonly topeDiario?: number;
}): DecisionDeJuguete => {
  if (usadosHoy >= Math.max(0, topeDiario)) {
    return { ok: false, motivo: "topeDiario" };
  }
  const desde = Math.max(0, Math.min(MAXIMO, animo));
  if (desde >= MAXIMO) {
    return { ok: false, motivo: "yaLlena" };
  }
  const hasta = Math.min(MAXIMO, desde + juguete.animo);
  return { ok: true, animo: hasta, subida: hasta - desde };
};
