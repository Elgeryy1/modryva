import { opcionesDe, perteneceA } from "@superbot/shared";

import type { MediationEvent, MediationState } from "../../async-mediation.js";
import type { IncidentEvent, IncidentStatus } from "../../incident-status.js";
import type { VipClientPlan } from "../../vip-client.js";

/**
 * Los valores validos de las uniones de soporte, y sus guardas.
 *
 * El nucleo comprobaba estos valores con un `new Set([...])` escrito a mano y
 * despues hacia `as MediationState`. Funcionaba, pero el `Set` era una copia de
 * la union: **si la union crecia, el `Set` se quedaba corto en silencio** y el
 * estado nuevo se rechazaba con el mensaje de uso, o —peor— si se quitaba un
 * valor de la union, el `as` seguia dejandolo pasar.
 *
 * Con un `Record<Union, true>` no hay copia que mantener: TypeScript exige
 * TODAS las claves de la union y rechaza cualquiera que sobre. Y la lista del
 * mensaje de uso sale del mismo objeto, asi que tampoco puede quedarse vieja.
 */

const ESTADOS_DE_MEDIACION: Record<MediationState, true> = {
  abierta: true,
  esperando_a: true,
  esperando_b: true,
  lista_revision: true,
  cerrada: true,
};

const EVENTOS_DE_MEDIACION: Record<MediationEvent, true> = {
  version_a: true,
  version_b: true,
  revisar: true,
  cerrar: true,
};

const ESTADOS_DE_INCIDENCIA: Record<IncidentStatus, true> = {
  abierto: true,
  esperando: true,
  resuelto: true,
  cerrado: true,
};

const EVENTOS_DE_INCIDENCIA: Record<IncidentEvent, true> = {
  responder: true,
  pedir_info: true,
  resolver: true,
  cerrar: true,
  reabrir: true,
};

const PLANES_DE_CLIENTE: Record<VipClientPlan, true> = {
  free: true,
  pro: true,
  vip: true,
};

/** `true` si la cadena es un estado de mediacion. */
export const esEstadoDeMediacion = (
  v: string | undefined,
): v is MediationState => perteneceA(ESTADOS_DE_MEDIACION, v);

/** `true` si la cadena es un evento de mediacion. */
export const esEventoDeMediacion = (
  v: string | undefined,
): v is MediationEvent => perteneceA(EVENTOS_DE_MEDIACION, v);

/** `true` si la cadena es un estado de incidencia. */
export const esEstadoDeIncidencia = (
  v: string | undefined,
): v is IncidentStatus => perteneceA(ESTADOS_DE_INCIDENCIA, v);

/** `true` si la cadena es un evento de incidencia. */
export const esEventoDeIncidencia = (
  v: string | undefined,
): v is IncidentEvent => perteneceA(EVENTOS_DE_INCIDENCIA, v);

/** `true` si la cadena es un plan de cliente. */
export const esPlanDeCliente = (v: string | undefined): v is VipClientPlan =>
  perteneceA(PLANES_DE_CLIENTE, v);

/** `<abierta|esperando_a|...>` para el uso de `/mediacion`. */
export const opcionesDeMediacion = (): string =>
  `<${opcionesDe(ESTADOS_DE_MEDIACION)}> <${opcionesDe(EVENTOS_DE_MEDIACION)}>`;

/** `<abierto|esperando|...>` para el uso de `/estado_incidencia`. */
export const opcionesDeIncidencia = (): string =>
  `<${opcionesDe(ESTADOS_DE_INCIDENCIA)}> <${opcionesDe(EVENTOS_DE_INCIDENCIA)}>`;

/** `<free|pro|vip>` para el uso de `/trato_vip`. */
export const opcionesDePlan = (): string =>
  `<${opcionesDe(PLANES_DE_CLIENTE)}>`;
