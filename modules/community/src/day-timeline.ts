/**
 * Timeline horizontal del dia: agrupa eventos por franja horaria local. Puro y
 * determinista, sin I/O ni relojes: recibe los eventos como datos planos y el
 * desfase horario en minutos, de modo que dos llamadas con las mismas entradas
 * devuelven exactamente el mismo resultado.
 */

const MS_PER_HOUR = 3_600_000;
const MS_PER_MINUTE = 60_000;
const HOURS_PER_DAY = 24;

/** Un evento situado en el tiempo (epoch ms UTC) con una categoria libre. */
export interface TimelineEvent {
  readonly ms: number;
  readonly kind: string;
}

/** Una de las 24 franjas horarias del dia, con conteo total y por kind. */
export interface TimelineBucket {
  readonly hour: number;
  readonly count: number;
  readonly kinds: Readonly<Record<string, number>>;
}

/**
 * Devuelve la hora local del dia (0..23) para un instante `ms` (epoch UTC)
 * aplicando el desfase `tzOffsetMin`. El modulo se normaliza a positivo para
 * que las horas antes de epoch o los desfases negativos no den negativos.
 */
const localHour = (ms: number, tzOffsetMin: number): number => {
  const localMs = ms + tzOffsetMin * MS_PER_MINUTE;
  const rawHour = Math.floor(localMs / MS_PER_HOUR);
  return ((rawHour % HOURS_PER_DAY) + HOURS_PER_DAY) % HOURS_PER_DAY;
};

/**
 * Agrupa `events` en 24 franjas horarias (hora local 0..23, en orden
 * ascendente). Cada franja incluye el total `count` y el desglose `kinds`
 * (solo los kinds presentes en esa franja). Eventos con `ms` no finito se
 * ignoran. Seguro ante entrada vacia: siempre devuelve 24 franjas, con count 0
 * y `kinds` vacio donde no hubo eventos. Puro y determinista.
 */
export const bucketDayTimeline = (
  events: readonly TimelineEvent[],
  tzOffsetMin: number,
): readonly TimelineBucket[] => {
  const counts: number[] = new Array<number>(HOURS_PER_DAY).fill(0);
  const kindMaps: Array<Map<string, number>> = Array.from(
    { length: HOURS_PER_DAY },
    () => new Map<string, number>(),
  );

  for (const event of events) {
    if (!Number.isFinite(event.ms)) {
      continue;
    }
    const hour = localHour(event.ms, tzOffsetMin);
    counts[hour] = (counts[hour] ?? 0) + 1;
    const kindMap = kindMaps[hour];
    if (kindMap !== undefined) {
      kindMap.set(event.kind, (kindMap.get(event.kind) ?? 0) + 1);
    }
  }

  const buckets: TimelineBucket[] = [];
  for (let hour = 0; hour < HOURS_PER_DAY; hour += 1) {
    const kindMap = kindMaps[hour] ?? new Map<string, number>();
    const kinds: Record<string, number> = {};
    for (const [kind, n] of kindMap) {
      kinds[kind] = n;
    }
    buckets.push({ hour, count: counts[hour] ?? 0, kinds });
  }

  return buckets;
};

/**
 * Devuelve la hora local (0..23) con mas eventos. Ante empate gana la hora mas
 * temprana. Si no hay ningun evento devuelve null. Puro y determinista.
 */
export const peakTimelineHour = (
  buckets: readonly TimelineBucket[],
): number | null => {
  let best: TimelineBucket | null = null;
  for (const bucket of buckets) {
    if (bucket.count > 0 && (best === null || bucket.count > best.count)) {
      best = bucket;
    }
  }
  return best === null ? null : best.hour;
};
