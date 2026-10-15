/**
 * Los ajustes de mascotas por grupo.
 *
 * Van en `chat_settings` bajo `PETS_SETTINGS_KEY`, igual que la tienda. Lo que
 * decide que vive aqui y no como constante es una pregunta: **¿va a haber que
 * cambiarlo mirando el libro mayor?** Los precios y los topes, si — son las
 * palancas con las que se corrige la economia cuando los numeros reales
 * contradigan a los de partida, y tener que desplegar para tocarlos significaria
 * no tocarlos.
 *
 * Sale **apagado**, como el resto del repo. Un despliegue nuevo no debe cambiar
 * el comportamiento de ningun grupo hasta que alguien lo pida.
 *
 * Puro y determinista: sin reloj, sin azar y sin I/O.
 */

import { PRECIO_BASE_RACION, RACIONES_POR_DIA } from "./alimentar.js";
import { TOPE_DIARIO } from "./rendimiento.js";

export const PETS_SETTINGS_KEY = "group_pets";

/** Lo que cuesta un huevo basico. */
export const PRECIO_BASE_HUEVO = 3000;

/** Lo que cuesta un huevo de familia: se paga elegir la direccion. */
export const PRECIO_BASE_HUEVO_FAMILIA = 6000;

/**
 * Tope de lo que puede acuñar el grupo entero en un dia.
 *
 * Es el segundo cinturon, encima del tope por mascota. Existe porque los dos
 * fallan de forma distinta: el de mascota protege de un bicho roto, y este de
 * un grupo con mas mascotas de las previstas. Cien mascotas al tope individual
 * son sesenta mil monedas al dia, que es de otro orden que las seiscientas de
 * una.
 */
export const TOPE_DIARIO_DE_GRUPO = 30_000;

/**
 * Con cuanto se queda quien paga una operacion.
 *
 * La factura de una enfermedad grave no es una cantidad: es un **suelo**. Se
 * cobra hasta dejar la cartera aqui, y por eso el numero no dice "cuanto cuesta"
 * sino "con cuanto te quedas".
 *
 * Dos mil quinientas monedas no son cero a proposito. Dan para unas dieciseis
 * raciones, que es comida de bicho para mas de una semana: quien acaba de pagar
 * una fortuna por salvarlo no puede quedarse sin poder darle de comer al dia
 * siguiente, porque entonces el bicho salvado se duerme de hambre y la
 * operacion no ha servido de nada.
 */
export const RESTO_TRAS_OPERAR = 2_500;

/**
 * Cuantas horas hay para reunir el dinero.
 *
 * Menos de veinticuatro es una encerrona: si le pilla durmiendo, no hay plazo.
 * Mas de una semana y deja de haber tension. Tres dias es lo que tarda alguien
 * en enterarse aunque se pierda el primer dia, y va en la misma escala que el
 * resto de la feature — con la barra llena, una mascota aguanta cincuenta horas
 * sin comer.
 */
export const HORAS_DE_PLAZO = 72;

/**
 * Cuanto tarda en poder tener otra despues de perder una.
 *
 * Es lo que hace que la muerte cueste algo. Sin duelo, quien pierde el bicho se
 * compra un huevo en diez segundos y no ha perdido nada: ha reiniciado.
 *
 * Corto a proposito. Lo que de verdad se pierde es **ese** bicho, con su nivel,
 * su nombre y sus rasgos —y si era de las que no salen de ningun huevo, para
 * siempre—, y alargar la espera no aumenta esa perdida: solo aleja a alguien
 * del grupo justo cuando acaba de llevarse un disgusto.
 */
export const HORAS_DE_DUELO = 48;

export interface AjustesDeMascotas {
  /** Apagado hasta que un admin lo enciende. */
  readonly activo: boolean;
  readonly precioRacion: number;
  readonly racionesPorDia: number;
  readonly precioHuevo: number;
  readonly precioHuevoFamilia: number;
  readonly topeDiarioPorMascota: number;
  readonly topeDiarioDeGrupo: number;
  /**
   * Si se regala el primer huevo.
   *
   * Encendido por defecto y es deliberado: tres mil monedas es una barrera alta
   * para quien acaba de enterarse de que esto existe, y sin el regalo la feature
   * solo la ve quien ya tenia saldo — justo a quien menos falta le hace una
   * razon para volver.
   */
  readonly primerHuevoGratis: boolean;
  /**
   * Si el bot avisa por privado cuando el bicho tiene hambre.
   *
   * **Apagado por defecto, y ademas cada persona tiene que pedirlo.** Un aviso
   * que sale para trescientas mascotas hambrientas a la misma hora es la misma
   * forma de incidente que los cuatro `@all` sin cooldown del 21 de agosto.
   */
  readonly avisos: boolean;
  /**
   * Con cuanto se queda quien paga una operacion de urgencia.
   *
   * Va en los ajustes y no como constante por lo mismo que los precios: es una
   * palanca que hay que poder mover mirando el libro mayor, y ademas el numero
   * que tenga sentido en un grupo con saldos de millones no es el mismo que en
   * uno donde nadie pasa de mil.
   */
  readonly restoTrasOperar: number;
  /** Horas para reunir el dinero antes de que la mascota fallezca. */
  readonly horasDePlazo: number;
  /** Horas sin poder tener otra despues de perder una. */
  readonly horasDeDuelo: number;
}

