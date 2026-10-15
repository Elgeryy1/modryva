/**
 * Dar de comer: la decision, sin tocar la cartera ni la base de datos.
 *
 * Este fichero contesta a "¿puede comer, cuanto cuesta y como queda?". Cobrar y
 * guardar es de quien tiene el repositorio, y tiene que hacer las dos cosas
 * **en la misma transaccion**: cobrar sin alimentar roba, y alimentar sin
 * cobrar imprime. Que aqui salgan juntas en un solo resultado es lo que hace
 * dificil separarlas por accidente.
 *
 * El tope diario existe por dos razones distintas. La de diseño: sin el, quien
 * tiene saldo mantiene la barra clavada en 100 y el cuidado deja de ser una
 * rutina para ser una compra. La de economia: es lo que acota cuanto puede
 * quemar una persona al dia, y por tanto lo que hace predecible el sumidero.
 *
 * Puro y determinista: sin reloj, sin azar y sin I/O.
 */

import type { EstadoDeMascota } from "./estado.js";
import { MAXIMO } from "./estado.js";
import { combinarRasgos, type RasgoId } from "./rasgos.js";

/** Lo que sube el hambre una racion. */
export const HAMBRE_POR_RACION = 25;

/** Cuantas raciones caben en un dia. */
export const RACIONES_POR_DIA = 4;

/**
 * Lo que cuesta una racion, antes del apetito del bicho.
 *
 * Tres raciones al dia son 450 monedas, que es el mantenimiento de referencia
 * del plan. El valor real lo pone cada grupo en sus ajustes: este es el que se
 * usa cuando nadie lo ha tocado.
 */
export const PRECIO_BASE_RACION = 150;

/** Por que no ha podido comer. */
export type MotivoDeNegativa = "sinSaldo" | "topeDiario" | "yaLlena";

export type ResultadoDeAlimentar =
  | {
      readonly ok: true;
      /** Lo que hay que cobrar. Nunca negativo. */
      readonly coste: number;
      readonly estado: EstadoDeMascota;
      /** Raciones que le quedan hoy despues de esta. */
      readonly racionesRestantes: number;
    }
  | {
      readonly ok: false;
      readonly motivo: MotivoDeNegativa;
      /** Lo que habria costado. Sirve para decir cuanto le falta. */
      readonly coste: number;
      readonly racionesRestantes: number;
    };

export interface PeticionDeRacion {
  readonly estado: EstadoDeMascota;
  /** Saldo de quien paga, ahora mismo. */
  readonly saldo: number;
  /** Raciones ya servidas hoy. */
  readonly racionesHoy: number;
  readonly rasgos?: readonly RasgoId[];
  /** Precio del grupo. Si no viene, el de referencia. */
  readonly precioRacion?: number;
  /** Tope del grupo. Si no viene, el de referencia. */
  readonly racionesPorDia?: number;
}

/**
 * Lo que cuesta una racion para ESTE bicho.
 *
 * El apetito de los rasgos se aplica al precio y no a lo que llena la racion.
 * Es la lectura intuitiva —"come mas" es "gasta mas en comida"— y ademas evita
 * un efecto raro: si el gloton se llenara menos por racion, tocaria antes el
 * tope diario y el rasgo pasaria a ser un castigo encubierto.
 */
export const precioDeRacion = (
  precioBase: number = PRECIO_BASE_RACION,
  rasgos: readonly RasgoId[] = [],
): number => {
  const base = Number.isFinite(precioBase) && precioBase > 0 ? precioBase : 0;
  return Math.ceil(base * combinarRasgos(rasgos).apetito);
};

/**
 * Decide una racion.
 *
 * El orden de las negativas importa y es el orden en que le importan a quien
 * juega: primero si tiene sentido comer, luego si le dejan, y por ultimo si le
 * llega el dinero. Decirle "no te llega" a alguien cuya mascota ya esta llena
 * seria mandarle a ganar monedas que no necesita.
 */
export const alimentar = (peticion: PeticionDeRacion): ResultadoDeAlimentar => {
  const {
    estado,
    saldo,
    racionesHoy,
    rasgos = [],
    precioRacion = PRECIO_BASE_RACION,
    racionesPorDia = RACIONES_POR_DIA,
  } = peticion;

  const coste = precioDeRacion(precioRacion, rasgos);
  const servidas = Math.max(0, Math.trunc(racionesHoy));
  const tope = Math.max(0, Math.trunc(racionesPorDia));
  const restantes = Math.max(0, tope - servidas);

  if (estado.hambre >= MAXIMO) {
    return {
      ok: false,
      motivo: "yaLlena",
      coste,
      racionesRestantes: restantes,
    };
  }
  if (restantes <= 0) {
    return {
      ok: false,
      motivo: "topeDiario",
      coste,
      racionesRestantes: 0,
    };
  }
  if (saldo < coste) {
    return {
      ok: false,
      motivo: "sinSaldo",
      coste,
      racionesRestantes: restantes,
    };
  }

  return {
    ok: true,
    coste,
    estado: {
      ...estado,
      hambre: Math.min(MAXIMO, estado.hambre + HAMBRE_POR_RACION),
    },
    racionesRestantes: restantes - 1,
  };
};
