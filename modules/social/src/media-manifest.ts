/**
 * Validación del manifiesto de medios.
 *
 * Un recurso entra en la biblioteca SOLO por aquí, y solo desde un manifiesto
 * local que alguien ha escrito a mano junto a los ficheros. No hay ninguna otra
 * puerta: ni comando, ni endpoint, ni campo de la Mini App acepta una ruta o
 * una URL que acabe convertida en un recurso.
 *
 * Eso no es una comodidad, es la postura de seguridad completa de `/gato` y
 * `/perro` (informe §8.4, §16.3). Mientras la única entrada sea un fichero del
 * repositorio revisado en un commit, no existe SSRF que discutir: no hay
 * petición saliente que envenenar.
 *
 * Puro: recibe los bytes ya leídos y decide. Quien lee del disco es el script.
 */

/** Formatos que Telegram acepta como foto y que sabemos validar por cabecera. */
export const ALLOWED_MEDIA_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
export type AllowedMediaMime = (typeof ALLOWED_MEDIA_MIME)[number];

/**
 * Tope de tamaño.
 *
 * Telegram acepta hasta 10 MB por foto, pero estos ficheros se guardan y se
 * suben una vez por cada bot: 2 MB sobra para una foto de un gato y mantiene
 * acotado el coste de preparar un bot hijo nuevo.
 */
export const MAX_MEDIA_BYTES = 2 * 1024 * 1024;
/** Por debajo de esto no es una foto, es un error de copia. */
export const MIN_MEDIA_BYTES = 512;

/** Una entrada tal y como se escribe en el manifiesto. */
export interface ManifestEntry {
  readonly file: string;
  readonly kind: string;
  readonly source: string;
  readonly licence: string;
  readonly attribution?: string | null;
}

export type ManifestRejection =
  | "unknown-kind"
  | "missing-source"
  | "missing-licence"
  | "bad-file-name"
  | "looks-like-url"
  | "too-small"
  | "too-large"
  | "unknown-format"
  | "mime-mismatch";

export type ManifestVerdict =
  | {
      readonly ok: true;
      readonly kind: "cat" | "dog";
      readonly mime: AllowedMediaMime;
      readonly bytes: number;
    }
  | { readonly ok: false; readonly reason: ManifestRejection };

/**
 * El tipo real del fichero, leído de sus primeros bytes.
 *
 * La extensión la escribe una persona y puede mentir; la cabecera no. Un `.jpg`
 * que en realidad es otra cosa se rechaza aquí y nunca llega a Telegram.
 */
export const sniffImageMime = (bytes: Uint8Array): AllowedMediaMime | null => {
  if (bytes.length < 12) {
    return null;
  }
  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (png.every((byte, index) => bytes[index] === byte)) {
    return "image/png";
  }
  // WebP: "RIFF" .... "WEBP"
  const riff = [0x52, 0x49, 0x46, 0x46];
  const webp = [0x57, 0x45, 0x42, 0x50];
  if (
    riff.every((byte, index) => bytes[index] === byte) &&
    webp.every((byte, index) => bytes[8 + index] === byte)
  ) {
    return "image/webp";
  }
  return null;
};

/** Nombre de fichero seguro: sin rutas, sin `..`, sin nada exótico. */
const isPlainFileName = (name: string): boolean =>
  /^[a-zA-Z0-9._-]{1,120}$/u.test(name) && !name.includes("..");

/**
 * ¿Esto parece una URL en vez de un nombre de fichero?
 *
 * Cualquier esquema, con o sin `//`: así caen `data:`, `javascript:` y `file:`
 * además de `http(s)://`. El esquema debe tener al menos DOS caracteres para
 * que `C:\ruta\gato.jpg` no se confunda con una URL — una ruta de Windows
 * también se rechaza, pero como nombre de fichero inválido, que es lo que es.
 */
const looksLikeUrl = (value: string): boolean => {
  const trimmed = value.trim();
  return /^[a-z][a-z0-9+.-]+:/iu.test(trimmed) || trimmed.startsWith("//");
};

