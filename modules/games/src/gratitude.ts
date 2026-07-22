/**
 * Moneda de gratitud: puntos que un usuario SOLO gana cuando otros le
 * agradecen. Nunca representa dinero real ni se convierte a ninguna divisa;
 * es un contador social puro. Todo aqui es logica pura y determinista: sin
 * I/O, sin red, sin Date.now()/Math.random(). Los llamadores aportan los
 * datos planos y reciben valores nuevos (nada se muta).
 */

/**
 * Puntos de gratitud concedidos por cada "gracias" reconocido. Es la unidad
 * base con la que los llamadores calculan cuanto sumar en {@link grantGratitude}.
 */
export const GRATITUDE_PER_THANKS = 5;

/** Una entrada del ranking de gratitud: usuario y sus puntos acumulados. */
export interface GratitudeEntry {
  readonly userId: string;
  readonly points: number;
}

/**
 * Suma `amount` a los puntos `current` y devuelve el nuevo saldo, nunca
 * negativo. Un `amount` negativo puede reducir el saldo, pero el resultado se
 * recorta a 0 como minimo (la gratitud no baja de cero). Entradas no finitas
 * (NaN/Infinity) se tratan como 0 para mantener el saldo determinista.
 * Pura: no muta nada y siempre devuelve un numero >= 0.
 */
export const grantGratitude = (current: number, amount: number): number => {
  const safeCurrent = Number.isFinite(current) ? current : 0;
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  const total = safeCurrent + safeAmount;
  return total > 0 ? total : 0;
};

/**
 * Ordena las entradas por puntos de mayor a menor (desc) de forma estable: si
 * dos usuarios empatan en puntos, conservan su orden relativo de entrada.
 * Devuelve un array nuevo; no muta el argumento. Pura y determinista.
 */
export const rankGratitude = (
  entries: readonly GratitudeEntry[],
): readonly GratitudeEntry[] => {
  return entries
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => {
      if (b.entry.points !== a.entry.points) {
        return b.entry.points - a.entry.points;
      }
      return a.index - b.index;
    })
    .map((item) => item.entry);
};
