/**
 * Estado de una incidencia de soporte dentro de su ciclo de vida.
 * Pure and deterministic.
 */
export type IncidentStatus = "abierto" | "esperando" | "resuelto" | "cerrado";

/**
 * Evento que puede disparar un cambio de estado en una incidencia.
 * Pure and deterministic.
 */
export type IncidentEvent =
  | "responder"
  | "pedir_info"
  | "resolver"
  | "cerrar"
  | "reabrir";

/**
 * Resultado de evaluar un evento contra el estado actual: el estado
 * resultante y si hubo un cambio efectivo.
 * Pure and deterministic.
 */
export interface IncidentTransition {
  readonly next: IncidentStatus;
  readonly changed: boolean;
}

/**
 * Tabla de transiciones validas de la maquina de estados. Cada estado
 * mapea solo los eventos que producen un nuevo estado; los eventos
 * ausentes se consideran no aplicables y no cambian nada.
 */
const TRANSITIONS: Readonly<
  Record<
    IncidentStatus,
    Readonly<Partial<Record<IncidentEvent, IncidentStatus>>>
  >
> = {
  abierto: {
    pedir_info: "esperando",
    resolver: "resuelto",
    cerrar: "cerrado",
  },
  esperando: {
    responder: "abierto",
    resolver: "resuelto",
    cerrar: "cerrado",
  },
  resuelto: {
    pedir_info: "esperando",
    reabrir: "abierto",
    cerrar: "cerrado",
  },
  cerrado: {
    reabrir: "abierto",
  },
};

/**
 * Aplica un evento a la maquina de estados de incidencias. Si el evento
 * no es valido para el estado actual, mantiene el estado y devuelve
 * changed=false. Una transicion hacia el mismo estado tampoco cuenta
 * como cambio.
 * Pure and deterministic.
 */
export const nextIncidentStatus = (
  current: IncidentStatus,
  event: IncidentEvent,
): IncidentTransition => {
  const target = TRANSITIONS[current][event];
  if (target === undefined || target === current) {
    return { next: current, changed: false };
  }
  return { next: target, changed: true };
};
