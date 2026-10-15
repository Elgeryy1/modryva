import type { TelegramUpdateEnvelope } from "@superbot/domain";

export interface PortableNote {
  readonly name: string;
  readonly content: string;
}

export type NotesPortCommand =
  | { readonly kind: "export" }
  | { readonly kind: "import"; readonly raw: string };

export interface NotesPortCommandError {
  readonly code: "data-required";
  readonly usage: string;
}

export type NotesPortCommandResult =
  | { readonly ok: true; readonly command: NotesPortCommand }
  | { readonly ok: false; readonly error: NotesPortCommandError };

const notesPortCommandNames: ReadonlySet<string> = new Set([
  "export",
  "import",
]);

const MAX_PORTABLE_NOTES = 200;

export const parseNotesPortCommand = (
  update: TelegramUpdateEnvelope,
): NotesPortCommandResult | null => {
  const name = update.command?.name;

  if (!name || !notesPortCommandNames.has(name)) {
    return null;
  }

  if (name === "export") {
    return { ok: true, command: { kind: "export" } };
  }

  const raw = (update.command?.args ?? []).join(" ").trim();

  if (!raw) {
    return {
      ok: false,
      error: {
        code: "data-required",
        usage: "Uso: /import <json>",
      },
    };
  }

  return { ok: true, command: { kind: "import", raw } };
};

export const serializeNotes = (notes: readonly PortableNote[]): string =>
  JSON.stringify({ version: 1, notes });

const isPortableNote = (value: unknown): value is PortableNote => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as { name?: unknown; content?: unknown };

  return (
    typeof candidate.name === "string" &&
    candidate.name.trim().length > 0 &&
    typeof candidate.content === "string"
  );
};

/**
 * Safely parses an imported notes payload. Accepts either a bare array of
 * `{name,content}` entries or an object of the form `{ notes: [...] }`. Returns
 * null on any malformed input (never throws) and caps the result at 200 notes.
 */
export const parseNotesImport = (raw: string): PortableNote[] | null => {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  let entries: unknown;

  if (Array.isArray(parsed)) {
    entries = parsed;
  } else if (typeof parsed === "object" && parsed !== null) {
    entries = (parsed as { notes?: unknown }).notes;
  } else {
    return null;
  }

  if (!Array.isArray(entries)) {
    return null;
  }

  if (entries.length > MAX_PORTABLE_NOTES) {
    return null;
  }

  const notes: PortableNote[] = [];

  for (const entry of entries) {
    if (!isPortableNote(entry)) {
      return null;
    }

    notes.push({ name: entry.name, content: entry.content });
  }

  return notes;
};

/**
 * Returns true when a filter may trigger again: either it never triggered, or
 * the cooldown window has fully elapsed.
 */
export const filterCooldownOk = (
  lastTriggerMs: number | undefined,
  nowMs: number,
  cooldownSeconds: number,
): boolean =>
  lastTriggerMs === undefined ||
  nowMs - lastTriggerMs >= cooldownSeconds * 1000;