export const AJUSTES_POR_DEFECTO: AjustesDeMascotas = {
  activo: false,
  precioRacion: PRECIO_BASE_RACION,
  racionesPorDia: RACIONES_POR_DIA,
  precioHuevo: PRECIO_BASE_HUEVO,
  precioHuevoFamilia: PRECIO_BASE_HUEVO_FAMILIA,
  topeDiarioPorMascota: TOPE_DIARIO,
  topeDiarioDeGrupo: TOPE_DIARIO_DE_GRUPO,
  primerHuevoGratis: true,
  avisos: false,
  restoTrasOperar: RESTO_TRAS_OPERAR,
  horasDePlazo: HORAS_DE_PLAZO,
  horasDeDuelo: HORAS_DE_DUELO,
};

/**
 * Un entero positivo, o el de partida.
 *
 * El cero se descarta en vez de aceptarse, por el mismo motivo que en la
 * tienda: en un campo numerico editado a mano, el 0 casi siempre es "no he
 * puesto nada". Aceptarlo aqui significaria comida gratis o rendimiento cero
 * segun el campo, y las dos cosas son sorpresas caras.
 */
const enteroPositivo = (valor: unknown, porDefecto: number): number =>
  typeof valor === "number" && Number.isInteger(valor) && valor > 0
    ? valor
    : porDefecto;

/**
 * Un entero de cero para arriba, o el de partida.
 *
 * Existe para `restoTrasOperar` y solo para el. En todos los demas campos el 0
 * es casi siempre "no he puesto nada" y por eso `enteroPositivo` lo descarta,
 * pero aqui no es un precio: es con cuanto se queda alguien. El cero significa
 * "que no le quede nada", que es una decision perfectamente posible de tomar y
 * que ningun otro valor sabe expresar.
 */
const enteroNoNegativo = (valor: unknown, porDefecto: number): number =>
  typeof valor === "number" && Number.isInteger(valor) && valor >= 0
    ? valor
    : porDefecto;

const booleano = (valor: unknown, porDefecto: boolean): boolean =>
  typeof valor === "boolean" ? valor : porDefecto;

/**
 * Lee los ajustes guardados.
 *
 * Todo lo que no se entienda cae al valor de partida en vez de rechazar la fila
 * entera: unos ajustes a medio escribir por una version anterior no pueden
 * dejar al grupo sin mascotas.
 */
export const parsearAjustes = (guardado: unknown): AjustesDeMascotas => {
  if (!guardado || typeof guardado !== "object") {
    return AJUSTES_POR_DEFECTO;
  }
  const bruto = guardado as Record<string, unknown>;
  return {
    activo: booleano(bruto.activo, AJUSTES_POR_DEFECTO.activo),
    precioRacion: enteroPositivo(
      bruto.precioRacion,
      AJUSTES_POR_DEFECTO.precioRacion,
    ),
    racionesPorDia: enteroPositivo(
      bruto.racionesPorDia,
      AJUSTES_POR_DEFECTO.racionesPorDia,
    ),
    precioHuevo: enteroPositivo(
      bruto.precioHuevo,
      AJUSTES_POR_DEFECTO.precioHuevo,
    ),
    precioHuevoFamilia: enteroPositivo(
      bruto.precioHuevoFamilia,
      AJUSTES_POR_DEFECTO.precioHuevoFamilia,
    ),
    topeDiarioPorMascota: enteroPositivo(
      bruto.topeDiarioPorMascota,
      AJUSTES_POR_DEFECTO.topeDiarioPorMascota,
    ),
    topeDiarioDeGrupo: enteroPositivo(
      bruto.topeDiarioDeGrupo,
      AJUSTES_POR_DEFECTO.topeDiarioDeGrupo,
    ),
    primerHuevoGratis: booleano(
      bruto.primerHuevoGratis,
      AJUSTES_POR_DEFECTO.primerHuevoGratis,
    ),
    avisos: booleano(bruto.avisos, AJUSTES_POR_DEFECTO.avisos),
    restoTrasOperar: enteroNoNegativo(
      bruto.restoTrasOperar,
      AJUSTES_POR_DEFECTO.restoTrasOperar,
    ),
    horasDePlazo: enteroPositivo(
      bruto.horasDePlazo,
      AJUSTES_POR_DEFECTO.horasDePlazo,
    ),
    horasDeDuelo: enteroPositivo(
      bruto.horasDeDuelo,
      AJUSTES_POR_DEFECTO.horasDeDuelo,
    ),
  };
};
