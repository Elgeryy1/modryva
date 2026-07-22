export interface InlineNote {
  readonly name: string;
  readonly content: string;
}

export interface InlineResult {
  readonly id: string;
  readonly title: string;
  readonly content: string;
  readonly description?: string;
  readonly thumbnailUrl?: string;
  readonly replyMarkup?: Record<string, unknown>;
}

/**
 * Filters notes by a case-insensitive query. An empty or whitespace-only query
 * returns all notes. Otherwise keeps notes whose name OR content includes the
 * lowercased, trimmed query. Input order is preserved.
 */
export const filterNotesByQuery = (
  notes: readonly InlineNote[],
  query: string,
): InlineNote[] => {
  const needle = query.trim().toLowerCase();

  if (!needle) {
    return [...notes];
  }

  return notes.filter(
    (note) =>
      note.name.toLowerCase().includes(needle) ||
      note.content.toLowerCase().includes(needle),
  );
};

/**
 * Builds Telegram inline-query answers from stored notes. Filters via
 * filterNotesByQuery, caps to `limit` results, and maps each note to an
 * InlineResult.
 */
export const buildInlineResults = (
  notes: readonly InlineNote[],
  query: string,
  limit = 10,
): InlineResult[] =>
  filterNotesByQuery(notes, query)
    .slice(0, limit)
    .map((note) => ({
      id: note.name,
      title: note.name,
      content: note.content,
    }));

/** Cheap, dependency-free string hash (djb2) used only to build stable inline-result ids. */
const hashQuery = (value: string): string => {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }
  return (hash >>> 0).toString(36);
};

/**
 * Cheap, always-available inline result shown when Inline Mode has nothing else
 * to offer (empty query, short query, or no notes matched). Guarantees Telegram
 * always gets at least one selectable result — it never triggers an AI call,
 * it only points the user at /ai for a real answer.
 */
export const buildInlineHelpResult = (query: string): InlineResult => {
  const trimmed = query.trim();
  return {
    id: `help:${trimmed ? hashQuery(trimmed) : "empty"}`,
    title: trimmed ? `Preguntar a Modryva: ${trimmed}` : "Modryva",
    content: trimmed
      ? `🤖 Para preguntar a Modryva con IA usa: /ai ${trimmed}`
      : "🤖 Modryva listo. Usa /ai <pregunta> para IA.",
  };
};
