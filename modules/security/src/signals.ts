/**
 * MOTOR de senales + scoring: el nucleo generico que colapsa los ~130
 * detectores del superbot en un solo camino de decision. Cada detector (spam,
 * flood, impersonacion, char-filters, links, etc.) produce sus propios
 * `ModerationSignal[]` sin saber nada del resto; este modulo suma los pesos de
 * las senales presentes y mapea el total a una accion segun umbrales.
 *
 * Logica pura y determinista: sin I/O, sin red, sin Prisma, sin Date.now() ni
 * Math.random(). Todo entra por parametro y sale como valor.
 */

/**
 * Una senal de moderacion emitida por un detector. `key` la identifica de forma
 * estable (p.ej. "spam.url", "flood.repeat"); `weight` es su contribucion al
 * score; `present` indica si el detector la disparo en este mensaje; `detail`
 * es una explicacion humana opcional para logs/avisos.
 */
export interface ModerationSignal {
  readonly key: string;
  readonly weight: number;
  readonly present: boolean;
  readonly detail?: string;
}

/** Accion resultante tras evaluar las senales, de menor a mayor severidad. */
export type SignalAction = "ignore" | "log" | "warn" | "mute" | "ban";

/**
 * Umbrales de score (inclusivos) para cada accion escalada. Un score >= `ban`
 * mapea a "ban", >= `mute` a "mute", >= `warn` a "warn". Por debajo de `warn`
 * pero con al menos una senal presente se mapea a "log"; sin senales presentes
 * (score 0) a "ignore".
 */
export const SIGNAL_ACTION_THRESHOLDS: {
  readonly warn: number;
  readonly mute: number;
  readonly ban: number;
} = {
  warn: 1,
  mute: 3,
  ban: 5,
};

/** Resultado del scoring: total, accion mapeada y claves disparadas. */
export interface SignalScoreResult {
  readonly score: number;
  readonly action: SignalAction;
  readonly triggered: readonly string[];
}

/**
 * Mapea un score numerico a una accion usando `SIGNAL_ACTION_THRESHOLDS`.
 * `hasPresent` distingue "ignore" (nada disparado) de "log" (algo disparo pero
 * por debajo del umbral de warn, p.ej. senales de peso 0). Determinista.
 */
export const mapScoreToSignalAction = (
  score: number,
  hasPresent: boolean,
): SignalAction => {
  if (score >= SIGNAL_ACTION_THRESHOLDS.ban) {
    return "ban";
  }
  if (score >= SIGNAL_ACTION_THRESHOLDS.mute) {
    return "mute";
  }
  if (score >= SIGNAL_ACTION_THRESHOLDS.warn) {
    return "warn";
  }
  return hasPresent ? "log" : "ignore";
};

/**
 * Nucleo del engine: suma los `weight` de las senales presentes, recolecta sus
 * `key` en orden de aparicion (sin duplicados) y mapea el total a una accion.
 * Las senales ausentes no aportan score ni aparecen en `triggered`. Los pesos
 * negativos restan (permite senales atenuantes, p.ej. usuario de confianza).
 * Pesos NaN se ignoran para no envenenar el total. Puro y determinista.
 */
export const scoreSignals = (
  signals: readonly ModerationSignal[],
): SignalScoreResult => {
  let score = 0;
  const triggered: string[] = [];
  const seen = new Set<string>();

  for (const signal of signals) {
    if (!signal.present) {
      continue;
    }
    if (Number.isFinite(signal.weight)) {
      score += signal.weight;
    }
    if (!seen.has(signal.key)) {
      seen.add(signal.key);
      triggered.push(signal.key);
    }
  }

  return {
    score,
    action: mapScoreToSignalAction(score, triggered.length > 0),
    triggered,
  };
};

/**
 * Combina varios conjuntos de senales (uno por detector) en una sola lista
 * plana, preservando el orden de los conjuntos y, dentro de cada uno, el orden
 * original. Cuando dos senales comparten `key`, gana la ultima que la declara
 * como `present` (un detector posterior puede confirmar lo que otro dejo en
 * duda); si ninguna la marca presente, se conserva la primera aparicion. El
 * resultado no contiene claves duplicadas. Puro y determinista.
 */
export const combineSignalSets = (
  ...sets: readonly (readonly ModerationSignal[])[]
): ModerationSignal[] => {
  const order: string[] = [];
  const byKey = new Map<string, ModerationSignal>();

  for (const set of sets) {
    for (const signal of set) {
      const existing = byKey.get(signal.key);
      if (existing === undefined) {
        order.push(signal.key);
        byKey.set(signal.key, signal);
        continue;
      }
      // Preferimos una senal presente sobre una ausente ya registrada.
      if (signal.present && !existing.present) {
        byKey.set(signal.key, signal);
      }
    }
  }

  return order.map((key) => byKey.get(key) as ModerationSignal);
};
