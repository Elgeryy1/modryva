/**
 * Las mascotas dentro del casino.
 *
 * Es el efecto del pato (`bonusDeCasino`), y como el del zorro llevaba
 * declarado desde el primer dia sin que nadie lo aplicara.
 *
 * **El bono se paga SIEMPRE aparte de la apuesta, nunca dentro.** Multiplicar
 * el resultado del juego habria sido mas corto y habria roto lo unico que no
 * se puede romper en un casino: la apuesta se recomputa desde
 * (serverSeed, clientSeed, nonce), asi que si el pago no coincide con lo que
 * sale de las semillas, "compruebalo tu mismo" deja de significar nada. Por
 * eso esta funcion devuelve un extra suelto y no un multiplicador.
 *
 * Puro y determinista: sin reloj, sin azar y sin I/O.
 */

import { ventajasDe } from "./ventajas.js";

/**
 * Fichas de mas que pone la mascota sobre lo que se acaba de ganar.
 *
 * `gananciaNeta` es el pago menos lo apostado, **no el pago entero**. Sobre el
 * pago, un bono devolveria parte de lo apostado incluso en manos perdedoras, y
 * eso convierte un bono pequeño en una forma de no perder nunca.
 *
 * Devuelve 0 en todo lo que no sea una victoria con un bicho que tenga el
 * efecto —sin mascota, perdiendo, o con una especie cualquiera— para que quien
 * llama no tenga que escribir condicionales.
 */
export const bonoDeCasino = (
  especie: string | null | undefined,
  gananciaNeta: number,
): number => {
  if (!Number.isFinite(gananciaNeta) || gananciaNeta <= 0) {
    return 0;
  }
  const factor = ventajasDe(especie).casino;
  if (!(factor > 1)) {
    return 0;
  }
  // El factor sale de un catalogo escrito en decimal, y en coma flotante
  // `1.15 - 1` es `0.14999999999999991`. Truncando eso directamente, un bono
  // del quince por ciento sobre 1000 paga **149 y no 150**: no es un fallo que
  // rompa nada, es de los que producen un mensaje de "me prometiste un 15% y
  // me has dado menos" imposible de contestar. Redondear el producto a la
  // milesima antes de truncar absorbe el error binario y no cambia ningun caso
  // real, porque ninguna especie declara fracciones tan finas.
  const bruto = Math.round(gananciaNeta * (factor - 1) * 1000) / 1000;
  // Y hacia ABAJO. Las fichas son enteras, y redondear hacia arriba
  // convertiria el bono en una ficha gratis por cada apuesta minima ganada:
  // una impresora pequeña, constante y dificil de ver.
  return Math.floor(bruto);
};
