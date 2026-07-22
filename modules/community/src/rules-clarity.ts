/**
 * Puntua la claridad del reglamento de un grupo (0..100) y detecta lineas de
 * regla ambiguas. Logica pura y determinista: recibe el texto plano del
 * reglamento y devuelve una puntuacion mas la lista de problemas detectados.
 * No hace I/O, red, Prisma ni usa Date.now()/Math.random().
 *
 * Heuristicas penalizadas:
 *  - reglas demasiado largas (dificiles de leer),
 *  - reglas ambiguas ("no", "quizas", "depende", "tal vez"...),
 *  - reglamento sin numerar,
 *  - reglas contradictorias (mismo tema permitido en una y prohibido en otra).
 */

export interface RulesClarityResult {
  readonly score: number;
  readonly issues: readonly string[];
}

/** Longitud (en caracteres) a partir de la cual una regla se considera larga. */
const MAX_RULE_LENGTH = 160;

/** Penalizaciones por tipo de problema. */
const PENALTY_LONG = 8;
const PENALTY_AMBIGUOUS = 12;
const PENALTY_UNNUMBERED = 15;
const PENALTY_CONTRADICTION = 20;

/** Longitud minima de un token para considerarlo "tema" de una regla. */
const TOPIC_MIN_LENGTH = 5;

/**
 * Marcadores de ambiguedad (ya sin acentos y en minusculas). Los que contienen
 * espacio se buscan como subcadena; el resto como palabra completa.
 */
const AMBIGUOUS_MARKERS: readonly string[] = [
  "no",
  "quizas",
  "quiza",
  "tal vez",
  "talvez",
  "depende",
  "puede",
  "a veces",
  "posiblemente",
  "posible",
  "segun",
  "capaz",
  "creo",
  "supongo",
  "mas o menos",
  "etc",
];

/** Marcadores de polaridad para detectar contradicciones entre reglas. */
const POSITIVE_MARKERS: readonly string[] = [
  "permitido",
  "permitida",
  "permitidos",
  "permitidas",
  "permite",
  "obligatorio",
  "obligatoria",
  "permitir",
];
const NEGATIVE_MARKERS: readonly string[] = [
  "prohibido",
  "prohibida",
  "prohibidos",
  "prohibidas",
  "prohibe",
  "prohibir",
  "vetado",
  "baneado",
];

/**
 * Normaliza un texto: minusculas y sin diacriticos, para que "quizas" y
 * "quizás" (o "según"/"segun") se traten igual. Pura y determinista.
 */
const normalize = (text: string): string =>
  text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** True si la palabra completa `word` aparece en el texto normalizado. */
const hasWord = (normalized: string, word: string): boolean => {
  const pattern = new RegExp(`(^|[^a-z0-9])${word}([^a-z0-9]|$)`, "u");
  return pattern.test(normalized);
};

/** True si alguno de los marcadores aparece en el texto normalizado. */
const hasAnyMarker = (
  normalized: string,
  markers: readonly string[],
): boolean => {
  for (const marker of markers) {
    if (marker.includes(" ")) {
      if (normalized.includes(marker)) {
        return true;
      }
    } else if (hasWord(normalized, marker)) {
      return true;
    }
  }
  return false;
};

/**
 * Divide el reglamento en lineas de regla no vacias (ya recortadas). Ignora
 * lineas en blanco. Pura y determinista.
 */
const splitRules = (rulesText: string): readonly string[] => {
  const lines: string[] = [];
  for (const raw of rulesText.split(/\r?\n/)) {
    const trimmed = raw.trim();
    if (trimmed.length > 0) {
      lines.push(trimmed);
    }
  }
  return lines;
};

/** True si la linea empieza por una numeracion tipo "1.", "2)" o "3-". */
const isNumbered = (line: string): boolean => /^\s*\d+[.)-]/.test(line);

/**
 * Extrae los tokens "tema" de una regla: palabras normalizadas de longitud
 * suficiente, excluyendo los marcadores de polaridad. Pura y determinista.
 */
