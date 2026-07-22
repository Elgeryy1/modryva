import type { TelegramUpdateEnvelope } from "@superbot/domain";

/**
 * Castigo automatico que dispara un entry de la blocklist. A diferencia del
 * filtro (que solo responde), estos modos aplican una accion sobre el usuario.
 */
export type BlocklistMode = "delete" | "warn" | "mute" | "ban" | "kick";

/**
 * Comando de blocklist ya validado, discriminado por `kind`.
 */
export type BlocklistCommand =
  | {
      readonly kind: "add";
      readonly trigger: string;
      readonly reason: string | undefined;
    }
  | { readonly kind: "list" }
  | { readonly kind: "remove"; readonly trigger: string }
  | { readonly kind: "removeAll" }
  | { readonly kind: "setMode"; readonly mode: BlocklistMode };

/**
 * Error de parseo con codigo estable y texto de uso para el usuario.
 */
export interface BlocklistCommandError {
  readonly code: "trigger-required" | "invalid-mode";
  readonly usage: string;
}

/**
 * Resultado del parser: `ok:true` con el comando o `ok:false` con el error.
 */
export type BlocklistCommandResult =
  | { readonly ok: true; readonly command: BlocklistCommand }
  | { readonly ok: false; readonly error: BlocklistCommandError };

/**
 * Entrada de la blocklist: disparador normalizable y razon opcional.
 */
export interface BlocklistEntry {
  readonly trigger: string;
  readonly reason: string | undefined;
}

const BLOCKLIST_MODES = ["delete", "warn", "mute", "ban", "kick"] as const;

const modeSet: ReadonlySet<string> = new Set(BLOCKLIST_MODES);

const isBlocklistMode = (value: string): value is BlocklistMode =>
  modeSet.has(value);

const addUsage =
  'Uso: /addblocklist <palabra> [razon]. Para frases usa comillas: /addblocklist "vende seguidores" spam';

const setModeUsage = `Uso: /blocklistmode <${BLOCKLIST_MODES.join("|")}>`;

/**
 * Normaliza un disparador: recorta, pasa a minusculas y colapsa los espacios
 * internos multiples a uno solo. Pura y determinista.
 */
export const normalizeBlocklistTrigger = (raw: string): string =>
  raw.trim().toLowerCase().replace(/\s+/g, " ");

/**
 * Divide los argumentos crudos en `trigger` y `reason`. Si el primer argumento
 * abre comillas dobles, el disparador es la frase entre comillas y el resto es
 * la razon; si no, el disparador es el primer token y el resto la razon.
 */
const splitTriggerAndReason = (
  args: readonly string[],
): { trigger: string; reason: string } | null => {
  if (args.length === 0) {
    return null;
  }

  const joined = args.join(" ").trim();

  if (joined.length === 0) {
    return null;
  }

  if (joined.startsWith('"')) {
    const closingIndex = joined.indexOf('"', 1);

    if (closingIndex === -1) {
      const trigger = joined.slice(1).trim();
      return trigger.length > 0 ? { trigger, reason: "" } : null;
    }

    const trigger = joined.slice(1, closingIndex).trim();
    const reason = joined.slice(closingIndex + 1).trim();
    return trigger.length > 0 ? { trigger, reason } : null;
  }

  const firstSpace = joined.indexOf(" ");

  if (firstSpace === -1) {
    return { trigger: joined, reason: "" };
  }

  return {
    trigger: joined.slice(0, firstSpace),
    reason: joined.slice(firstSpace + 1).trim(),
  };
};

const blocklistCommandNames: ReadonlySet<string> = new Set([
  "addblocklist",
  "blocklist",
  "rmblocklist",
  "rmallblocklist",
  "blocklistmode",
]);

/**
 * Parsea los comandos de blocklist (`addblocklist`, `blocklist`, `rmblocklist`,
 * `rmallblocklist`, `blocklistmode`). Devuelve null si el comando no pertenece
 * al modulo, `ok:false` si los argumentos son invalidos, u `ok:true` con el
 * comando. Pura: solo lee `update.command`.
 */
