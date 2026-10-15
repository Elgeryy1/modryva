/**
 * Cuarentena de acortadores y dominios recien vistos. Un acortador conocido o un
 * dominio que el grupo no habia visto antes se pone en cuarentena hasta revision
 * humana; el resto se permite. Logica pura, sin I/O ni estado: recibe el dominio
 * y un flag `seenBefore` calculado por el llamador. Determinista.
 */

/** Accion resuelta para un dominio: permitir o poner en cuarentena. */
export type ShortenerAction = "allow" | "quarantine";

/** Resultado de clasificar un dominio: accion + motivo user-facing. */
export interface ShortenerClassification {
  readonly action: ShortenerAction;
  readonly reason: string;
}

/**
 * Detector para el motor de senales: forma { key, weight, present, detail? }.
 * No importa signals.ts a proposito.
 */
export interface ShortenerSignal {
  readonly key: string;
  readonly weight: number;
  readonly present: boolean;
  readonly detail?: string;
}

/**
 * Acortadores de enlaces conocidos. Un dominio que coincide (o es subdominio de
 * uno de estos) siempre entra en cuarentena, aunque ya se hubiera visto antes,
 * porque el destino real queda oculto tras la redireccion.
 */
export const KNOWN_SHORTENERS: ReadonlySet<string> = new Set([
  "bit.ly",
  "tinyurl.com",
  "cutt.ly",
  "t.co",
  "goo.gl",
  "is.gd",
  "ow.ly",
  "rebrand.ly",
]);

/** Peso por defecto del detector de cuarentena en el motor de senales. */
export const SHORTENER_SIGNAL_WEIGHT = 3;

const SHORTENER_SIGNAL_KEY = "shortener_quarantine";

/**
 * Normaliza un dominio para comparar: recorta espacios, pasa a minusculas y
 * elimina el prefijo `www.` y los puntos finales. No valida el formato.
 */
export const normalizeDomain = (domain: string): string => {
  let value = domain.trim().toLowerCase();
  while (value.startsWith("www.")) {
    value = value.slice(4);
  }
  while (value.endsWith(".")) {
    value = value.slice(0, -1);
  }
  return value;
};

/**
 * True cuando el dominio normalizado es un acortador conocido o un subdominio de
 * uno (p. ej. `links.bit.ly`). Pura y determinista.
 */
export const isKnownShortener = (domain: string): boolean => {
  const value = normalizeDomain(domain);
  if (value.length === 0) {
    return false;
  }
  if (KNOWN_SHORTENERS.has(value)) {
    return true;
  }
  for (const shortener of KNOWN_SHORTENERS) {
    if (value.endsWith(`.${shortener}`)) {
      return true;
    }
  }
  return false;
};

/**
 * Clasifica un dominio. Un dominio vacio, un acortador conocido o un dominio no
 * visto antes (`seenBefore === false`) entran en cuarentena hasta revision; un
 * dominio ya visto y que no es acortador se permite. Pura y determinista.
 */
export const classifyDomain = (
  domain: string,
  seenBefore: boolean,
): ShortenerClassification => {
  const value = normalizeDomain(domain);

  if (value.length === 0) {
    return {
      action: "quarantine",
      reason: "Dominio vacío o ilegible: en cuarentena hasta revisión.",
    };
  }

  if (isKnownShortener(value)) {
    return {
      action: "quarantine",
      reason: "Acortador de enlaces: en cuarentena hasta revisión.",
    };
  }

  if (!seenBefore) {
    return {
      action: "quarantine",
      reason: "Dominio nuevo nunca visto: en cuarentena hasta revisión.",
    };
  }

  return {
    action: "allow",
    reason: "Dominio conocido y ya revisado.",
  };
};

/**
 * Construye la senal del detector para el motor de senales. `present` es true
 * cuando la clasificacion resulta en cuarentena; `detail` lleva el motivo solo
 * cuando esta presente (opcional bajo exactOptionalPropertyTypes). Determinista.
 */
export const buildShortenerSignal = (
  domain: string,
  seenBefore: boolean,
): ShortenerSignal => {
  const classification = classifyDomain(domain, seenBefore);
  const present = classification.action === "quarantine";
  return {
    key: SHORTENER_SIGNAL_KEY,
    weight: SHORTENER_SIGNAL_WEIGHT,
    present,
    ...(present ? { detail: classification.reason } : {}),
  };
};
