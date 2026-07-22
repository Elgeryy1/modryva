/**
 * Equilibrar la participacion en el grupo invitando a las voces mas calladas
 * cuando siempre habla la misma gente. Logica pura y determinista: recibe
 * estadisticas planas de mensajes por usuario y no realiza ninguna I/O.
 */

/** Actividad de un usuario: cuantos mensajes ha enviado en la ventana. */
export interface MonopolyUserStat {
  readonly userId: string;
  readonly messages: number;
}

/**
 * Devuelve los `topN` usuarios con MENOS actividad para invitarlos a hablar,
 * en orden ascendente de mensajes (empates resueltos por el orden estable de
 * aparicion en `stats`). Excluye a los usuarios con 0 mensajes salvo que no
 * quede ningun otro candidato con actividad, en cuyo caso se usan los de 0.
 * `topN <= 0` o `stats` vacio devuelve []. Los mensajes negativos se tratan
 * como 0. Pura y determinista.
 */
export const suggestQuietVoices = (
  stats: readonly MonopolyUserStat[],
  topN: number,
): readonly string[] => {
  if (topN <= 0 || stats.length === 0) {
    return [];
  }

  const indexed = stats.map((stat, index) => ({
    userId: stat.userId,
    messages: stat.messages > 0 ? stat.messages : 0,
    index,
  }));

  const active = indexed.filter((entry) => entry.messages > 0);
  const pool = active.length > 0 ? active : indexed;

  const sorted = [...pool].sort((a, b) =>
    a.messages !== b.messages ? a.messages - b.messages : a.index - b.index,
  );

  return sorted.slice(0, topN).map((entry) => entry.userId);
};

/**
 * Mide como de repartida esta la participacion como fraccion (0..1): 0 cuando
 * un solo usuario acapara todos los mensajes (monopolio total) y 1 cuando
 * todos hablan por igual. Se calcula como `min/max` de los recuentos (los
 * negativos cuentan como 0). Sin usuarios, o sin ningun mensaje, devuelve 1
 * (no hay desequilibrio que corregir). Pura y determinista.
 */
export const participationSpread = (
  stats: readonly MonopolyUserStat[],
): number => {
  if (stats.length === 0) {
    return 1;
  }

  let min = Number.POSITIVE_INFINITY;
  let max = 0;
  for (const stat of stats) {
    const count = stat.messages > 0 ? stat.messages : 0;
    if (count < min) {
      min = count;
    }
    if (count > max) {
      max = count;
    }
  }

  if (max === 0) {
    return 1;
  }

  return min / max;
};
