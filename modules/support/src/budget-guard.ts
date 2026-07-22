/**
 * Presupuesto por grupo + deteccion de coste anomalo de IA (ideas #181, #182,
 * #183): avisa cuando un grupo se acerca o supera su limite mensual y cuando el
 * gasto reciente se dispara respecto a su media. Logica pura y determinista: sin
 * I/O, sin reloj, sin azar.
 */

/** Estado de presupuesto: gastado vs limite (misma unidad, p.ej. tokens/creditos). */
export interface BudgetState {
  readonly spent: number;
  readonly limit: number;
}

/** Resultado de evaluar un presupuesto. `pct` es el consumo 0..1 (o mas si excede). */
export interface BudgetCheck {
  readonly overBudget: boolean;
  readonly nearLimit: boolean;
  readonly pct: number;
}

/** Umbral (fraccion del limite) a partir del cual se considera "cerca del limite". */
export const BUDGET_NEAR_LIMIT_RATIO = 0.8;

const safe = (value: number): number =>
  Number.isFinite(value) ? Math.max(0, value) : 0;

/**
 * Evalua un presupuesto. `pct` = spent/limit (0 si el limite es <= 0).
 * `overBudget` cuando spent >= limit (con limite valido). `nearLimit` cuando
 * pct >= BUDGET_NEAR_LIMIT_RATIO sin llegar a superarlo. Pura y determinista.
 */
export const checkBudget = (b: BudgetState): BudgetCheck => {
  const spent = safe(b.spent);
  const limit = safe(b.limit);

  if (limit <= 0) {
    return { overBudget: false, nearLimit: false, pct: 0 };
  }

  const pct = spent / limit;
  const overBudget = spent >= limit;
  return {
    overBudget,
    nearLimit: !overBudget && pct >= BUDGET_NEAR_LIMIT_RATIO,
    pct,
  };
};

/** Resultado de la deteccion de coste anomalo. */
export interface CostAnomaly {
  readonly anomalous: boolean;
  readonly reason: string;
}

/**
 * Detecta si el ultimo gasto de `recent` se dispara respecto a la media de los
 * anteriores (ultimo >= media_previa * factor). Necesita al menos dos muestras
 * previas para tener una media significativa. Pura y determinista; segura ante
 * listas cortas o medias cero.
 */
export const detectCostAnomaly = (
  recent: readonly number[],
  factor: number,
): CostAnomaly => {
  if (recent.length < 3) {
    return { anomalous: false, reason: "Muestras insuficientes." };
  }

  const last = safe(recent[recent.length - 1] ?? 0);
  const previous = recent.slice(0, -1).map(safe);
  const mean =
    previous.reduce((sum, value) => sum + value, 0) / previous.length;

  const mult = Number.isFinite(factor) && factor > 0 ? factor : 3;

  if (mean <= 0) {
    return { anomalous: false, reason: "Sin gasto previo de referencia." };
  }

  if (last >= mean * mult) {
    return {
      anomalous: true,
      reason: `Gasto reciente (${Math.round(last)}) muy por encima de la media (${Math.round(mean)}).`,
    };
  }

  return { anomalous: false, reason: "Gasto dentro de lo normal." };
};
