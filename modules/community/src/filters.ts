import type { TelegramUpdateEnvelope } from "@superbot/domain";

export type FilterCommand =
  | {
      readonly kind: "add";
      readonly trigger: string;
      readonly response: string;
    }
  | { readonly kind: "list" }
  | { readonly kind: "remove"; readonly trigger: string };

export interface FilterCommandError {
  readonly code: "trigger-required" | "response-required";
  readonly usage: string;
}

export type FilterCommandResult =
  | { readonly ok: true; readonly command: FilterCommand }
  | { readonly ok: false; readonly error: FilterCommandError };

const filterCommandNames: ReadonlySet<string> = new Set([
  "filter",
  "filters",
  "stop",
]);

export const normalizeTrigger = (value: string): string =>
  value.trim().toLowerCase();

export const parseFilterCommand = (
  update: TelegramUpdateEnvelope,
): FilterCommandResult | null => {
  const name = update.command?.name;

  if (!name || !filterCommandNames.has(name)) {
    return null;
  }

  const args = update.command?.args ?? [];

  if (name === "filters") {
    return { ok: true, command: { kind: "list" } };
  }

  const trigger = normalizeTrigger(args[0] ?? "");

  if (!trigger) {
    return {
      ok: false,
      error: {
        code: "trigger-required",
        usage:
          name === "filter"
            ? "Uso: /filter <palabra> <respuesta>"
            : "Uso: /stop <palabra>",
      },
    };
  }

  if (name === "stop") {
    return { ok: true, command: { kind: "remove", trigger } };
  }

  const response = args.slice(1).join(" ").trim();

  if (!response) {
    return {
      ok: false,
      error: {
        code: "response-required",
        usage: "Uso: /filter <palabra> <respuesta>",
      },
    };
  }

  return { ok: true, command: { kind: "add", trigger, response } };
};

/**
 * Returns the first trigger that appears as a whole, case-insensitive word in the
 * message text, following the order of the provided list. Triggers are matched on
 * word boundaries so "cat" does not match "category".
 */
export const matchFilter = (
  text: string,
  triggers: readonly string[],
): string | null => {
  const haystack = ` ${text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ")} `;

  for (const trigger of triggers) {
    const needle = ` ${trigger.toLowerCase()} `;
    if (haystack.includes(needle)) {
      return trigger;
    }
  }

  return null;
};
