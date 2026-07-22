import type { TelegramUpdateEnvelope } from "@superbot/domain";

/**
 * Alias de comandos personalizados por grupo. Un grupo puede mapear un nombre
 * corto (p.ej. `reglas`) a un comando canonico (p.ej. `rules`). Logica pura:
 * normalizacion de tokens, resolucion de alias contra un mapa plano y parseo
 * de `/alias set|remove|list`. Sin I/O, sin estado, deterministico.
 */

/** Un token de comando/alias valido: 1..32 chars de [a-z0-9_]. */
const ALIAS_TOKEN = /^[a-z0-9_]{1,32}$/;

/** El propio subcomando `alias` no puede usarse como alias (evita bucles). */
const RESERVED_ALIAS = "alias";

/**
 * Normaliza un alias o nombre de comando: recorta espacios, pasa a minusculas
 * y elimina las barras iniciales (`/`). No valida el formato; devuelve la
 * cadena tal cual quede tras normalizar. Puro.
 */
export const normalizeAlias = (s: string): string =>
  s.trim().replace(/^\/+/, "").toLowerCase();

/**
 * True cuando el token normalizado es un identificador de comando valido
 * ([a-z0-9_], 1..32). Puro.
 */
export const isValidAliasToken = (s: string): boolean =>
  ALIAS_TOKEN.test(normalizeAlias(s));

/**
 * Resuelve `input` contra el mapa de alias del grupo. Devuelve el comando
 * canonico si `input` (normalizado) es un alias conocido; en caso contrario
 * devuelve el propio `input` ya normalizado. Se asume que las claves de
 * `aliases` estan normalizadas. Puro y deterministico.
 */
export const resolveCommandAlias = (
  input: string,
  aliases: Readonly<Record<string, string>>,
): string => {
  const key = normalizeAlias(input);
  const target = aliases[key];
  return target !== undefined ? target : key;
};

export type AliasCommand =
  | { readonly kind: "set"; readonly alias: string; readonly command: string }
  | { readonly kind: "remove"; readonly alias: string }
  | { readonly kind: "list" };

export interface AliasCommandError {
  readonly code:
    | "usage"
    | "invalid-alias"
    | "invalid-command"
    | "reserved-alias";
  readonly message: string;
}

export type AliasCommandResult =
  | { readonly ok: true; readonly command: AliasCommand }
  | { readonly ok: false; readonly error: AliasCommandError };

const USAGE =
  "Uso: /alias set <alias> <comando> | /alias remove <alias> | /alias list";

const err = (
  code: AliasCommandError["code"],
  message: string,
): AliasCommandResult => ({ ok: false, error: { code, message } });

/**
 * Parsea `/alias set <alias> <comando>`, `/alias remove <alias>` y
 * `/alias list`. Devuelve `{ ok: true, command }` en exito, `{ ok: false,
 * error }` cuando la accion o los argumentos son invalidos, y `null` cuando el
 * update no lleva el comando `/alias`. Puro y deterministico.
 */
export const parseAliasCommand = (
  update: TelegramUpdateEnvelope,
): AliasCommandResult | null => {
  if (update.command?.name !== "alias") {
    return null;
  }

  const args = update.command?.args ?? [];
  const action = (args[0] ?? "").toLowerCase();

  if (action === "list") {
    return { ok: true, command: { kind: "list" } };
  }

  if (action === "remove" || action === "del" || action === "delete") {
    const rawAlias = args[1];
    if (rawAlias === undefined) {
      return err("usage", USAGE);
    }
    const alias = normalizeAlias(rawAlias);
    if (!ALIAS_TOKEN.test(alias)) {
      return err(
        "invalid-alias",
        "El alias debe tener 1-32 caracteres de a-z, 0-9 o _.",
      );
    }
    return { ok: true, command: { kind: "remove", alias } };
  }

  if (action === "set" || action === "add") {
    const rawAlias = args[1];
    const rawCommand = args[2];
    if (rawAlias === undefined || rawCommand === undefined) {
      return err("usage", USAGE);
    }
    const alias = normalizeAlias(rawAlias);
    const command = normalizeAlias(rawCommand);
    if (!ALIAS_TOKEN.test(alias)) {
      return err(
        "invalid-alias",
        "El alias debe tener 1-32 caracteres de a-z, 0-9 o _.",
      );
    }
    if (alias === RESERVED_ALIAS) {
      return err("reserved-alias", "No puedes usar «alias» como alias.");
    }
    if (!ALIAS_TOKEN.test(command)) {
      return err(
        "invalid-command",
        "El comando destino debe tener 1-32 caracteres de a-z, 0-9 o _.",
      );
    }
    return { ok: true, command: { kind: "set", alias, command } };
  }

  return err("usage", USAGE);
};
