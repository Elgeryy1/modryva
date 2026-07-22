/**
 * Nombres custom de modulos por comunidad. Cada grupo puede renombrar los
 * modulos que ve el staff (por ejemplo "Inbox" -> "Mesa de staff") sin que el
 * nucleo dependa de esos alias. Este modulo es logica pura: resuelve el nombre
 * visible a partir de un mapa de overrides y saneado de texto libre. Sin I/O,
 * sin estado, deterministico.
 */

/** Longitud maxima permitida para un nombre de modulo saneado. */
export const MODULE_NAME_MAX_LENGTH = 40;

/**
 * Nombres por defecto de cada modulo conocido. Las claves son los
 * identificadores estables usados por el nucleo; los valores son los nombres
 * user-facing por defecto (con acentos correctos).
 */
export const DEFAULT_MODULE_NAMES: Readonly<Record<string, string>> = {
  inbox: "Bandeja de entrada",
  moderation: "Moderacion",
  welcome: "Bienvenidas",
  captcha: "Captcha",
  filters: "Filtros",
  antiflood: "Anti-flood",
  federation: "Federacion",
  reports: "Reportes",
  notes: "Notas",
  rules: "Reglas",
  warns: "Advertencias",
  games: "Juegos",
  casino: "Casino",
  afk: "AFK",
};

/**
 * Sanea un nombre de modulo escrito por un admin: colapsa espacios internos,
 * recorta los extremos y limita la longitud a `MODULE_NAME_MAX_LENGTH`
 * caracteres (recortando de nuevo tras el truncado). Devuelve cadena vacia si
 * el texto no aporta contenido visible. Pura y deterministica.
 */
export const sanitizeModuleName = (s: string): string => {
  const collapsed = s.replace(/\s+/g, " ").trim();
  if (collapsed.length <= MODULE_NAME_MAX_LENGTH) {
    return collapsed;
  }
  return collapsed.slice(0, MODULE_NAME_MAX_LENGTH).trim();
};

/**
 * Resuelve el nombre visible de un modulo. Prioridad: override saneado no
 * vacio del mapa `overrides`, si no el default de `DEFAULT_MODULE_NAMES`, si no
 * la propia `key`. Pura y deterministica.
 */
export const resolveModuleName = (
  key: string,
  overrides: Readonly<Record<string, string>>,
): string => {
  const rawOverride = overrides[key];
  if (rawOverride !== undefined) {
    const cleaned = sanitizeModuleName(rawOverride);
    if (cleaned.length > 0) {
      return cleaned;
    }
  }

  const fallback = DEFAULT_MODULE_NAMES[key];
  if (fallback !== undefined) {
    return fallback;
  }

  return key;
};
