import type { TelegramUpdateEnvelope } from "@superbot/domain";

/**
 * Roles por intereses: los miembros eligen etiquetas de interes (p.ej.
 * "futbol", "react", "cine") y el bot los empareja con otros que comparten
 * gustos. Este modulo es logica pura: normaliza etiquetas, parsea el comando
 * /intereses y calcula la compatibilidad por tags comunes. Sin I/O ni estado.
 */

const DIACRITICS = /[̀-ͯ]/g;
const NON_TAG_CHARS = /[^a-z0-9]+/g;
const EDGE_HYPHENS = /^-+|-+$/g;

/**
 * Normaliza una etiqueta de interes: minusculas, sin diacriticos, y con los
 * separadores (espacios, puntuacion, guiones bajos) colapsados en un unico
 * guion. Los guiones de los extremos se recortan. Ejemplos: "Futbol Sala" ->
 * "futbol-sala", "  React.js " -> "react-js". Devuelve "" si no queda nada
 * util. Puro y determinista.
 */
export const normalizeInterestTag = (s: string): string =>
  s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(DIACRITICS, "")
    .replace(NON_TAG_CHARS, "-")
    .replace(EDGE_HYPHENS, "");

export type InterestCommand =
  | { readonly kind: "add"; readonly tag: string }
  | { readonly kind: "remove"; readonly tag: string }
  | { readonly kind: "list" };

export type InterestCommandErrorCode = "usage" | "empty-tag";

export interface InterestCommandError {
  readonly code: InterestCommandErrorCode;
  readonly message: string;
}

export type InterestCommandResult =
  | { readonly ok: true; readonly command: InterestCommand }
  | { readonly ok: false; readonly error: InterestCommandError };

const INTEREST_COMMAND_NAME = "intereses";
const USAGE = "Uso: /intereses add <interes> | remove <interes> | list";

/**
 * Parsea `/intereses add|remove|list`. `add`/`remove` requieren una etiqueta
 * (todos los args restantes se unen y se normalizan); `list` no lleva args.
 * Devuelve `{ ok: false }` cuando el subcomando es invalido o falta la
 * etiqueta, y `null` cuando el update no trae el comando /intereses. Puro y
 * determinista.
 */
export const parseInterestCommand = (
  update: TelegramUpdateEnvelope,
): InterestCommandResult | null => {
  if (update.command?.name !== INTEREST_COMMAND_NAME) {
    return null;
  }

  const args = update.command?.args ?? [];
  const sub = (args[0] ?? "").toLowerCase();

  if (sub === "list") {
    return { ok: true, command: { kind: "list" } };
  }

  if (sub !== "add" && sub !== "remove") {
    return { ok: false, error: { code: "usage", message: USAGE } };
  }

  const tag = normalizeInterestTag(args.slice(1).join(" "));

  if (tag.length === 0) {
    return {
      ok: false,
      error: {
        code: "empty-tag",
        message: "Indica un interés válido, p. ej. /intereses add futbol",
      },
    };
  }

  return { ok: true, command: { kind: sub, tag } };
};

/** Un candidato con la cantidad de intereses compartidos con el usuario. */
export interface InterestMatch {
  readonly userId: string;
  readonly shared: number;
}

const toTagSet = (tags: readonly string[]): ReadonlySet<string> => {
  const set = new Set<string>();
  for (const raw of tags) {
    const tag = normalizeInterestTag(raw);
    if (tag.length > 0) {
      set.add(tag);
    }
  }
  return set;
};

/**
 * Calcula la compatibilidad por intereses: para cada candidato cuenta cuantas
 * etiquetas (ya normalizadas y deduplicadas) comparte con `userTags`. Solo se
 * incluyen candidatos con al menos un interes en comun, ordenados de mayor a
 * menor coincidencia; los empates conservan el orden de entrada. Puro y
 * determinista.
 */
export const matchByInterest = (
  userTags: readonly string[],
  others: readonly {
    readonly userId: string;
    readonly tags: readonly string[];
  }[],
): readonly InterestMatch[] => {
  const mine = toTagSet(userTags);

  const matches: InterestMatch[] = [];

  if (mine.size === 0) {
    return matches;
  }

  for (const other of others) {
    let shared = 0;
    for (const tag of toTagSet(other.tags)) {
      if (mine.has(tag)) {
        shared += 1;
      }
    }
    if (shared > 0) {
      matches.push({ userId: other.userId, shared });
    }
  }

  return matches.sort((a, b) => b.shared - a.shared);
};
