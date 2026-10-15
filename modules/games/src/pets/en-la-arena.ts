/**
 * Las mascotas dentro del duelo de dados.
 *
 * Es el efecto del gato negro (`penalizaRetador`): quien le rete empieza con
 * desventaja.
 *
 * **La desventaja son los empates, y no es una eleccion estetica: es la unica
 * que cabe.** Las tiradas del duelo las hace Telegram —son dados de verdad,
 * con su animacion, y el bot solo lee el valor— asi que no se puede restar
 * nada a la tirada del rival sin falsear un dado que la gente ha visto rodar.
 * Las dos alternativas reales eran recortarle el pago al ganador (que castiga
 * despues, no "al empezar") o quedarse con los empates.
 *
 * Con dados de seis caras el empate cae el 16,7% de las veces, asi que llevar
 * gato negro pasa de ganar el 41,7% de los duelos a ganar el 58,3%. El efecto
 * declarado es 0.2 y esto vale 0.167: se queda **por debajo** a proposito,
 * porque pasarse en una especie rara del casino se paga en fichas de todo el
 * mundo.
 *
 * Puro y determinista: sin reloj, sin azar y sin I/O.
 */

import type { DuelWinner } from "../dice-duel.js";
import { ventajasDe } from "./ventajas.js";

/** Si esa especie se queda con los empates del duelo. */
export const ganaLosEmpates = (especie: string | null | undefined): boolean =>
  ventajasDe(especie).juegos.castigoAlRetador > 0;

/**
 * El ganador del duelo una vez metidas las mascotas de los dos.
 *
 * Solo puede cambiar un EMPATE, nunca un resultado decidido: si los dados ya
 * dijeron quien gana, ninguna mascota lo toca. Eso es lo que mantiene el duelo
 * legible —quien saco el numero mas alto gana, siempre— y deja la ventaja
 * acotada al 16,7% de las partidas.
 *
 * Con gato negro en los DOS lados el empate se queda empate: la ventaja se
 * anula sola, que es la unica respuesta que no premia a uno de los dos por
 * orden de llegada.
 */
export const ganadorConMascotas = (input: {
  readonly winner: DuelWinner;
  /** Especie del bicho de quien abrio el duelo, si tiene. */
  readonly deQuienReta?: string | null;
  /** Especie del bicho de quien lo acepto, si tiene. */
  readonly deQuienAcepta?: string | null;
}): DuelWinner => {
  if (input.winner !== 0) {
    return input.winner;
  }
  const reta = ganaLosEmpates(input.deQuienReta);
  const acepta = ganaLosEmpates(input.deQuienAcepta);
  if (reta === acepta) {
    return 0;
  }
  return reta ? 1 : 2;
};
