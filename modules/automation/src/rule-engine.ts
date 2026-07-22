/**
 * Motor de reglas evento-condicion-accion (ECA) puro y determinista.
 *
 * Cada regla escucha un `event`; cuando llega un `RuleContext` con ese mismo
 * evento se evaluan TODAS sus condiciones contra los `fields` planos del
 * contexto. Ademas respeta dos frenos temporales: la caducidad (`expiresAtMs`)
 * y el enfriamiento (`cooldownMs`) medido contra `lastFiredMs`. Nada de I/O,
 * red ni Date.now(): el llamador provee `nowMs` y los timestamps.
 */

/** Operadores soportados por una condicion de regla. */
export type RuleConditionOp = "eq" | "neq" | "gt" | "lt" | "contains";

/**
 * Una condicion sobre un campo del contexto. `field` es la clave dentro de
 * `RuleContext.fields`; `op` decide como comparar contra `value`.
 */
export interface RuleCondition {
  readonly field: string;
  readonly op: RuleConditionOp;
  readonly value: string | number;
}

/**
 * Una regla ECA. Se dispara cuando su `event` coincide, no ha caducado, no
 * esta en enfriamiento y todas sus `conditions` se cumplen.
 */
export interface EcaRule {
  readonly id: string;
  readonly event: string;
  readonly conditions: readonly RuleCondition[];
  readonly action: string;
  /** Milisegundos minimos entre disparos; requiere `lastFiredMs` en contexto. */
  readonly cooldownMs?: number;
  /** Epoch (ms) a partir del cual la regla ya no puede dispararse. */
  readonly expiresAtMs?: number;
}

/**
 * El contexto de evaluacion: el evento entrante, sus campos planos, el reloj
 * (`nowMs`) y, opcionalmente, cuando se disparo la regla por ultima vez.
 */
export interface RuleContext {
  readonly event: string;
  readonly fields: Record<string, string | number>;
  readonly nowMs: number;
  readonly lastFiredMs?: number;
}

/**
 * Motivos posibles del resultado de `evaluateRule`. Solo `"fires"` implica
 * que la regla se dispara; el resto explican por que NO lo hace.
 */
export type RuleEvalReason =
  | "fires"
  | "event-mismatch"
  | "expired"
  | "cooldown"
  | "condition-failed"
  | "missing-field";

/** Resultado de evaluar una sola regla. */
export interface RuleEvalResult {
  readonly fires: boolean;
  readonly reason: RuleEvalReason;
}

const compareCondition = (
  fieldValue: string | number,
  condition: RuleCondition,
): boolean => {
  switch (condition.op) {
    case "eq":
      return fieldValue === condition.value;
    case "neq":
      return fieldValue !== condition.value;
    case "gt":
      return Number(fieldValue) > Number(condition.value);
    case "lt":
      return Number(fieldValue) < Number(condition.value);
    case "contains":
      return String(fieldValue).includes(String(condition.value));
    default: {
      // Exhaustividad: si se agrega un operador nuevo, TypeScript avisa aqui.
      const _never: never = condition.op;
      return _never;
    }
  }
};

/**
 * Evalua una regla contra un contexto y explica el resultado. El orden de los
 * frenos es: evento, caducidad, enfriamiento y por ultimo condiciones. Una
 * regla sin condiciones se dispara si pasa los frenos temporales. Un campo
 * ausente en el contexto hace fallar su condicion (`"missing-field"`). Puro y
 * determinista.
 */
export const evaluateRule = (
  rule: EcaRule,
  ctx: RuleContext,
): RuleEvalResult => {
  if (rule.event !== ctx.event) {
    return { fires: false, reason: "event-mismatch" };
  }

  if (rule.expiresAtMs !== undefined && ctx.nowMs >= rule.expiresAtMs) {
    return { fires: false, reason: "expired" };
  }

  if (
    rule.cooldownMs !== undefined &&
    rule.cooldownMs > 0 &&
    ctx.lastFiredMs !== undefined &&
    ctx.nowMs - ctx.lastFiredMs < rule.cooldownMs
  ) {
    return { fires: false, reason: "cooldown" };
  }

  for (const condition of rule.conditions) {
    if (!Object.hasOwn(ctx.fields, condition.field)) {
      return { fires: false, reason: "missing-field" };
    }
    if (
      !compareCondition(
        ctx.fields[condition.field] as string | number,
        condition,
      )
    ) {
      return { fires: false, reason: "condition-failed" };
    }
  }

  return { fires: true, reason: "fires" };
};

/** Resultado de evaluar un lote de reglas: las que se disparan, en orden. */
export interface RulesEvalResult {
  readonly fired: readonly EcaRule[];
}

/**
 * Evalua un lote de reglas contra un mismo contexto y devuelve, preservando el
 * orden de entrada, aquellas que se disparan. Puro y determinista.
 */
export const evaluateRules = (
  rules: readonly EcaRule[],
  ctx: RuleContext,
): RulesEvalResult => ({
  fired: rules.filter((rule) => evaluateRule(rule, ctx).fires),
});