export const parseBlocklistCommand = (
  update: TelegramUpdateEnvelope,
): BlocklistCommandResult | null => {
  const name = update.command?.name;

  if (!name || !blocklistCommandNames.has(name)) {
    return null;
  }

  const args = update.command?.args ?? [];

  if (name === "blocklist") {
    return { ok: true, command: { kind: "list" } };
  }

  if (name === "rmallblocklist") {
    return { ok: true, command: { kind: "removeAll" } };
  }

  if (name === "blocklistmode") {
    const mode = (args[0] ?? "").toLowerCase();

    if (!isBlocklistMode(mode)) {
      return {
        ok: false,
        error: { code: "invalid-mode", usage: setModeUsage },
      };
    }

    return { ok: true, command: { kind: "setMode", mode } };
  }

  if (name === "rmblocklist") {
    const parsed = splitTriggerAndReason(args);

    if (!parsed) {
      return {
        ok: false,
        error: { code: "trigger-required", usage: addUsage },
      };
    }

    return { ok: true, command: { kind: "remove", trigger: parsed.trigger } };
  }

  // name === "addblocklist"
  const parsed = splitTriggerAndReason(args);

  if (!parsed) {
    return {
      ok: false,
      error: { code: "trigger-required", usage: addUsage },
    };
  }

  const reason = parsed.reason.length > 0 ? parsed.reason : undefined;

  return {
    ok: true,
    command: {
      kind: "add",
      trigger: parsed.trigger,
      ...(reason !== undefined ? { reason } : { reason: undefined }),
    },
  };
};

/**
 * ¿Aparece `trigger` (ya normalizado) como subcadena de `text`, tratando `*`
 * como glob (cualquier secuencia, incluida la vacia) y el resto como literal?
 *
 * Implementado con un escaneo lineal `indexOf` de izquierda a derecha en lugar
 * de un RegExp: el trigger se parte por `*` en segmentos literales que deben
 * aparecer EN ORDEN y sin solaparse. Cada segmento se localiza con `indexOf`
 * desde el final del anterior — O(text * segmentos), sin retroceso. La version
 * anterior compilaba cada `*` a `[\\s\\S]*` y encadenaba los trozos, lo que en
 * un trigger con varios `*` (admin puede registrarlos con /addblocklist) provoca
 * retroceso catastrofico (ReDoS): 15 comodines colgaban el proceso >30s con un
 * solo mensaje casi-coincidente. Buscar el primer match de cada segmento es
 * optimo y equivalente en semantica a los `[\\s\\S]*` encadenados.
 */
const globMatchesSubstring = (text: string, trigger: string): boolean => {
  let from = 0;
  for (const segment of trigger.split("*")) {
    if (segment === "") {
      // Comodin al inicio/fin o `*` consecutivos: no impone restriccion.
      continue;
    }
    const at = text.indexOf(segment, from);
    if (at === -1) {
      return false;
    }
    from = at + segment.length;
  }
  return true;
};

/**
 * Busca el primer entry cuyo trigger normalizado aparezca como subcadena del
 * texto normalizado (case-insensitive), soportando el comodin `*`. Devuelve el
 * primer match respetando el orden de `entries`, o null si ninguno coincide.
 * Pura y determinista.
 */
export const matchBlocklist = (
  text: string,
  entries: readonly BlocklistEntry[],
): BlocklistEntry | null => {
  const normalizedText = normalizeBlocklistTrigger(text);

  for (const entry of entries) {
    const normalizedTrigger = normalizeBlocklistTrigger(entry.trigger);

    if (normalizedTrigger.length === 0) {
      continue;
    }

    if (globMatchesSubstring(normalizedText, normalizedTrigger)) {
      return entry;
    }
  }

  return null;
};
