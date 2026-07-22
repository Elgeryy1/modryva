/**
 * Blocklist de packs de stickers problematicos. Deja pasar o bloquea un sticker
 * comparando su set name o su file_unique_id contra una lista configurada. Todo
 * se normaliza (trim + minusculas) para que la coincidencia sea estable frente a
 * mayusculas y espacios sobrantes. Logica pura: sin I/O ni estado.
 */

/**
 * Referencia minima de un sticker recibido. Ambos campos son opcionales porque
 * Telegram no siempre entrega el set name (stickers sueltos) ni garantiza mas
 * que el file_unique_id.
 */
export interface StickerRef {
  readonly setName?: string;
  readonly fileUniqueId?: string;
}

/**
 * Resultado de la comprobacion. Cuando `blocked` es false, `reason` se omite
 * (no se asigna undefined a la propiedad opcional).
 */
export interface StickerBlocklistMatch {
  readonly blocked: boolean;
  readonly reason?: string;
}

/** Normaliza una entrada: recorta espacios y pasa a minusculas. */
const normalize = (value: string): string => value.trim().toLowerCase();

/**
 * Normaliza una blocklist a un conjunto de entradas comparables: recorta,
 * minusculiza y descarta cadenas vacias y duplicados. Preserva el primer orden
 * de aparicion (util para inspeccion determinista). Pura.
 */
export const normalizeStickerBlocklist = (
  blocked: readonly string[],
): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const entry of blocked) {
    const norm = normalize(entry);
    if (norm.length > 0 && !seen.has(norm)) {
      seen.add(norm);
      out.push(norm);
    }
  }
  return out;
};

/**
 * Comprueba si un sticker cae en la blocklist. Coincide por `setName` (tiene
 * prioridad) o por `fileUniqueId`, comparando normalizado contra la lista. Los
 * campos vacios o solo-espacios nunca coinciden. Devuelve una union plana con
 * `reason` presente solo cuando `blocked` es true. Pura y determinista.
 */
export const matchStickerBlocklist = (
  sticker: StickerRef,
  blocked: readonly string[],
): StickerBlocklistMatch => {
  const set = new Set(normalizeStickerBlocklist(blocked));
  if (set.size === 0) {
    return { blocked: false };
  }

  const setName = sticker.setName;
  if (setName !== undefined && set.has(normalize(setName))) {
    return {
      blocked: true,
      reason: `Pack de stickers bloqueado: ${setName}`,
    };
  }

  const fileUniqueId = sticker.fileUniqueId;
  if (fileUniqueId !== undefined && set.has(normalize(fileUniqueId))) {
    return { blocked: true, reason: "Sticker bloqueado" };
  }

  return { blocked: false };
};
