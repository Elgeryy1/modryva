import type { TelegramUpdateEnvelope } from "@superbot/domain";

/**
 * Notas internas por caso (staff-only) mas menciones internas de staff.
 * Logica pura: parsea `/note`, formatea una nota para mostrarla y extrae que
 * miembros del staff aparecen mencionados en un texto. Sin I/O ni estado.
 */

export type CaseNoteCommand =
  | { readonly kind: "add"; readonly text: string }
  | { readonly kind: "list" };

export interface CaseNoteCommandError {
  readonly usage: string;
}

export type CaseNoteCommandResult =
  | { readonly ok: true; readonly command: CaseNoteCommand }
  | { readonly ok: false; readonly error: CaseNoteCommandError };

const CASE_NOTE_USAGE =
  "Uso: /note <texto> para anadir una nota, o /note list para verlas";

/**
 * Parsea `/note`:
 *   - `/note list`            -> { kind: "list" }
 *   - `/note <texto...>`      -> { kind: "add", text }
 *   - `/note` (sin argumentos) -> error con `usage`
 * Devuelve null cuando el update no lleva el comando `/note`. El subcomando
 * `list` es case-insensitive y solo cuenta como listado cuando es el unico
 * argumento; en cualquier otro caso el texto se toma literal. Puro y
 * determinista.
 */
export const parseCaseNoteCommand = (
  update: TelegramUpdateEnvelope,
): CaseNoteCommandResult | null => {
  if (update.command?.name !== "note") {
    return null;
  }

  const args = update.command?.args ?? [];

  if (args.length === 1 && args[0]?.toLowerCase() === "list") {
    return { ok: true, command: { kind: "list" } };
  }

  const text = args.join(" ").trim();

  if (text.length === 0) {
    return { ok: false, error: { usage: CASE_NOTE_USAGE } };
  }

  return { ok: true, command: { kind: "add", text } };
};

/** Una nota de caso ya persistida que queremos renderizar. */
export interface CaseNote {
  readonly authorName: string;
  readonly ms: number;
  readonly text: string;
}

/**
 * Formatea una duracion en milisegundos como texto compacto en espanol-neutro:
 * `"ahora"` para menos de un minuto (o negativos), `"hace 5m"`, `"hace 2h"`,
 * `"hace 3d"`. Se muestra la unidad mayor disponible. Puro y determinista.
 */
export const formatCaseNoteAge = (ms: number): string => {
  if (ms < 60_000) {
    return "ahora";
  }

  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) {
    return `hace ${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `hace ${hours}h`;
  }

  const days = Math.floor(hours / 24);
  return `hace ${days}d`;
};

/**
 * Renderiza una nota como `"📝 <autor> (hace 2h): <texto>"`. La antiguedad
 * deriva de `nowMs - n.ms`, de modo que la funcion es determinista para
 * entradas identicas. El autor y el texto se recortan de espacios sobrantes.
 */
export const formatCaseNote = (n: CaseNote, nowMs: number): string => {
  const author = n.authorName.trim() || "staff";
  const age = formatCaseNoteAge(nowMs - n.ms);
  return `📝 ${author} (${age}): ${n.text.trim()}`;
};

const STAFF_MENTION_PATTERN = /@([a-zA-Z0-9_]{3,32})/g;

/**
 * Extrae de `text` los usernames de staff mencionados via `@username`. El
 * resultado esta en minusculas, sin duplicados y preservando el orden de
 * primera aparicion en el texto. Solo se devuelven usernames que aparezcan en
 * `staffUsernames` (comparado en minusculas). Puro y determinista.
 */
export const extractStaffMentions = (
  text: string,
  staffUsernames: readonly string[],
): string[] => {
  if (!text) {
    return [];
  }

  const staff = new Set(staffUsernames.map((u) => u.toLowerCase()));
  if (staff.size === 0) {
    return [];
  }

  const seen = new Set<string>();
  const mentions: string[] = [];

  for (const match of text.matchAll(STAFF_MENTION_PATTERN)) {
    const username = (match[1] ?? "").toLowerCase();
    if (username && staff.has(username) && !seen.has(username)) {
      seen.add(username);
      mentions.push(username);
    }
  }

  return mentions;
};
