/**
 * Deteccion de oleadas de reacciones negativas dirigidas a una misma persona:
 * cuando el mensaje de un autor acumula muchas reacciones negativas (pulgar
 * abajo, payaso, etc.) en una ventana de tiempo corta, suele ser un ataque
 * coordinado ("dogpiling") mas que una opinion legitima. Logica pura: recibe
 * los eventos ya aplanados, la ventana, el instante actual y la lista de
 * emojis considerados negativos. Sin I/O ni estado.
 */

/** Un evento de reaccion ya aplanado (una reaccion de un usuario a un mensaje). */
export interface ReactionEvent {
  /** Id del autor del mensaje que recibe la reaccion. */
  readonly targetMsgAuthorId: string;
  /** Emoji de la reaccion. */
  readonly emoji: string;
  /** Instante (epoch ms) en que se aplico la reaccion. */
  readonly ms: number;
}

/** Resultado de la deteccion de abuso por reacciones. */
export interface ReactionAbuseResult {
  /** True cuando algun autor supera el umbral de reacciones negativas. */
  readonly abused: boolean;
  /** Autor mas atacado (solo presente cuando `abused` es true). */
  readonly targetId?: string;
  /** Numero de reacciones negativas del autor mas atacado dentro de la ventana. */
  readonly count: number;
}

/**
 * Numero minimo de reacciones negativas hacia un mismo autor, dentro de la
 * ventana, para considerarlo una oleada de abuso.
 */
export const REACTION_ABUSE_THRESHOLD = 5;

/**
 * Cuenta las reacciones negativas por autor dentro de la ventana temporal y
 * marca abuso si el autor mas atacado alcanza `REACTION_ABUSE_THRESHOLD`.
 *
 * Una reaccion cuenta cuando (a) su emoji esta en `negativeEmojis` y (b) su
 * antiguedad `nowMs - ms` cae en el rango `[0, windowMs)`: se descartan las
 * reacciones futuras (ms > nowMs) y las mas viejas o iguales a la ventana. En
 * caso de empate gana el primer autor que alcanzo el conteo maximo segun el
 * orden de `reactions`. Puro y determinista.
 */
export const detectReactionAbuse = (
  reactions: readonly ReactionEvent[],
  windowMs: number,
  nowMs: number,
  negativeEmojis: readonly string[],
): ReactionAbuseResult => {
  const negatives = new Set(negativeEmojis);
  const counts = new Map<string, number>();

  for (const reaction of reactions) {
    if (!negatives.has(reaction.emoji)) {
      continue;
    }
    const age = nowMs - reaction.ms;
    if (age < 0 || age >= windowMs) {
      continue;
    }
    const previous = counts.get(reaction.targetMsgAuthorId) ?? 0;
    counts.set(reaction.targetMsgAuthorId, previous + 1);
  }

  let topId: string | undefined;
  let topCount = 0;
  for (const [authorId, count] of counts) {
    if (count > topCount) {
      topCount = count;
      topId = authorId;
    }
  }

  const abused = topCount >= REACTION_ABUSE_THRESHOLD;

  return {
    abused,
    count: topCount,
    ...(abused && topId !== undefined ? { targetId: topId } : {}),
  };
};
