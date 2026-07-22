/**
 * Recetas de configuracion compartibles: serializa un objeto de config plano a
 * un codigo corto (base64url de un JSON estable) para exportarlo por URL, lo
 * decodifica de vuelta validando el formato, y calcula el diff campo a campo
 * antes de aplicar una receta entrante. Logica pura y determinista: sin I/O,
 * sin red, sin Date.now()/Math.random(). El JSON es estable (claves ordenadas)
 * para que el mismo config produzca siempre el mismo token.
 */

/**
 * Un cambio propuesto al aplicar una receta entrante sobre la config actual.
 * `from` es el valor actual (undefined si la clave no existe todavia) y `to`
 * es el valor entrante.
 */
export interface ConfigRecipeChange {
  readonly key: string;
  readonly from: unknown;
  readonly to: unknown;
}

/** Resultado de decodificar un token de receta. Union discriminada por `ok`. */
export type ConfigRecipeDecodeResult =
  | { readonly ok: true; readonly config: Record<string, unknown> }
  | { readonly ok: false; readonly error: string };

/** Prefijo de version del token; permite evolucionar el formato sin romper. */
export const CONFIG_RECIPE_PREFIX = "r1.";

/**
 * Serializa un valor a JSON con las claves de los objetos ordenadas de forma
 * estable y recursiva, de modo que objetos equivalentes produzcan exactamente
 * la misma cadena. Los arrays conservan su orden. Pura y determinista.
 */
const stableStringify = (value: unknown): string => {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "null";
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  const entries = keys.map(
    (key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`,
  );
  return `{${entries.join(",")}}`;
};

/**
 * Codifica una cadena UTF-8 a base64url (sin relleno `=`, con `-` y `_`).
 * Usa Buffer de node cuando esta disponible y cae a un codificador manual en
 * su ausencia, para no depender fuertemente del entorno.
 */
const toBase64Url = (text: string): string => {
  const base64 =
    typeof Buffer !== "undefined"
      ? Buffer.from(text, "utf8").toString("base64")
      : manualBase64(text);
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

/**
 * Decodifica un base64url de vuelta a una cadena UTF-8. Devuelve null si el
 * texto no es base64url valido (caracteres fuera del alfabeto).
 */
const fromBase64Url = (token: string): string | null => {
  if (!/^[A-Za-z0-9_-]*$/.test(token)) {
    return null;
  }
  const base64 = token.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  try {
    if (typeof Buffer !== "undefined") {
      return Buffer.from(padded, "base64").toString("utf8");
    }
    return manualUnbase64(padded);
  } catch {
    return null;
  }
};

const B64_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** Codificador base64 manual sobre bytes UTF-8 (fallback sin Buffer). */
const manualBase64 = (text: string): string => {
  const bytes = utf8Bytes(text);
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i] ?? 0;
    const b1 = bytes[i + 1] ?? 0;
    const b2 = bytes[i + 2] ?? 0;
    const triple = (b0 << 16) | (b1 << 8) | b2;
    out += B64_ALPHABET[(triple >> 18) & 0x3f];
    out += B64_ALPHABET[(triple >> 12) & 0x3f];
    out += i + 1 < bytes.length ? B64_ALPHABET[(triple >> 6) & 0x3f] : "=";
    out += i + 2 < bytes.length ? B64_ALPHABET[triple & 0x3f] : "=";
  }
  return out;
};

/** Decodificador base64 manual a cadena UTF-8 (fallback sin Buffer). */
const manualUnbase64 = (base64: string): string => {
  const clean = base64.replace(/=+$/, "");
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const ch of clean) {
    const idx = B64_ALPHABET.indexOf(ch);
    if (idx === -1) {
      throw new Error("invalid base64");
    }
    buffer = (buffer << 6) | idx;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }
  return utf8Decode(bytes);
};

/** Convierte una cadena a sus bytes UTF-8. */
const utf8Bytes = (text: string): number[] => {
  const bytes: number[] = [];
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code < 0x10000) {
      bytes.push(
        0xe0 | (code >> 12),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f),
      );
    } else {
      bytes.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f),
      );
    }
  }
  return bytes;
};

/** Reconstruye una cadena a partir de sus bytes UTF-8. */
const utf8Decode = (bytes: readonly number[]): string => {
  let out = "";
  let i = 0;
  while (i < bytes.length) {
    const b0 = bytes[i] ?? 0;
    if (b0 < 0x80) {
      out += String.fromCodePoint(b0);
      i += 1;
    } else if (b0 < 0xe0) {
      out += String.fromCodePoint(
        ((b0 & 0x1f) << 6) | ((bytes[i + 1] ?? 0) & 0x3f),
      );
      i += 2;
    } else if (b0 < 0xf0) {
      out += String.fromCodePoint(
        ((b0 & 0x0f) << 12) |
          (((bytes[i + 1] ?? 0) & 0x3f) << 6) |
          ((bytes[i + 2] ?? 0) & 0x3f),
      );
      i += 3;
    } else {
      out += String.fromCodePoint(
        ((b0 & 0x07) << 18) |
          (((bytes[i + 1] ?? 0) & 0x3f) << 12) |
          (((bytes[i + 2] ?? 0) & 0x3f) << 6) |
          ((bytes[i + 3] ?? 0) & 0x3f),
      );
      i += 4;
    }
  }
  return out;
};

/**
 * Codifica una config plana a un codigo corto compartible. El resultado es
 * `CONFIG_RECIPE_PREFIX` seguido del JSON estable en base64url. Determinista:
 * la misma config (independientemente del orden de sus claves) produce siempre
 * el mismo token.
 */
export const encodeConfigRecipe = (config: Record<string, unknown>): string =>
  CONFIG_RECIPE_PREFIX + toBase64Url(stableStringify(config));

/**
 * Decodifica un token de receta. Valida el prefijo de version, el base64url y
 * que el payload sea un objeto JSON plano (no null, no array, no primitivo).
 * Devuelve `{ ok: true, config }` o `{ ok: false, error }`. Pura y sin lanzar.
 */
export const decodeConfigRecipe = (token: string): ConfigRecipeDecodeResult => {
  const trimmed = token.trim();

  if (!trimmed.startsWith(CONFIG_RECIPE_PREFIX)) {
    return { ok: false, error: "prefijo de version desconocido" };
  }

  const body = trimmed.slice(CONFIG_RECIPE_PREFIX.length);
  if (body.length === 0) {
    return { ok: false, error: "receta vacia" };
  }

  const json = fromBase64Url(body);
  if (json === null) {
    return { ok: false, error: "codificacion base64url invalida" };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, error: "JSON invalido" };
  }

  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, error: "la receta no es un objeto de config" };
  }

  return { ok: true, config: parsed as Record<string, unknown> };
};

/**
 * Calcula los cambios que aplicaria una receta entrante sobre la config actual,
 * comparando valor a valor por igualdad estructural (via JSON estable). Solo
 * incluye las claves presentes en `incoming` cuyo valor difiere del actual.
 * El orden de los cambios es el de las claves ordenadas alfabeticamente, para
 * que el resultado sea determinista. Pura y sin efectos.
 */
export const diffConfigRecipe = (
  current: Record<string, unknown>,
  incoming: Record<string, unknown>,
): readonly ConfigRecipeChange[] => {
  const changes: ConfigRecipeChange[] = [];
  const keys = Object.keys(incoming).sort();

  for (const key of keys) {
    const to = incoming[key];
    const from = Object.hasOwn(current, key) ? current[key] : undefined;
    if (stableStringify(from) !== stableStringify(to)) {
      changes.push({ key, from, to });
    }
  }

  return changes;
};
