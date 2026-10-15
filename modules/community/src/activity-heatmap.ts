/**
 * Mapa de calor de actividad por hora local. Toma marcas de tiempo (epoch ms)
 * de mensajes y un desfase de zona horaria en minutos, y las agrega en 24
 * cubetas (una por hora local). Logica pura y determinista: sin I/O, sin
 * Date.now(), sin Math.random(). Segura ante entradas vacias.
 */

/** Numero de horas en un dia; longitud fija del mapa de calor. */
export const HEATMAP_HOURS = 24;

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = HEATMAP_HOURS * HOUR_MS;

/**
 * Reduce un entero a su modulo positivo dentro de [0, mod). Evita los restos
 * negativos que produce el operador `%` de JavaScript para dividendos
 * negativos. Pura y determinista.
 */
const positiveMod = (value: number, mod: number): number =>
  ((value % mod) + mod) % mod;

/**
 * Construye el mapa de calor: un array de 24 posiciones donde la posicion `h`
 * es el numero de mensajes cuya hora local (aplicando `tzOffsetMin`) es `h`.
 * Las marcas no finitas (NaN/Infinity) se ignoran. `tzOffsetMin` positivo
 * adelanta la hora local respecto a UTC (p. ej. +120 = UTC+2). Devuelve un
 * array de ceros ante entrada vacia. Pura y determinista.
 */
export const buildActivityHeatmap = (
  messageTimesMs: readonly number[],
  tzOffsetMin: number,
): readonly number[] => {
  const counts: number[] = new Array<number>(HEATMAP_HOURS).fill(0);
  const offsetMs = Number.isFinite(tzOffsetMin) ? tzOffsetMin * MINUTE_MS : 0;

  for (const t of messageTimesMs) {
    if (!Number.isFinite(t)) {
      continue;
    }
    const localMs = positiveMod(t + offsetMs, DAY_MS);
    const hour = Math.floor(localMs / HOUR_MS);
    const current = counts[hour] ?? 0;
    counts[hour] = current + 1;
  }

  return counts;
};

/**
 * Devuelve la hora (0..23) con mayor conteo en el mapa de calor. Ante empate
 * gana la hora mas temprana. Devuelve 0 para un mapa vacio, todo ceros o de
 * longitud incorrecta. Pura y determinista.
 */
export const peakHour = (heatmap: readonly number[]): number => {
  let bestHour = 0;
  let bestCount = -1;

  for (let h = 0; h < heatmap.length; h += 1) {
    const count = heatmap[h] ?? 0;
    if (count > bestCount) {
      bestCount = count;
      bestHour = h;
    }
  }

  return bestHour;
};

const BAR_GLYPHS = " ▁▂▃▄▅▆▇█";

/**
 * Elige el glifo de barra (de menor a mayor altura) proporcional a `count`
 * respecto a `max`. Un conteo de cero rinde el glifo vacio; cualquier conteo
 * positivo rinde al menos la barra mas baja. Pura y determinista.
 */
const barGlyph = (count: number, max: number): string => {
  if (max <= 0 || count <= 0) {
    return BAR_GLYPHS[0] ?? " ";
  }
  const lastIndex = BAR_GLYPHS.length - 1;
  const scaled = Math.ceil((count / max) * lastIndex);
  const index = scaled < 1 ? 1 : scaled > lastIndex ? lastIndex : scaled;
  return BAR_GLYPHS[index] ?? BAR_GLYPHS[lastIndex] ?? " ";
};

/**
 * Formatea el mapa de calor como una unica linea de 24 barras (una por hora,
 * de 00 a 23) escaladas respecto al maximo. Ante un mapa vacio o todo ceros
 * devuelve 24 glifos vacios. Solo lee las primeras 24 posiciones; si el mapa
 * es mas corto, las horas faltantes cuentan como cero. Pura y determinista.
 */
export const formatHeatmap = (heatmap: readonly number[]): string => {
  let max = 0;
  for (const value of heatmap) {
    const count = Number.isFinite(value) ? value : 0;
    if (count > max) {
      max = count;
    }
  }

  let out = "";
  for (let h = 0; h < HEATMAP_HOURS; h += 1) {
    const raw = heatmap[h] ?? 0;
    const count = Number.isFinite(raw) && raw > 0 ? raw : 0;
    out += barGlyph(count, max);
  }

  return out;
};
