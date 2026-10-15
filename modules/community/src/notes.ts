import type { TelegramUpdateEnvelope } from "@superbot/domain";

export type NotesCommand =
  | { readonly kind: "save"; readonly name: string; readonly content: string }
  | { readonly kind: "get"; readonly name: string }
  | { readonly kind: "list" }
  | { readonly kind: "clear"; readonly name: string };

export interface NotesCommandError {
  readonly code: "name-required" | "content-required";
  readonly usage: string;
}

export type NotesCommandResult =
  | { readonly ok: true; readonly command: NotesCommand }
  | { readonly ok: false; readonly error: NotesCommandError };

const notesCommandNames: ReadonlySet<string> = new Set([
  "save",
  "get",
  "notes",
  "clear",
]);

export const normalizeNoteName = (value: string): string =>
  value.trim().replace(/^#/u, "").toLowerCase();

export const parseNotesCommand = (
  update: TelegramUpdateEnvelope,
): NotesCommandResult | null => {
  const name = update.command?.name;

  if (!name || !notesCommandNames.has(name)) {
    return null;
  }

  const args = update.command?.args ?? [];

  if (name === "notes") {
    return { ok: true, command: { kind: "list" } };
  }

  const noteName = normalizeNoteName(args[0] ?? "");

  if (!noteName) {
    return {
      ok: false,
      error: {
        code: "name-required",
        usage:
          name === "save"
            ? "Uso: /save <nombre> <contenido>"
            : `Uso: /${name} <nombre>`,
      },
    };
  }

  if (name === "get") {
    return { ok: true, command: { kind: "get", name: noteName } };
  }

  if (name === "clear") {
    return { ok: true, command: { kind: "clear", name: noteName } };
  }

  const content = args.slice(1).join(" ").trim();

  if (!content) {
    return {
      ok: false,
      error: {
        code: "content-required",
        usage: "Uso: /save <nombre> <contenido>",
      },
    };
  }

  return { ok: true, command: { kind: "save", name: noteName, content } };
};

/**
 * Detects a hashtag note recall such as `#rules` in a plain message. Returns the
 * normalized note name or null when the message is not a single-note recall.
 */
export const detectNoteRecall = (text: string | undefined): string | null => {
  if (!text) {
    return null;
  }

  const trimmed = text.trim();
  const match = /^#([\p{L}\p{N}_-]{1,64})$/u.exec(trimmed);

  return match?.[1] ? match[1].toLowerCase() : null;
};
