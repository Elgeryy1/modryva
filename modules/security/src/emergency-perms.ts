/**
 * Role a member can hold when emergency permissions are evaluated.
 * Pure and deterministic.
 */
export type EmergencyPermissionRole = "helper" | "mod" | "admin";

/**
 * Input for evaluating emergency permissions: the member role and whether a
 * raid is currently active in the chat.
 * Pure and deterministic.
 */
export interface EmergencyPermissionInput {
  readonly role: EmergencyPermissionRole;
  readonly raidActive: boolean;
}

/**
 * Result of an emergency permission evaluation: whether powers are granted and
 * a user-facing Spanish description of the scope.
 * Pure and deterministic.
 */
export interface EmergencyPermissionGrant {
  readonly granted: boolean;
  readonly scope: string;
}

/**
 * Decides whether a member may act with elevated powers. A helper only gains
 * temporary powers while a raid is active; mod and admin always keep their
 * standing scope regardless of the raid flag.
 * Pure and deterministic.
 */
export const grantEmergencyPermission = (
  input: EmergencyPermissionInput,
): EmergencyPermissionGrant => {
  if (input.role === "admin") {
    return { granted: true, scope: "Permisos permanentes de administracion" };
  }
  if (input.role === "mod") {
    return { granted: true, scope: "Permisos permanentes de moderacion" };
  }
  if (input.raidActive) {
    return {
      granted: true,
      scope: "🛡️ Permisos temporales de emergencia durante el raid",
    };
  }
  return {
    granted: false,
    scope: "Sin permisos: no hay ningun raid activo ahora mismo",
  };
};
