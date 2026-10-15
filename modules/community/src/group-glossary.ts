import type { TelegramUpdateEnvelope } from "@superbot/domain";

/**
 * Diccionario interno del grupo: palabras, bromas o siglas que el bot entiende
 * y puede explicar. Modulo de logica pura: normaliza terminos, detecta cuales
 * aparecen en un texto y parsea el comando de gestion. Sin I/O ni estado; todo
 * entra por parametros planos y las salidas son deterministas.
 */

export interface GlossaryMatch {
  readonly term: string;
  readonly meaning: string;
}

export type GlossaryCommand =
  | { readonly kind: "set"; readonly term: string; readonly meaning: string }
  | { readonly kind: "remove"; readonly term: string }
  | { readonly kind: "list" };

export type GlossaryCommandErrorCode =
  | "invalid-subcommand"
  | "missing-term"
  | "missing-meaning";

export interface GlossaryCommandError {
  readonly code: GlossaryCommandErrorCode;
  readonly usage: string;
}

export type GlossaryCommandResult =
  | { readonly ok: true; readonly command: GlossaryCommand }
  | { readonly ok: false; readonly error: GlossaryCommandError };

/**
 * Forma canonica de un termino del glosario: sin diacriticos, en minusculas,
 * recortado y con los espacios internos colapsados a uno solo. Se aplica tanto
 * a las claves del glosario como al texto a analizar, de modo que la deteccion
 * ignore mayusculas y acentos. Pura y determinista.
 */
export const normalizeGlossaryTerm = (s: string): string =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");

const escapeRegExp = (s: string): string =>
  s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Indice de la primera aparicion de `needle` como palabra completa dentro de
 * `haystack` (ambos ya normalizados), o -1 si no aparece. Los limites son
 * cualquier caracter que no sea letra ni numero, de modo que "gg" case en
 * "hola, gg!" pero no dentro de "eggs". Pura.
 */
const wholeWordIndex = (haystack: string, needle: string): number => {
  const re = new RegExp(
    `(?<![\\p{L}\\p{N}])${escapeRegExp(needle)}(?![\\p{L}\\p{N}])`,
    "u",
  );
  const match = re.exec(haystack);
  return match ? match.index : -1;
};

/**
 * Devuelve los terminos del glosario que se mencionan en el texto, sin
 * duplicar y en orden de aparicion (por la posicion de su primera coincidencia
 * como palabra completa). Cada resultado conserva la clave original del
 * glosario y su significado. La comparacion ignora mayusculas y acentos. Un
 * texto vacio o sin coincidencias devuelve un arreglo vacio. Pura y
 * determinista.
 */
export const lookupGlossary = (
  text: string,
  glossary: Readonly<Record<string, string>>,
): readonly GlossaryMatch[] => {
  const normalizedText = normalizeGlossaryTerm(text);

  if (!normalizedText) {
    return [];
  }

  const found: {
    readonly term: string;
    readonly meaning: string;
    readonly index: number;
  }[] = [];
  const seen = new Set<string>();

  for (const [key, meaning] of Object.entries(glossary)) {
    const normalizedTerm = normalizeGlossaryTerm(key);

    if (!normalizedTerm || seen.has(normalizedTerm)) {
      continue;
    }

    const index = wholeWordIndex(normalizedText, normalizedTerm);
    if (index >= 0) {
      seen.add(normalizedTerm);
      found.push({ term: key, meaning, index });
    }
  }

  return found
    .slice()
    .sort((a, b) => a.index - b.index)
    .map((entry) => ({ term: entry.term, meaning: entry.meaning }));
};

const SET_USAGE = "Uso: /glosario set <término> <significado>";
const REMOVE_USAGE = "Uso: /glosario remove <término>";
const GENERAL_USAGE = "Uso: /glosario set|remove|list";

/**
 * Parsea `/glosario set|remove|list`. El termino es un unico token (se
 * normaliza con normalizeGlossaryTerm) y, en `set`, el significado es el resto
 * de los argumentos unidos por espacios. Devuelve una union discriminada
 * ok/error, o null cuando el update no trae el comando `/glosario`. Pura y
 * determinista.
 */
export const parseGlossaryCommand = (
  update: TelegramUpdateEnvelope,
): GlossaryCommandResult | null => {
  if (update.command?.name !== "glosario") {
    return null;
  }

  const args = update.command?.args ?? [];
  const sub = (args[0] ?? "").toLowerCase();

  if (sub === "list") {
    return { ok: true, command: { kind: "list" } };
  }

  if (sub === "set") {
    const term = normalizeGlossaryTerm(args[1] ?? "");
    const meaning = args.slice(2).join(" ").trim();

    if (!term) {
      return { ok: false, error: { code: "missing-term", usage: SET_USAGE } };
    }
    if (!meaning) {
      return {
        ok: false,
        error: { code: "missing-meaning", usage: SET_USAGE },
      };
    }

    return { ok: true, command: { kind: "set", term, meaning } };
  }

  if (sub === "remove") {
    const term = normalizeGlossaryTerm(args[1] ?? "");

    if (!term) {
      return {
        ok: false,
        error: { code: "missing-term", usage: REMOVE_USAGE },
      };
    }

    return { ok: true, command: { kind: "remove", term } };
  }

  return {
    ok: false,
    error: { code: "invalid-subcommand", usage: GENERAL_USAGE },
  };
};
