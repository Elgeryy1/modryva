/**
 * Codec de deep-links compactos por caso, usuario o grupo. Produce payloads del
 * tipo `c_<id>` / `u_<id>` / `g_<id>`, seguros para el parametro `startapp` de
 * Telegram (solo A-Z a-z 0-9 _ -). Logica pura y determinista: ida y vuelta
 * estable para cualquier id valido. Sin I/O ni estado.
 */

/** Tipo de destino al que apunta un deep-link. */
export type DeepLinkKind = "case" | "user" | "group";

/** Destino decodificado o a codificar. */
export interface DeepLinkTarget {
  readonly kind: DeepLinkKind;
  readonly id: string;
}

/**
 * Un id es seguro para `startapp` cuando solo usa el alfabeto permitido por
 * Telegram (A-Z a-z 0-9 _ -) y no esta vacio. Los ids de grupo pueden empezar
 * por `-` (grupos negativos), cubierto por el guion.
 */
const DEEP_LINK_ID_RE = /^[A-Za-z0-9_-]+$/;

/** Prefijo de una sola letra usado en el payload por cada tipo de destino. */
const KIND_TO_PREFIX: Readonly<Record<DeepLinkKind, string>> = {
  case: "c",
  user: "u",
  group: "g",
};

/** Inverso de {@link KIND_TO_PREFIX}, para decodificar la letra inicial. */
const PREFIX_TO_KIND: Readonly<Record<string, DeepLinkKind>> = {
  c: "case",
  u: "user",
  g: "group",
};

/**
 * True cuando `id` es seguro para incrustar en un payload de `startapp` y
 * sobrevive un ciclo encode/decode sin cambios. Pura y determinista.
 */
export const isSafeDeepLinkId = (id: string): boolean =>
  DEEP_LINK_ID_RE.test(id);

/**
 * Codifica un destino en un payload compacto `<prefijo>_<id>`. Devuelve la
 * cadena tal cual; si el id no es seguro para `startapp` el resultado no
 * sobrevivira una decodificacion (usa {@link isSafeDeepLinkId} para validar
 * antes). Pura y determinista.
 */
export const encodeDeepLink = (target: DeepLinkTarget): string => {
  const prefix = KIND_TO_PREFIX[target.kind];
  return `${prefix}_${target.id}`;
};

/**
 * Decodifica un payload `<prefijo>_<id>` a su destino. Devuelve null cuando el
 * payload esta vacio, no lleva prefijo conocido, no tiene el separador `_`, el
 * id esta vacio o el id contiene caracteres no seguros para `startapp`. Pura y
 * determinista; inversa exacta de {@link encodeDeepLink} para ids seguros.
 */
export const decodeDeepLink = (payload: string): DeepLinkTarget | null => {
  if (payload.length < 3) {
    return null;
  }

  const prefixChar = payload.charAt(0);
  const separator = payload.charAt(1);
  if (separator !== "_") {
    return null;
  }

  const kind = PREFIX_TO_KIND[prefixChar];
  if (kind === undefined) {
    return null;
  }

  const id = payload.slice(2);
  if (!isSafeDeepLinkId(id)) {
    return null;
  }

  return { kind, id };
};