const topicTokens = (normalized: string): readonly string[] => {
  const excluded = new Set<string>([...POSITIVE_MARKERS, ...NEGATIVE_MARKERS]);
  const tokens: string[] = [];
  for (const token of normalized.split(/[^a-z0-9]+/)) {
    if (token.length >= TOPIC_MIN_LENGTH && !excluded.has(token)) {
      tokens.push(token);
    }
  }
  return tokens;
};

/**
 * True si la linea de regla contiene marcadores de ambiguedad como "no",
 * "quizas", "depende", "tal vez", "a veces", "segun"... Insensible a acentos y
 * mayusculas. Pura y determinista.
 */
export const detectAmbiguousRule = (line: string): boolean =>
  hasAnyMarker(normalize(line), AMBIGUOUS_MARKERS);

/**
 * Detecta pares de reglas contradictorias: comparten un token "tema" pero una
 * lo permite y otra lo prohibe. Devuelve los temas en conflicto sin duplicar,
 * en orden de aparicion. Pura y determinista.
 */
const findContradictions = (
  rules: readonly { readonly normalized: string }[],
): readonly string[] => {
  const conflicts: string[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < rules.length; i += 1) {
    const a = rules[i];
    if (!a) {
      continue;
    }
    const aPositive = hasAnyMarker(a.normalized, POSITIVE_MARKERS);
    const aNegative = hasAnyMarker(a.normalized, NEGATIVE_MARKERS);
    if (!aPositive && !aNegative) {
      continue;
    }
    const aTopics = new Set(topicTokens(a.normalized));

    for (let j = i + 1; j < rules.length; j += 1) {
      const b = rules[j];
      if (!b) {
        continue;
      }
      const bPositive = hasAnyMarker(b.normalized, POSITIVE_MARKERS);
      const bNegative = hasAnyMarker(b.normalized, NEGATIVE_MARKERS);
      const opposite = (aPositive && bNegative) || (aNegative && bPositive);
      if (!opposite) {
        continue;
      }
      // Solo el primer tema compartido por par evita contar dos veces
      // palabras genericas ("estan"...) presentes en ambas reglas.
      for (const topic of topicTokens(b.normalized)) {
        if (aTopics.has(topic)) {
          if (!seen.has(topic)) {
            seen.add(topic);
            conflicts.push(topic);
          }
          break;
        }
      }
    }
  }

  return conflicts;
};

/**
 * Puntua la claridad del reglamento en 0..100 (100 = perfecto) y devuelve la
 * lista de problemas detectados en orden estable. Penaliza reglas largas,
 * ambiguas, sin numerar y contradictorias. Pura y determinista.
 */
export const scoreRulesClarity = (rulesText: string): RulesClarityResult => {
  const rules = splitRules(rulesText);

  if (rules.length === 0) {
    return { score: 0, issues: ["Sin reglas definidas"] };
  }

  const issues: string[] = [];
  let penalty = 0;

  const longCount = rules.filter((r) => r.length > MAX_RULE_LENGTH).length;
  if (longCount > 0) {
    penalty += longCount * PENALTY_LONG;
    issues.push(
      `${longCount} regla(s) demasiado largas (mas de ${MAX_RULE_LENGTH} caracteres)`,
    );
  }

  const ambiguousCount = rules.filter((r) => detectAmbiguousRule(r)).length;
  if (ambiguousCount > 0) {
    penalty += ambiguousCount * PENALTY_AMBIGUOUS;
    issues.push(
      `${ambiguousCount} regla(s) ambiguas (no, quizas, depende, tal vez...)`,
    );
  }

  if (rules.length >= 2) {
    const numbered = rules.filter((r) => isNumbered(r)).length;
    if (numbered * 2 < rules.length) {
      penalty += PENALTY_UNNUMBERED;
      issues.push("Las reglas no estan numeradas");
    }
  }

  const normalizedRules = rules.map((r) => ({ normalized: normalize(r) }));
  const contradictions = findContradictions(normalizedRules);
  for (const topic of contradictions) {
    penalty += PENALTY_CONTRADICTION;
    issues.push(`Posible contradiccion sobre "${topic}" entre reglas`);
  }

  const score = Math.max(0, Math.min(100, 100 - penalty));

  return { score, issues };
};
