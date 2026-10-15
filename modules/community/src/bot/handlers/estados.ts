import { opcionesDe, perteneceA } from "@superbot/shared";

import type { CommunityIntent } from "../../intent-config.js";
import type { MemberGoal } from "../../member-goal.js";
import type { RuleSeverityLevel } from "../../rule-severity.js";

/**
 * Los valores validos de las uniones de comunidad, y sus guardas.
 *
 * Mismo motivo que en soporte: el nucleo los comprobaba con un `new Set([...])`
 * escrito a mano y despues hacia `as CommunityIntent`. El `Set` era una copia
 * de la union, y el mensaje de uso otra. Con `Record<Union, true>` no hay copia
 * que mantener y la lista del uso sale del mismo objeto.
 *
 * Estan aqui y no compartidos con soporte porque **un módulo no importa a
 * otro**: lo que se comparte es la guarda generica, en `@superbot/shared`.
 */

const INTENCIONES: Record<CommunityIntent, true> = {
  anti_spam: true,
  ordenar: true,
  chill: true,
  crecer: true,
};

const OBJETIVOS_DE_MIEMBRO: Record<MemberGoal, true> = {
  aprender: true,
  socializar: true,
  vender: true,
  soporte: true,
  otro: true,
};

const SEVERIDADES_DE_REGLA: Record<RuleSeverityLevel, true> = {
  leve: true,
  media: true,
  grave: true,
  expulsion: true,
};

/** `true` si la cadena es una intención de ajustes. */
export const esIntencion = (v: string | undefined): v is CommunityIntent =>
  perteneceA(INTENCIONES, v);

/** `true` si la cadena es un objetivo de miembro. */
export const esObjetivoDeMiembro = (v: string | undefined): v is MemberGoal =>
  perteneceA(OBJETIVOS_DE_MIEMBRO, v);

/** `true` si la cadena es un nivel de severidad de regla. */
export const esSeveridadDeRegla = (
  v: string | undefined,
): v is RuleSeverityLevel => perteneceA(SEVERIDADES_DE_REGLA, v);

/** `anti_spam|ordenar|chill|crecer`, para el mensaje de uso. */
export const opcionesDeIntencion = (): string => opcionesDe(INTENCIONES);

/** `aprender|socializar|...`, para el mensaje de uso. */
export const opcionesDeObjetivo = (): string =>
  opcionesDe(OBJETIVOS_DE_MIEMBRO);

/** `leve|media|grave|expulsion`, para el mensaje de uso. */
export const opcionesDeSeveridad = (): string =>
  opcionesDe(SEVERIDADES_DE_REGLA);
