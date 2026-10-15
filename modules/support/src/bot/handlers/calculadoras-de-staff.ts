import { decimalDelArgumento, enteroDelArgumento } from "@superbot/shared";

import { shouldEscalateToOwner } from "../../inactive-admin-escalation.js";
import { detectBurnout } from "../../staff-burnout.js";

/**
 * Las calculadoras de staff de `/utility_plus` que viven en soporte.
 *
 * Las otras tres de la familia estan en `modules/security`: sus detectores
 * viven allí y un módulo no importa a otro.
 */

/** `/burnout_staff`: si quien modera lleva demasiadas horas encima. */
export const calculadoraDeBurnoutDeStaff = (
  args: readonly string[],
): string => {
  const conflictosResueltos = enteroDelArgumento(args[0]);
  const horasActivo = decimalDelArgumento(args[1]);
  if (conflictosResueltos === null || horasActivo === null) {
    return "Uso: /burnout_staff <conflictos_resueltos> <horas_activo>";
  }

  return detectBurnout({
    conflictsResolved: conflictosResueltos,
    hoursActive: horasActivo,
  }).advice;
};

/**
 * `/escalar_owner`: si una alerta lleva demasiado tiempo sin respuesta.
 *
 * El reloj entra por parametro. El nucleo llamaba a `Date.now()` dentro, y con
 * eso no habia forma de probar "justo despues" contra "media hora mas tarde"
 * sin tocar el reloj del proceso.
 *
 * Los minutos son relativos a ese instante y se restan, asi que el segundo
 * argumento es opcional de verdad: si falta —o no es un numero— se pasa
 * `undefined`, que para el detector significa "nadie ha respondido", no
 * "respondieron hace 0 minutos". Es la diferencia entre escalar y no escalar.
 */
export const calculadoraDeEscaladaAlOwner = (
  args: readonly string[],
  ahoraMs: number,
): string => {
  const minutosDesdeAlerta = decimalDelArgumento(args[0]);
  if (minutosDesdeAlerta === null) {
    return "Uso: /escalar_owner <min_desde_alerta> [min_desde_respuesta]";
  }

  const minutosDesdeRespuesta = decimalDelArgumento(args[1]);
  const respuestaMs =
    minutosDesdeRespuesta === null
      ? undefined
      : ahoraMs - minutosDesdeRespuesta * 60_000;

  const v = shouldEscalateToOwner({
    alertMs: ahoraMs - minutosDesdeAlerta * 60_000,
    nowMs: ahoraMs,
    lastAdminResponseMs: respuestaMs,
  });

  return v.escalate
    ? "🚨 Escalar al owner: nadie respondió a tiempo."
    : "🟢 Todavía dentro del margen de respuesta.";
};
