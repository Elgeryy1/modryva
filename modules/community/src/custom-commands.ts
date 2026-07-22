import type { TelegramUpdateEnvelope } from "@superbot/domain";

export type CustomCommandConfig =
  | { readonly kind: "add"; readonly name: string; readonly response: string }
  | { readonly kind: "remove"; readonly name: string }
  | { readonly kind: "list" };

export interface CustomCommandConfigError {
  readonly code: "name-required" | "invalid-name" | "response-required";
  readonly usage: string;
}

export type CustomCommandConfigResult =
  | { readonly ok: true; readonly command: CustomCommandConfig }
  | { readonly ok: false; readonly error: CustomCommandConfigError };

const customCommandNames: ReadonlySet<string> = new Set([
  "addcmd",
  "delcmd",
  "cmds",
]);

const reservedCommandNames: ReadonlySet<string> = new Set([
  "start",
  "help",
  "menu",
  "settings",
  "status",
  "cancel",
  "addcmd",
  "delcmd",
  "cmds",
]);

const namePattern = /^[a-z0-9_]{1,32}$/u;

const addUsage = "Uso: /addcmd <nombre> <respuesta>";
const delUsage = "Uso: /delcmd <nombre>";

/**
 * Normalizes a custom command name: trims surrounding whitespace, strips a
 * single leading "/" and lowercases the result.
 */
export const normalizeCustomName = (raw: string): string =>
  raw.trim().replace(/^\//u, "").toLowerCase();

/**
 * Reports whether a name collides with a built-in command. Custom commands must
 * not shadow these reserved names.
 */
export const isReservedCommand = (name: string): boolean =>
  reservedCommandNames.has(name.toLowerCase());

export const parseCustomCommandConfig = (
  update: TelegramUpdateEnvelope,
): CustomCommandConfigResult | null => {
  const name = update.command?.name;

  if (!name || !customCommandNames.has(name)) {
    return null;
  }

  const args = update.command?.args ?? [];

  if (name === "cmds") {
    return { ok: true, command: { kind: "list" } };
  }

  const usage = name === "addcmd" ? addUsage : delUsage;
  const rawName = args[0] ?? "";

  if (!rawName.trim()) {
    return { ok: false, error: { code: "name-required", usage } };
  }

  const customName = normalizeCustomName(rawName);

  if (!namePattern.test(customName) || isReservedCommand(customName)) {
    return { ok: false, error: { code: "invalid-name", usage } };
  }

  if (name === "delcmd") {
    return { ok: true, command: { kind: "remove", name: customName } };
  }

  const response = args.slice(1).join(" ").trim();

  if (!response) {
    return { ok: false, error: { code: "response-required", usage: addUsage } };
  }

  return { ok: true, command: { kind: "add", name: customName, response } };
};
