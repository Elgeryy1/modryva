/**
 * Detector de monopolio de conversacion para grupos. Logica pura: recibe
 * conteos planos de mensajes por hablante y responde si un usuario acapara la
 * charla, ademas de una medida de desigualdad (Gini). Sin I/O, sin red, sin
 * reloj: mismo input, mismo output. Seguro ante totales de cero.
 */

/** Conteo de mensajes de un hablante en la ventana observada. */
export interface SpeakerStat {
  readonly userId: string;
  readonly messages: number;
}

/**
 * Resultado de la deteccion de monopolio. `userId` solo aparece cuando
 * `monopolized` es true (el hablante que acapara). `share` es la fraccion
 * 0..1 del hablante dominante sobre el total de mensajes.
 */
export interface MonopolyResult {
  readonly monopolized: boolean;
  readonly userId?: string;
  readonly share: number;
}

/** Normaliza un conteo a un entero no negativo finito. */
const safeCount = (messages: number): number => {
  if (!Number.isFinite(messages) || messages <= 0) {
    return 0;
  }
  return messages;
};

/**
 * Detecta si un unico hablante acapara la conversacion: acapara cuando su
 * fraccion del total de mensajes es mayor o igual a `dominanceRatio`. Los
 * conteos no positivos o no finitos se ignoran. En empate de mensajes gana el
 * primer hablante en orden de entrada (determinista). Con total de cero (o sin
 * hablantes) devuelve `{ monopolized: false, share: 0 }`. Puro y determinista.
 */
export const detectMonopoly = (
  stats: readonly SpeakerStat[],
  dominanceRatio: number,
): MonopolyResult => {
  let total = 0;
  let topUserId: string | undefined;
  let topCount = 0;

  for (const stat of stats) {
    const count = safeCount(stat.messages);
    if (count <= 0) {
      continue;
    }
    total += count;
    if (count > topCount) {
      topCount = count;
      topUserId = stat.userId;
    }
  }

  if (total <= 0 || topUserId === undefined) {
    return { monopolized: false, share: 0 };
  }

  const share = topCount / total;
  const threshold = Number.isFinite(dominanceRatio) ? dominanceRatio : 1;
  const monopolized = share >= threshold;

  return {
    monopolized,
    share,
    ...(monopolized ? { userId: topUserId } : {}),
  };
};

/**
 * Coeficiente de Gini (0..1) de la desigualdad de participacion entre
 * hablantes: 0 = todos hablan por igual, cerca de 1 = uno concentra casi todo.
 * Los conteos no positivos o no finitos se ignoran. Con menos de dos hablantes
 * con actividad, o total de cero, devuelve 0. El resultado se acota a [0, 1].
 * Puro y determinista.
 */
export const participationGini = (stats: readonly SpeakerStat[]): number => {
  const counts: number[] = [];
  let total = 0;

  for (const stat of stats) {
    const count = safeCount(stat.messages);
    if (count <= 0) {
      continue;
    }
    counts.push(count);
    total += count;
  }

  const n = counts.length;
  if (n < 2 || total <= 0) {
    return 0;
  }

  let absoluteDiffs = 0;
  for (let i = 0; i < n; i += 1) {
    const a = counts[i] ?? 0;
    for (let j = 0; j < n; j += 1) {
      const b = counts[j] ?? 0;
      absoluteDiffs += Math.abs(a - b);
    }
  }

  const gini = absoluteDiffs / (2 * n * total);
  if (gini <= 0) {
    return 0;
  }
  if (gini >= 1) {
    return 1;
  }
  return gini;
};
