/**
 * Las seis familias de mascotas: el eje que ordena el catalogo entero.
 *
 * Una familia es una faceta del grupo —el dinero, la astucia, la guarda, el
 * saber, el vinculo, la suerte— y cada especie pertenece a una sola. Sirven
 * para tres cosas a la vez, y por eso existen como concepto y no como un campo
 * suelto en cada especie:
 *
 * 1. **El huevo de familia.** Se compra eligiendo familia, y el azar decide la
 *    especie dentro. Es lo que hace que abrir un huevo tenga decision y sorpresa
 *    en vez de solo sorpresa.
 * 2. **El color del corral.** Veinticinco especies repartidas en seis colores se
 *    leen como un paisaje; sin agrupar son una lista.
 * 3. **La cria.** Dos padres de la misma familia suben la probabilidad de la
 *    rara de esa familia.
 *
 * Puro y determinista: sin reloj, sin azar y sin I/O.
 */

/**
 * Identificador de familia. Union cerrada y no `string`: el id viaja a la base
 * de datos y a la Mini App, y un typo silencioso crearia una familia que se
 * guarda, se pinta y no agrupa nada.
 */
export type FamiliaId = "bolsa" | "sombra" | "muro" | "pluma" | "lazo" | "azar";

/** Una familia del catalogo. */
export interface Familia {
  readonly id: FamiliaId;
  /** Como se llama para quien juega. */
  readonly nombre: string;
  /** El emoji que la representa en el chat, donde no hay colores. */
  readonly glifo: string;
  /** De que va, en tres palabras. Se usa como subtitulo en la Mini App. */
  readonly lema: string;
}

export const FAMILIAS: Record<FamiliaId, Familia> = {
  bolsa: { id: "bolsa", nombre: "Bolsa", glifo: "💰", lema: "el dinero" },
  sombra: { id: "sombra", nombre: "Sombra", glifo: "🌑", lema: "la astucia" },
  muro: { id: "muro", nombre: "Muro", glifo: "🛡️", lema: "la guarda" },
  pluma: { id: "pluma", nombre: "Pluma", glifo: "🪶", lema: "el saber" },
  lazo: { id: "lazo", nombre: "Lazo", glifo: "🤝", lema: "el vinculo" },
  azar: { id: "azar", nombre: "Azar", glifo: "🎲", lema: "la suerte" },
};

/**
 * El orden en que se enseñan.
 *
 * Es una lista aparte y no `Object.keys(FAMILIAS)` a proposito: el orden de las
 * claves de un objeto es una promesa fragil del lenguaje, y este orden se ve en
 * el corral y en la pantalla de compra. Escrito, se puede cambiar sin miedo y
 * se puede probar.
 */
export const FAMILIAS_EN_ORDEN: readonly FamiliaId[] = [
  "bolsa",
  "sombra",
  "muro",
  "pluma",
  "lazo",
  "azar",
];

/** Si un texto cualquiera es un id de familia conocido. */
export const esFamiliaId = (valor: string): valor is FamiliaId =>
  Object.hasOwn(FAMILIAS, valor);
