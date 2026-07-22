/**
 * Gobernanza de admins: separacion de poderes para acciones sensibles.
 *
 * Dos mecanismos independientes y puros:
 *  - Conflicto de interes: un admin implicado en un caso no puede resolver su
 *    propio caso (checkConflictOfInterest).
 *  - Doble llave: ciertas acciones criticas requieren dos aprobadores distintos
 *    ademas del solicitante (requiresTwoKeys / evaluateTwoKeyApproval).
 *
 * Sin I/O, sin red, sin Prisma, sin Date.now()/Math.random(). Todo determinista:
 * recibe ids planos por parametro y devuelve valores.
 */

/**
 * Resultado de la comprobacion de conflicto de interes. `blocked` es true cuando
 * el actor no puede actuar sobre el caso; `reason` explica el motivo (texto
 * estable, apto para logs o auditoria).
 */
export interface ConflictOfInterestResult {
  readonly blocked: boolean;
  readonly reason: string;
}

/**
 * Comprueba si `actorId` esta implicado en el caso que pretende resolver. Un
 * admin implicado (aparece entre `involvedUserIds`) queda bloqueado: no puede
 * resolver su propio caso. Los ids se comparan tras hacer trim; los vacios se
 * ignoran. Puro y determinista.
 */
export const checkConflictOfInterest = (
  actorId: string,
  involvedUserIds: readonly string[],
): ConflictOfInterestResult => {
  const actor = actorId.trim();

  if (actor.length === 0) {
    return {
      blocked: true,
      reason: "El actor no esta identificado.",
    };
  }

  const isInvolved = involvedUserIds.some((id) => id.trim() === actor);

  if (isInvolved) {
    return {
      blocked: true,
      reason: "Conflicto de interes: el admin esta implicado en el caso.",
    };
  }

  return {
    blocked: false,
    reason: "Sin conflicto de interes.",
  };
};

/**
 * Acciones criticas que exigen el mecanismo de doble llave (dos aprobadores
 * distintos ademas del solicitante). Lista cerrada y de solo lectura.
 */
export const TWO_KEY_ACTIONS = [
  "ban-global",
  "monetizacion",
  "expulsion-masiva",
  "borrado-cascada",
] as const;

/** Union de las acciones que requieren doble llave. */
export type TwoKeyAction = (typeof TWO_KEY_ACTIONS)[number];

const twoKeyActionSet: ReadonlySet<string> = new Set(TWO_KEY_ACTIONS);

/**
 * True cuando la accion pertenece al conjunto de acciones criticas que exigen
 * doble llave. Comparacion exacta (sin trim ni normalizacion). Puro.
 */
export const requiresTwoKeys = (action: string): boolean =>
  twoKeyActionSet.has(action);

/** Numero de aprobadores distintos (ademas del solicitante) que exige la doble llave. */
export const TWO_KEY_REQUIRED_APPROVERS = 2;

/**
 * Resultado de evaluar una aprobacion de doble llave. `approved` es true solo
 * cuando se reunen los aprobadores necesarios; `reason` explica el veredicto.
 */
export interface TwoKeyApprovalResult {
  readonly approved: boolean;
  readonly reason: string;
}

/**
 * Evalua si una accion de doble llave reune las aprobaciones necesarias.
 *
 * Reglas:
 *  - Si la accion no requiere doble llave, se aprueba directamente.
 *  - El solicitante (`requesterId`) no cuenta como aprobador (no se aprueba a si
 *    mismo); se descuenta de la lista.
 *  - Los aprobadores se deduplican y se ignoran los vacios (tras trim).
 *  - Hacen falta al menos TWO_KEY_REQUIRED_APPROVERS aprobadores distintos.
 *
 * Puro y determinista.
 */
export const evaluateTwoKeyApproval = (
  action: string,
  approverIds: readonly string[],
  requesterId: string,
): TwoKeyApprovalResult => {
  if (!requiresTwoKeys(action)) {
    return {
      approved: true,
      reason: "La accion no requiere doble llave.",
    };
  }

  const requester = requesterId.trim();

  const validApprovers = new Set<string>();
  for (const raw of approverIds) {
    const id = raw.trim();
    if (id.length === 0) {
      continue;
    }
    if (id === requester) {
      continue;
    }
    validApprovers.add(id);
  }

  if (validApprovers.size < TWO_KEY_REQUIRED_APPROVERS) {
    return {
      approved: false,
      reason: `Doble llave: se requieren ${TWO_KEY_REQUIRED_APPROVERS} aprobadores distintos ademas del solicitante (hay ${validApprovers.size}).`,
    };
  }

  return {
    approved: true,
    reason: "Doble llave satisfecha.",
  };
};
