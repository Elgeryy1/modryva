/**
 * `/ruleta …` parsing.
 *
 * Bare `/ruleta` spins. Note what is NOT parseable: a target. The report is
 * explicit that the default must act on whoever ran the command (§6.2), and the
 * simplest way to guarantee that is to give the parser no way to express
 * "someone else" — a rule nobody can forget to enforce downstream.
 */

export type RouletteCommand =
  | { readonly kind: "spin" }
  | { readonly kind: "status" }
  | { readonly kind: "config" }
  | { readonly kind: "help" };

export const ROULETTE_COMMAND = "ruleta";
export const ROULETTE_ALIASES = ["roulette"] as const;

const fold = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLowerCase()
    .trim();

export const parseRouletteArgs = (args: readonly string[]): RouletteCommand => {
  const sub = fold(args[0] ?? "");
  if (sub.length === 0) {
    return { kind: "spin" };
  }
  switch (sub) {
    case "estado":
    case "status":
      return { kind: "status" };
    case "config":
    case "ajustes":
      return { kind: "config" };
    default:
      return { kind: "help" };
  }
};

export const ROULETTE_USAGE = [
  "Uso de /ruleta:",
  "/ruleta — juegas tú (nunca contra otra persona)",
  "/ruleta estado — probabilidad y consecuencia actuales",
  "/ruleta config — dónde se configura",
].join("\n");
