/**
 * Validacion de seguridad estatica de un manifiesto de plugin de automatizacion.
 * Logica pura: sin I/O, sin red, sin Date.now()/Math.random(). Todo se deriva
 * de los inputs planos que recibe. Un manifiesto declara los scopes que el
 * plugin pretende usar, si es de solo lectura, y si requiere aprobacion humana
 * antes de ejecutarse. La validacion rechaza scopes desconocidos, escritura sin
 * aprobacion, y nombres vacios.
 */

/** Manifiesto declarado por un plugin de automatizacion. */
export interface PluginManifest {
  readonly name: string;
  readonly scopes: readonly string[];
  readonly readOnly: boolean;
  readonly requiresApproval: boolean;
}

/**
 * Scopes permitidos para un plugin. Cualquier scope fuera de este conjunto es
 * rechazado por `validatePluginManifest`.
 */
export const PLUGIN_ALLOWED_SCOPES: readonly string[] = [
  "messages.read",
  "messages.write",
  "members.read",
  "members.write",
  "moderation.read",
  "moderation.write",
  "config.read",
  "config.write",
];

const PLUGIN_ALLOWED_SCOPE_SET: ReadonlySet<string> = new Set(
  PLUGIN_ALLOWED_SCOPES,
);

/** Sufijo que identifica un scope de escritura. */
const WRITE_SCOPE_SUFFIX = ".write";

/** Resultado de validar un manifiesto: `ok` y la lista de problemas hallados. */
export interface PluginManifestValidation {
  readonly ok: boolean;
  readonly issues: readonly string[];
}

/**
 * True cuando el scope concede permiso de escritura (sufijo `.write`).
 */
export const pluginScopeIsWrite = (scope: string): boolean =>
  scope.endsWith(WRITE_SCOPE_SUFFIX);

/**
 * Valida estaticamente un manifiesto de plugin. Reglas:
 * - el nombre no puede estar vacio (ni ser solo espacios);
 * - todo scope debe pertenecer a `PLUGIN_ALLOWED_SCOPES`;
 * - los scopes duplicados se reportan;
 * - si el manifiesto declara scopes de escritura, `readOnly` no puede ser true;
 * - un plugin que puede escribir (algun scope `.write` y `readOnly` false) debe
 *   exigir aprobacion (`requiresApproval` true).
 * Puro y determinista: el orden de `issues` deriva del orden de `scopes`.
 */
export const validatePluginManifest = (
  m: PluginManifest,
): PluginManifestValidation => {
  const issues: string[] = [];

  if (m.name.trim().length === 0) {
    issues.push("El nombre del plugin no puede estar vacio.");
  }

  const seen = new Set<string>();
  let hasWriteScope = false;

  for (const scope of m.scopes) {
    if (!PLUGIN_ALLOWED_SCOPE_SET.has(scope)) {
      issues.push(`Scope desconocido: "${scope}".`);
      continue;
    }
    if (seen.has(scope)) {
      issues.push(`Scope duplicado: "${scope}".`);
      continue;
    }
    seen.add(scope);
    if (pluginScopeIsWrite(scope)) {
      hasWriteScope = true;
    }
  }

  if (hasWriteScope && m.readOnly) {
    issues.push(
      "El manifiesto declara scopes de escritura pero esta marcado como solo lectura.",
    );
  }

  const canWrite = hasWriteScope && !m.readOnly;
  if (canWrite && !m.requiresApproval) {
    issues.push("Un plugin con escritura debe requerir aprobacion.");
  }

  return { ok: issues.length === 0, issues };
};
