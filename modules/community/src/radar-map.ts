/**
 * Vista radar de alertas: mapea una lista de alertas a coordenadas polares
 * para pintarlas en un radar. El angulo se reparte uniformemente en el rango
 * 0..360 grados segun la posicion de cada alerta, y el radio deriva de la
 * severidad recortada al rango 0..1. Logica pura y determinista: no hay I/O,
 * ni red, ni Date.now(); las mismas entradas producen siempre la misma salida.
 */

/** Una alerta candidata a pintarse en el radar. */
export interface RadarAlert {
  readonly id: string;
  /** Severidad cruda; se recorta a 0..1 para el radio. */
  readonly severity: number;
  /** Antiguedad en milisegundos (informativa; no afecta al mapeo). */
  readonly ageMs: number;
}

/** Punto polar resultante para una alerta. */
export interface RadarPoint {
  readonly id: string;
  /** Angulo en grados, en el rango [0, 360). */
  readonly angle: number;
  /** Radio en el rango [0, 1], derivado de la severidad. */
  readonly radius: number;
}

/** Recorta un valor al rango [0, 1]; NaN se trata como 0. */
const clamp01 = (value: number): number => {
  if (Number.isNaN(value)) {
    return 0;
  }
  if (value < 0) {
    return 0;
  }
  if (value > 1) {
    return 1;
  }
  return value;
};

/**
 * Mapea las alertas a puntos polares. El angulo de la alerta en posicion `i`
 * (de `n` alertas) es `i * 360 / n`, de modo que quedan repartidas de forma
 * uniforme por la circunferencia empezando en 0 grados. El radio es la
 * severidad recortada a [0, 1]. Preserva el orden de entrada. El parametro
 * `nowMsUnused` existe por compatibilidad de firma y no se utiliza, por lo que
 * la funcion es determinista. Devuelve un array vacio para una entrada vacia.
 */
export const mapToRadar = (
  alerts: readonly RadarAlert[],
  nowMsUnused?: number,
): readonly RadarPoint[] => {
  void nowMsUnused;
  const total = alerts.length;
  if (total === 0) {
    return [];
  }

  const step = 360 / total;
  const points: RadarPoint[] = [];
  for (let i = 0; i < total; i += 1) {
    const alert = alerts[i];
    if (alert === undefined) {
      continue;
    }
    points.push({
      id: alert.id,
      angle: i * step,
      radius: clamp01(alert.severity),
    });
  }
  return points;
};
