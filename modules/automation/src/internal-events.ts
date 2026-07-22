/**
 * Catalogo de eventos internos del superbot: la base estructural sobre la que
 * se construiran integraciones y plugins de terceros. Todo aqui es logica pura
 * y determinista: no se emiten eventos ni se tocan red/reloj; el modulo solo
 * describe, construye, serializa y firma eventos a partir de inputs planos.
 *
 * La firma se delega a un hasher inyectado (por ejemplo un HMAC-SHA256 del
 * servicio) para no depender de `crypto` y mantener la pureza del modulo.
 */

/**
 * Tipos de evento interno soportados y documentados. El orden es estable y
 * forma el contrato publico que los plugins pueden consumir.
 */
export const INTERNAL_EVENT_TYPES = [
  "user_joined",
  "case_created",
  "rule_triggered",
  "sanction_applied",
  "appeal_opened",
  "member_left",
] as const;

/** Union de los tipos de evento interno conocidos. */
export type InternalEventType = (typeof INTERNAL_EVENT_TYPES)[number];

/**
 * Un evento interno ya materializado. `payload` es un objeto plano de datos
 * (sin funciones ni instancias) y `ts` es el timestamp epoch en ms que el
 * llamante provee para mantener el determinismo.
 */
export interface InternalEvent {
  readonly type: string;
  readonly payload: Record<string, unknown>;
  readonly ts: number;
}

/** True si `type` es uno de los tipos de evento interno documentados. */
export const isInternalEventType = (type: string): type is InternalEventType =>
  (INTERNAL_EVENT_TYPES as readonly string[]).includes(type);

/**
 * Resultado discriminado de validar/construir un evento interno.
 */
export type InternalEventResult =
  | { readonly ok: true; readonly event: InternalEvent }
  | { readonly ok: false; readonly error: InternalEventError };

/** Motivos por los que un evento interno no puede construirse. */
export type InternalEventError =
  | { readonly code: "unknown-type"; readonly message: string }
  | { readonly code: "invalid-timestamp"; readonly message: string };

/**
 * Construye un evento interno a partir de sus partes. Falla (ok:false) cuando
 * el tipo no esta en el catalogo o cuando `ts` no es un entero finito >= 0.
 * El payload se copia superficialmente para que el evento no comparta la
 * referencia mutable del llamante. Pura y determinista.
 */
export const buildInternalEvent = (
  type: string,
  payload: Record<string, unknown>,
  ts: number,
): InternalEventResult => {
  if (!isInternalEventType(type)) {
    return {
      ok: false,
      error: {
        code: "unknown-type",
        message: `Tipo de evento desconocido: ${type}`,
      },
    };
  }

  if (!Number.isInteger(ts) || ts < 0) {
    return {
      ok: false,
      error: {
        code: "invalid-timestamp",
        message: `Timestamp invalido: ${ts}`,
      },
    };
  }

  return {
    ok: true,
    event: { type, payload: { ...payload }, ts },
  };
};

/**
 * Ordena recursivamente las claves de un valor para producir una forma
 * canonica y estable antes de serializar. Los arrays conservan su orden; los
 * objetos planos se reordenan alfabeticamente por clave. Pura.
 */
const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value !== null && typeof value === "object") {
    const source = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) {
      sorted[key] = canonicalize(source[key]);
    }
    return sorted;
  }
  return value;
};

/**
 * Serializa un evento interno como JSON estable: las claves (incluidas las
 * anidadas en el payload) se ordenan alfabeticamente para que dos eventos
 * equivalentes produzcan siempre la misma cadena, condicion necesaria para
 * firmar de forma reproducible. Pura y determinista.
 */
export const serializeInternalEvent = (event: InternalEvent): string =>
  JSON.stringify(
    canonicalize({
      payload: event.payload,
      ts: event.ts,
      type: event.type,
    }),
  );

/**
 * Firma una representacion ya serializada delegando en un hasher inyectado
 * (por ejemplo un HMAC-SHA256 del servicio). El modulo no usa `crypto`: recibe
 * la funcion `hasher(data, secret) => firma` y devuelve su resultado sin
 * transformarlo. Pura respecto a este modulo (determinista si el hasher lo es).
 */
export const signInternalEvent = (
  serialized: string,
  secret: string,
  hasher: (data: string, secret: string) => string,
): string => hasher(serialized, secret);
