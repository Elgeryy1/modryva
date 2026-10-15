/**
 * `/pole …` parsing.
 *
 * Bare `/pole` is the claim — the thing people type every morning — so it must
 * never be shadowed by a subcommand. Everything else is a read-only report.
 *
 * Accent-insensitive on purpose: nobody types "récords" or "año" on a phone
 * with any consistency, and refusing "records" would make the bot feel broken
 * for a reason the user cannot see.
 */

export type PoleRankingPeriod = "day" | "month" | "year" | "all";

export type PoleCommand =
  | { readonly kind: "claim" }
  | { readonly kind: "today" }
  | { readonly kind: "ranking"; readonly period: PoleRankingPeriod }
  | { readonly kind: "streak" }
  | { readonly kind: "records" }
  | { readonly kind: "config" }
  | { readonly kind: "help" };

/** The command names that reach this parser. Aliases can be switched off. */
export const POLE_COMMAND = "pole";
export const POLE_ALIASES = ["p", "poles"] as const;

/**
 * Strips diacritics and lowercases, so "AÑO", "año" and "ano" all match.
 *
 * NFD splits a letter from its accent, then the combining marks are dropped.
 */
const fold = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLowerCase()
    .trim();

const PERIODS: Record<string, PoleRankingPeriod> = {
  hoy: "day",
  dia: "day",
  diario: "day",
  mes: "month",
  mensual: "month",
  ano: "year",
  anual: "year",
  historico: "all",
  total: "all",
  siempre: "all",
};

/**
 * Parses the argument list of a `/pole` command.
 *
 * Returns `help` for an unrecognised subcommand rather than silently claiming
 * the pole: typing `/pole raking` must not spend the user's one claim of the
 * day on a typo.
 */
export const parsePoleArgs = (args: readonly string[]): PoleCommand => {
  const sub = fold(args[0] ?? "");

  if (sub.length === 0) {
    return { kind: "claim" };
  }

  switch (sub) {
    case "hoy":
    case "today":
      return { kind: "today" };
    case "ranking":
    case "clasificacion":
    case "top": {
      const period = PERIODS[fold(args[1] ?? "")] ?? "all";
      return { kind: "ranking", period };
    }
    case "racha":
    case "rachas":
    case "streak":
      return { kind: "streak" };
    case "records":
    case "record":
      return { kind: "records" };
    case "config":
    case "ajustes":
      return { kind: "config" };
    default:
      return { kind: "help" };
  }
};

export const POLE_USAGE = [
  "Uso de /pole:",
  "/pole — reclama tu puesto del día",
  "/pole hoy — el podio de hoy",
  "/pole ranking [mes|año|histórico] — clasificación",
  "/pole racha — tu racha actual",
  "/pole récords — el más rápido y la mejor racha",
  "/pole config — dónde se configura",
].join("\n");

export const periodLabel = (period: PoleRankingPeriod): string => {
  switch (period) {
    case "day":
      return "hoy";
    case "month":
      return "este mes";
    case "year":
      return "este año";
    default:
      return "histórico";
  }
};