/**
 * Decide si una entrada del manifiesto puede entrar en la biblioteca.
 *
 * El orden importa: primero lo que se puede saber sin mirar los bytes (más
 * barato y con mejor mensaje), y al final la comprobación de formato real.
 */
export const validateManifestEntry = (
  entry: ManifestEntry,
  bytes: Uint8Array,
): ManifestVerdict => {
  if (entry.kind !== "cat" && entry.kind !== "dog") {
    return { ok: false, reason: "unknown-kind" };
  }
  // `looksLikeUrl` antes que el nombre de fichero: si alguien pone una URL
  // quiere una respuesta que lo diga, no un "nombre inválido".
  if (looksLikeUrl(entry.file)) {
    return { ok: false, reason: "looks-like-url" };
  }
  if (!isPlainFileName(entry.file)) {
    return { ok: false, reason: "bad-file-name" };
  }
  if (entry.source.trim().length === 0) {
    return { ok: false, reason: "missing-source" };
  }
  if (entry.licence.trim().length === 0) {
    return { ok: false, reason: "missing-licence" };
  }
  if (bytes.length < MIN_MEDIA_BYTES) {
    return { ok: false, reason: "too-small" };
  }
  if (bytes.length > MAX_MEDIA_BYTES) {
    return { ok: false, reason: "too-large" };
  }

  const mime = sniffImageMime(bytes);
  if (mime === null) {
    return { ok: false, reason: "unknown-format" };
  }
  // La extensión debe concordar con lo que dicen los bytes. No es seguridad
  // (la cabecera ya decide), es higiene: un desajuste señala una confusión.
  const extension = entry.file.split(".").pop()?.toLowerCase() ?? "";
  const expected: Record<string, AllowedMediaMime> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
  };
  if (expected[extension] !== mime) {
    return { ok: false, reason: "mime-mismatch" };
  }

  return { ok: true, kind: entry.kind, mime, bytes: bytes.length };
};

/** Explicación en castellano, para el informe del importador. */
export const describeRejection = (reason: ManifestRejection): string => {
  switch (reason) {
    case "unknown-kind":
      return "el tipo debe ser 'cat' o 'dog'";
    case "missing-source":
      return "falta la procedencia (source)";
    case "missing-licence":
      return "falta la licencia";
    case "bad-file-name":
      return "el nombre de fichero no puede llevar rutas ni caracteres raros";
    case "looks-like-url":
      return "esto es una URL: la biblioteca solo admite ficheros locales";
    case "too-small":
      return `pesa menos de ${MIN_MEDIA_BYTES} bytes: no parece una imagen`;
    case "too-large":
      return `pesa más de ${Math.round(MAX_MEDIA_BYTES / 1024)} KB`;
    case "unknown-format":
      return "los bytes no son JPEG, PNG ni WebP";
    default:
      return "la extensión no coincide con el contenido real del fichero";
  }
};

/** Estados de la preparación de un recurso para un bot concreto. */
export const MEDIA_UPLOAD_STATES = [
  "pending",
  "ready",
  "failed",
  "disabled",
] as const;
export type MediaUploadState = (typeof MEDIA_UPLOAD_STATES)[number];

/** Cuántas veces se reintenta subir un recurso antes de darlo por fallido. */
export const MAX_UPLOAD_ATTEMPTS = 3;

/**
 * El estado siguiente tras un intento de subida.
 *
 * Un fallo no marca `failed` a la primera: Telegram devuelve 429 y errores
 * transitorios constantemente, y rendirse al primer tropiezo dejaría a un bot
 * hijo sin biblioteca para siempre por un mal minuto. Solo tras agotar los
 * intentos pasa a `failed`, que es un estado que alguien debe mirar.
 */
export const nextUploadState = (
  attemptsSoFar: number,
  outcome: "ok" | "error",
): { readonly state: MediaUploadState; readonly attempts: number } => {
  const attempts = attemptsSoFar + 1;
  if (outcome === "ok") {
    return { state: "ready", attempts };
  }
  return {
    state: attempts >= MAX_UPLOAD_ATTEMPTS ? "failed" : "pending",
    attempts,
  };
};
