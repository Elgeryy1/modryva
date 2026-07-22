/**
 * Detector de archivos peligrosos por nombre de fichero, sin antivirus ni
 * inspeccion de contenido: solo heuristica sobre el nombre. Marca extensiones
 * ejecutables conocidas y el truco de la doble extension (p.ej.
 * "factura.pdf.exe", que aparenta ser un PDF). Puro, determinista y
 * case-insensitive; recibe el nombre plano y devuelve valores.
 */

/**
 * Extensiones consideradas peligrosas (ejecutables, scripts e instaladores
 * habituales en malware de Telegram). En minusculas y sin el punto.
 */
export const DANGEROUS_EXTENSIONS: readonly string[] = [
  "apk",
  "exe",
  "bat",
  "scr",
  "js",
  "vbs",
  "ps1",
  "jar",
  "msi",
  "com",
];

const DANGEROUS_SET: ReadonlySet<string> = new Set(DANGEROUS_EXTENSIONS);

/**
 * Devuelve los segmentos separados por punto de un nombre de fichero ya
 * normalizado (recortado y en minusculas), descartando segmentos vacios que
 * provienen de puntos iniciales, finales o repetidos. Puro.
 */
const dangerousFileSegments = (normalized: string): string[] =>
  normalized.split(".").filter((part) => part.length > 0);

/**
 * Extension final del nombre (en minusculas, sin punto) o undefined si el
 * nombre no tiene una extension util (sin punto, o solo puntos). Puro.
 */
const dangerousFileExtension = (name: string): string | undefined => {
  const segments = dangerousFileSegments(name.trim().toLowerCase());
  if (segments.length < 2) {
    return undefined;
  }
  return segments[segments.length - 1];
};

/**
 * True cuando la extension final del nombre esta en DANGEROUS_EXTENSIONS.
 * Case-insensitive; tolera espacios alrededor. Nombres sin extension devuelven
 * false. Puro y determinista.
 */
export const isDangerousFilename = (name: string): boolean => {
  const ext = dangerousFileExtension(name);
  return ext !== undefined && DANGEROUS_SET.has(ext);
};

/**
 * True cuando el nombre tiene al menos dos extensiones y la penultima aparenta
 * ser un formato "seguro" distinto de la final (p.ej. "factura.pdf.exe" o
 * "foto.jpg.scr"). Es la tecnica clasica para disfrazar un ejecutable. Un
 * nombre con una sola extension (aunque sea peligrosa) devuelve false.
 * Case-insensitive. Puro y determinista.
 */
export const hasDoubleExtension = (name: string): boolean => {
  const segments = dangerousFileSegments(name.trim().toLowerCase());
  if (segments.length < 3) {
    return false;
  }
  const last = segments[segments.length - 1];
  const prev = segments[segments.length - 2];
  if (last === undefined || prev === undefined) {
    return false;
  }
  return prev !== last;
};

/**
 * Clasificacion de un adjunto por su nombre. `dangerous` marca si debe
 * bloquearse; `reason` (opcional) explica por que, en espanol-neutro. Sin
 * `reason` cuando no es peligroso.
 */
export interface DangerousFileVerdict {
  readonly dangerous: boolean;
  readonly reason?: string;
}

/**
 * Clasifica un adjunto por su nombre de fichero. Combina extension peligrosa y
 * doble extension: la doble extension con final peligroso es la senal mas
 * fuerte (bloqueo con motivo especifico); una extension peligrosa simple
 * tambien bloquea. Nombres vacios o solo espacios se consideran no peligrosos.
 * Puro, case-insensitive y determinista.
 */
export const classifyAttachment = (name: string): DangerousFileVerdict => {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return { dangerous: false };
  }

  const dangerousExt = isDangerousFilename(trimmed);
  const doubleExt = hasDoubleExtension(trimmed);
  const ext = dangerousFileExtension(trimmed);

  if (doubleExt && dangerousExt) {
    return {
      dangerous: true,
      reason: `Doble extension que oculta un ejecutable .${ext ?? ""}`,
    };
  }

  if (dangerousExt) {
    return {
      dangerous: true,
      reason: `Extension peligrosa .${ext ?? ""}`,
    };
  }

  return { dangerous: false };
};
