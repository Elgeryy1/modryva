/**
 * Salon de la fama de aportes utiles: puntua a los miembros por el VALOR de sus
 * contribuciones (votos positivos y agradecimientos recibidos), no por la mera
 * cantidad de mensajes. Logica pura y determinista; no hace I/O ni depende del
 * reloj: recibe contadores planos ya agregados por el llamante.
 */

/** Peso de cada voto positivo en el valor total de una contribucion. */
export const HOF_UPVOTE_WEIGHT = 5;

/** Peso de cada agradecimiento en el valor total de una contribucion. */
export const HOF_THANKS_WEIGHT = 3;

/** Peso de cada mensaje en el valor total (deliberadamente el mas bajo). */
export const HOF_MESSAGE_WEIGHT = 1;

/**
 * Contadores agregados de un miembro. `userId` identifica al usuario; el resto
 * son totales no negativos que el llamante ya calculo.
 */
export interface Contribution {
  readonly userId: string;
  readonly upvotes: number;
  readonly thanks: number;
  readonly messages: number;
}

/** Fila del ranking: usuario y su valor calculado. */
export interface HofEntry {
  readonly userId: string;
  readonly value: number;
}

const nonNegative = (n: number): number => (n > 0 ? n : 0);

/**
 * Calcula el valor de una contribucion ponderando votos positivos y
 * agradecimientos por encima de los mensajes:
 * `upvotes*5 + thanks*3 + messages*1`. Los contadores negativos se tratan como
 * cero para que un dato corrupto no reste. Pura y determinista.
 */
export const contributionValue = (c: Contribution): number =>
  nonNegative(c.upvotes) * HOF_UPVOTE_WEIGHT +
  nonNegative(c.thanks) * HOF_THANKS_WEIGHT +
  nonNegative(c.messages) * HOF_MESSAGE_WEIGHT;

/**
 * Devuelve las `topN` contribuciones de mayor valor, en orden descendente por
 * valor y, ante empates, por `userId` ascendente (para un resultado estable).
 * `topN <= 0` devuelve un array vacio; un `topN` mayor que la cantidad de
 * contribuciones devuelve todas. No muta la entrada. Pura y determinista.
 */
export const topContributions = (
  contribs: readonly Contribution[],
  topN: number,
): readonly HofEntry[] => {
  if (topN <= 0) {
    return [];
  }

  const ranked: HofEntry[] = contribs.map((c) => ({
    userId: c.userId,
    value: contributionValue(c),
  }));

  ranked.sort((a, b) =>
    b.value !== a.value ? b.value - a.value : a.userId < b.userId ? -1 : 1,
  );

  return ranked.slice(0, Math.floor(topN));
};
