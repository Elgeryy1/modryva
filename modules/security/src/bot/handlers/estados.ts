import { opcionesDe, perteneceA } from "@superbot/shared";

import type { EmergencyPermissionRole } from "../../emergency-perms.js";
import type { RoleActionGuardRole } from "../../role-action-guard.js";

/**
 * Los roles validos de seguridad, y sus guardas.
 *
 * Mismo motivo que en soporte y comunidad, pero aqui pesa mas: estas dos
 * uniones deciden **quien puede hacer que**. El nucleo comprobaba una contra un
 * `ReadonlySet` estatico de la clase y la otra contra un `["helper","mod",
 * "admin"].includes(...)` escrito en el sitio, y las dos acababan en un `as`.
 *
 * Con `Record<Union, true>` no hay copia que mantener: TypeScript exige todas
 * las claves de la union y rechaza las que sobren. En una lista de roles, que
 * la copia se quede corta significa que un rol nuevo no puede hacer nada; que
 * se quede larga, que un rol que ya no existe sigue colando por la guarda.
 */

const ROLES_DE_ACCION: Record<RoleActionGuardRole, true> = {
  junior: true,
  mod: true,
  senior: true,
  owner: true,
};

const ROLES_DE_EMERGENCIA: Record<EmergencyPermissionRole, true> = {
  helper: true,
  mod: true,
  admin: true,
};

/** `true` si la cadena es un rol de la escala de acciones. */
export const esRolDeAccion = (
  v: string | undefined,
): v is RoleActionGuardRole => perteneceA(ROLES_DE_ACCION, v);

/** `true` si la cadena es un rol con permiso de emergencia. */
export const esRolDeEmergencia = (
  v: string | undefined,
): v is EmergencyPermissionRole => perteneceA(ROLES_DE_EMERGENCIA, v);

/** `junior|mod|senior|owner`, para el mensaje de uso. */
export const opcionesDeRolDeAccion = (): string => opcionesDe(ROLES_DE_ACCION);

/** `helper|mod|admin`, para el mensaje de uso. */
export const opcionesDeRolDeEmergencia = (): string =>
  opcionesDe(ROLES_DE_EMERGENCIA);
