/**
 * Dry-run / replay de reglas de automatizacion sobre eventos historicos. Deja
 * probar una regla contra una muestra de eventos ya ocurridos y estimar cuantas
 * veces habria disparado, su impacto porcentual y en que instantes. Todo es
 * logica pura y determinista: no toca red, Prisma ni el reloj; recibe la regla
 * y las muestras por parametro y devuelve valores. El match se reimplementa aqui
 * de forma local y minima para no depender del motor de reglas real.
 */

/**
 * Un evento historico de la muestra. `event` es el tipo (p.ej. "message",
 * "join"); `fields` son atributos planos ya extraidos; `ms` es el timestamp
 * epoch (ms) en que ocurrio.
 */
export interface SampleEvent {
  readonly event: string;
  readonly fields: Record<string, string | number>;
  readonly ms: number;
}

/** Operadores soportados por el matcher local de la simulacion. */
export type RuleSimOperator =
  | "eq"
  | "ne"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "contains";

/** Una condicion simple: el campo `field` comparado con `value` via `op`. */
export interface RuleSimCondition {
  readonly field: string;
  readonly op: string;
  readonly value: string | number;
}

/**
 * La regla a simular: dispara sobre eventos de tipo `event` cuyas condiciones
 * se cumplen TODAS (AND). Sin condiciones, cualquier evento del tipo dispara.
 */
export interface SimulatableRule {
  readonly event: string;
  readonly conditions: readonly RuleSimCondition[];
}

/** Resultado de simular una regla contra una muestra de eventos. */
export interface RuleSimulationResult {
  readonly wouldFire: number;
  readonly total: number;
  readonly impactPct: number;
  readonly matchedMs: readonly number[];
}

const KNOWN_OPERATORS: ReadonlySet<string> = new Set<RuleSimOperator>([
  "eq",
  "ne",
  "gt",
  "gte",
  "lt",
  "lte",
  "contains",
]);

/**
 * Umbral por defecto (en %) a partir del cual una regla se considera demasiado
 * agresiva: dispara en mas de la mitad de los eventos de la muestra.
 */
export const AGGRESSIVE_RULE_THRESHOLD_PCT = 50;

/**
 * Compara dos valores numericamente cuando ambos representan numeros; si alguno
 * no es numerico devuelve NaN para que las comparaciones de orden fallen. Pure.
 */
const asNumber = (value: string | number): number =>
  typeof value === "number" ? value : Number(value);

/**
 * Evalua una unica condicion contra un evento. Un operador desconocido o un
 * campo ausente nunca cumple. Las comparaciones de orden (gt/gte/lt/lte)
 * requieren que ambos lados sean numericos. Pure y determinista.
 */
export const matchesRuleCondition = (
  event: SampleEvent,
  condition: RuleSimCondition,
): boolean => {
  if (!KNOWN_OPERATORS.has(condition.op)) {
    return false;
  }

  if (!Object.hasOwn(event.fields, condition.field)) {
    return false;
  }

  const actual = event.fields[condition.field] as string | number;
  const expected = condition.value;

  switch (condition.op as RuleSimOperator) {
    case "eq":
      return String(actual) === String(expected);
    case "ne":
      return String(actual) !== String(expected);
    case "contains":
      return String(actual).includes(String(expected));
    case "gt": {
      const a = asNumber(actual);
      const b = asNumber(expected);
      return Number.isFinite(a) && Number.isFinite(b) && a > b;
    }
    case "gte": {
      const a = asNumber(actual);
      const b = asNumber(expected);
      return Number.isFinite(a) && Number.isFinite(b) && a >= b;
    }
    case "lt": {
      const a = asNumber(actual);
      const b = asNumber(expected);
      return Number.isFinite(a) && Number.isFinite(b) && a < b;
    }
    case "lte": {
      const a = asNumber(actual);
      const b = asNumber(expected);
      return Number.isFinite(a) && Number.isFinite(b) && a <= b;
    }
    default:
      return false;
  }
};

/**
 * True cuando la regla dispararia sobre el evento dado: el tipo de evento
 * coincide y TODAS las condiciones se cumplen (AND). Una regla sin condiciones
 * dispara sobre cualquier evento de su tipo. Pure y determinista.
 */
export const ruleFiresOnEvent = (
  rule: SimulatableRule,
  event: SampleEvent,
): boolean => {
  if (event.event !== rule.event) {
    return false;
  }
  return rule.conditions.every((condition) =>
    matchesRuleCondition(event, condition),
  );
};

/**
 * Redondea a un decimal para que el porcentaje sea estable y comparable en los
 * tests sin arrastrar ruido de coma flotante. Pure.
 */
const roundPct = (value: number): number => Math.round(value * 10) / 10;

/**
 * Simula la regla contra la muestra de eventos historicos y devuelve cuantos
 * dispararian (`wouldFire`), el total de eventos (`total`), el impacto en % de
 * la muestra (`impactPct`, 0 si la muestra esta vacia) y los timestamps de los
 * eventos disparados en el orden de la muestra (`matchedMs`). Pure: no muta la
 * entrada y no usa el reloj.
 */
export const simulateRule = (
  rule: SimulatableRule,
  samples: readonly SampleEvent[],
): RuleSimulationResult => {
  const matchedMs: number[] = [];

  for (const sample of samples) {
    if (ruleFiresOnEvent(rule, sample)) {
      matchedMs.push(sample.ms);
    }
  }

  const total = samples.length;
  const wouldFire = matchedMs.length;
  const impactPct = total === 0 ? 0 : roundPct((wouldFire / total) * 100);

  return { wouldFire, total, impactPct, matchedMs };
};

/**
 * True cuando la regla es "muerta": nunca dispara pese a haber eventos en la
 * muestra (`wouldFire === 0 && total > 0`). Con muestra vacia no se puede
 * afirmar que este muerta, asi que devuelve false. Pure.
 */
export const detectDeadRule = (wouldFire: number, total: number): boolean =>
  total > 0 && wouldFire === 0;

/**
 * True cuando la regla es "agresiva": su impacto supera estrictamente el umbral
 * (por defecto 50%). Un umbral personalizado permite ajustar la sensibilidad.
 * Pure.
 */
export const detectAggressiveRule = (
  impactPct: number,
  threshold: number = AGGRESSIVE_RULE_THRESHOLD_PCT,
): boolean => impactPct > threshold;
