/**
 * Detector de duplicados de soporte: cuando mucha gente reporta el mismo
 * incidente, agrupa los reportes que comparten suficientes palabras clave
 * normalizadas. Logica pura y determinista: sin I/O, sin red, sin reloj ni
 * aleatoriedad; solo recibe textos planos y umbrales.
 */

const DIACRITICS = /\p{Diacritic}/gu;
const NON_KEYWORD = /[^a-z0-9\s]/g;
const WHITESPACE = /\s+/;

/**
 * Palabras vacias (stopwords) espanolas frecuentes en reportes de soporte que
 * no aportan senal para detectar duplicados. Se descartan al extraer las
 * palabras clave.
 */
const STOPWORDS: ReadonlySet<string> = new Set([
  "el",
  "la",
  "los",
  "las",
  "un",
  "una",
  "unos",
  "unas",
  "de",
  "del",
  "al",
  "a",
  "y",
  "o",
  "u",
  "e",
  "en",
  "con",
  "por",
  "para",
  "que",
  "se",
  "su",
  "sus",
  "lo",
  "le",
  "me",
  "mi",
  "te",
  "es",
  "no",
  "si",
  "ya",
  "muy",
  "mas",
  "pero",
  "como",
  "esta",
  "este",
  "esto",
  "estan",
  "hay",
  "me",
]);

/** Longitud minima (tras normalizar) para considerar una palabra como clave. */
const MIN_KEYWORD_LENGTH = 3;

/**
 * Normaliza un texto de incidente: pasa a minusculas, quita acentos y
 * diacriticos, elimina puntuacion y simbolos, y colapsa los espacios en uno
 * solo, recortando los extremos. Pura y determinista.
 */
export const normalizeIncidentText = (s: string): string =>
  s
    .normalize("NFD")
    .replace(DIACRITICS, "")
    .toLowerCase()
    .replace(NON_KEYWORD, " ")
    .trim()
    .split(WHITESPACE)
    .filter((token) => token.length > 0)
    .join(" ");

/**
 * Extrae el conjunto ordenado (sin duplicados, en orden de primera aparicion)
 * de palabras clave normalizadas de un texto: descarta stopwords y palabras
 * mas cortas que `MIN_KEYWORD_LENGTH`. Pura y determinista.
 */
export const incidentKeywords = (s: string): readonly string[] => {
  const normalized = normalizeIncidentText(s);
  if (normalized.length === 0) {
    return [];
  }

  const seen = new Set<string>();
  const keywords: string[] = [];
  for (const token of normalized.split(WHITESPACE)) {
    if (token.length < MIN_KEYWORD_LENGTH || STOPWORDS.has(token)) {
      continue;
    }
    if (!seen.has(token)) {
      seen.add(token);
      keywords.push(token);
    }
  }
  return keywords;
};

/**
 * Cuenta cuantas palabras clave normalizadas comparten dos textos (interseccion
 * de sus conjuntos de palabras clave). Pura y determinista.
 */
export const countSharedKeywords = (a: string, b: string): number => {
  const setA = new Set(incidentKeywords(a));
  if (setA.size === 0) {
    return 0;
  }
  let shared = 0;
  for (const keyword of incidentKeywords(b)) {
    if (setA.has(keyword)) {
      shared += 1;
    }
  }
  return shared;
};

/**
 * True cuando dos textos son probablemente el mismo incidente: comparten al
 * menos `minShared` palabras clave normalizadas. Con `minShared <= 0` siempre
 * es false (no tendria sentido marcar todo como duplicado). Pura y
 * determinista.
 */
export const isLikelyDuplicate = (
  a: string,
  b: string,
  minShared: number,
): boolean => {
  if (minShared <= 0) {
    return false;
  }
  return countSharedKeywords(a, b) >= minShared;
};

/**
 * Agrupa los indices de `texts` que forman el mismo incidente: dos textos van
 * al mismo grupo cuando comparten `>= minShared` palabras clave, y la relacion
 * es transitiva (si A~B y B~C, los tres caen juntos). Cada indice aparece
 * exactamente una vez; los textos sin coincidencias quedan como grupo unitario.
 * Los grupos y los indices dentro de cada grupo preservan el orden original.
 * Con `minShared <= 0` cada texto queda en su propio grupo. Pura y
 * determinista.
 */
export const groupSimilarIncidents = (
  texts: readonly string[],
  minShared: number,
): readonly (readonly number[])[] => {
  const count = texts.length;
  if (count === 0) {
    return [];
  }

  // Union-Find sobre los indices; parent[i] es el representante de i.
  const parent: number[] = Array.from({ length: count }, (_, i) => i);

  const find = (node: number): number => {
    let root = node;
    while ((parent[root] ?? root) !== root) {
      root = parent[root] ?? root;
    }
    // Compresion de caminos para mantener las busquedas planas.
    let current = node;
    while (current !== root) {
      const next = parent[current] ?? current;
      parent[current] = root;
      current = next;
    }
    return root;
  };

  const union = (a: number, b: number): void => {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA === rootB) {
      return;
    }
    // El representante menor gana, para que el orden de salida sea estable.
    if (rootA < rootB) {
      parent[rootB] = rootA;
    } else {
      parent[rootA] = rootB;
    }
  };

  if (minShared > 0) {
    // Cache de palabras clave por indice para no re-normalizar en cada par.
    const keywordSets: ReadonlySet<string>[] = texts.map(
      (text) => new Set(incidentKeywords(text)),
    );

    for (let i = 0; i < count; i += 1) {
      const setI = keywordSets[i] ?? new Set<string>();
      if (setI.size === 0) {
        continue;
      }
      for (let j = i + 1; j < count; j += 1) {
        const setJ = keywordSets[j] ?? new Set<string>();
        if (setJ.size === 0) {
          continue;
        }
        let shared = 0;
        for (const keyword of setJ) {
          if (setI.has(keyword)) {
            shared += 1;
            if (shared >= minShared) {
              break;
            }
          }
        }
        if (shared >= minShared) {
          union(i, j);
        }
      }
    }
  }

  // Reconstruye los grupos preservando el orden de primera aparicion.
  const groupsByRoot = new Map<number, number[]>();
  const order: number[] = [];
  for (let i = 0; i < count; i += 1) {
    const root = find(i);
    const existing = groupsByRoot.get(root);
    if (existing === undefined) {
      groupsByRoot.set(root, [i]);
      order.push(root);
    } else {
      existing.push(i);
    }
  }

  return order.map((root) => groupsByRoot.get(root) ?? []);
};
