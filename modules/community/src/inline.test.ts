import { describe, expect, it } from "vitest";
import {
  buildInlineHelpResult,
  buildInlineResults,
  filterNotesByQuery,
  type InlineNote,
} from "./inline.js";

const notes: readonly InlineNote[] = [
  { name: "rules", content: "Se amable con todos" },
  { name: "welcome", content: "Bienvenido al grupo" },
  { name: "links", content: "Documentacion oficial RULES y guias" },
];

describe("filterNotesByQuery", () => {
  it("returns all notes when the query is empty", () => {
    expect(filterNotesByQuery(notes, "")).toEqual(notes);
  });

  it("returns all notes when the query is whitespace only", () => {
    expect(filterNotesByQuery(notes, "   ")).toEqual(notes);
  });

  it("returns a copy, not the same reference, for empty query", () => {
    const result = filterNotesByQuery(notes, "");
    expect(result).not.toBe(notes);
    expect(result).toEqual(notes);
  });

  it("matches by name", () => {
    expect(filterNotesByQuery(notes, "welcome")).toEqual([
      { name: "welcome", content: "Bienvenido al grupo" },
    ]);
  });

  it("matches by content", () => {
    expect(filterNotesByQuery(notes, "grupo")).toEqual([
      { name: "welcome", content: "Bienvenido al grupo" },
    ]);
  });

  it("is case-insensitive for the query", () => {
    expect(filterNotesByQuery(notes, "WELCOME")).toEqual([
      { name: "welcome", content: "Bienvenido al grupo" },
    ]);
  });

  it("is case-insensitive for note name and content", () => {
    // "rules" matches the name of the first note and the content of the third.
    expect(filterNotesByQuery(notes, "RULES")).toEqual([
      { name: "rules", content: "Se amable con todos" },
      { name: "links", content: "Documentacion oficial RULES y guias" },
    ]);
  });

  it("trims surrounding whitespace before matching", () => {
    expect(filterNotesByQuery(notes, "  welcome  ")).toEqual([
      { name: "welcome", content: "Bienvenido al grupo" },
    ]);
  });

  it("preserves input order", () => {
    const result = filterNotesByQuery(notes, "e");
    expect(result.map((note) => note.name)).toEqual([
      "rules",
      "welcome",
      "links",
    ]);
  });

  it("returns an empty array when nothing matches", () => {
    expect(filterNotesByQuery(notes, "zzz")).toEqual([]);
  });
});

describe("buildInlineResults", () => {
  it("returns all notes (up to the limit) for an empty query", () => {
    expect(buildInlineResults(notes, "")).toEqual([
      { id: "rules", title: "rules", content: "Se amable con todos" },
      { id: "welcome", title: "welcome", content: "Bienvenido al grupo" },
      {
        id: "links",
        title: "links",
        content: "Documentacion oficial RULES y guias",
      },
    ]);
  });

  it("maps a matched note to the InlineResult shape", () => {
    expect(buildInlineResults(notes, "welcome")).toEqual([
      { id: "welcome", title: "welcome", content: "Bienvenido al grupo" },
    ]);
  });

  it("matches by content and maps the result", () => {
    expect(buildInlineResults(notes, "Bienvenido")).toEqual([
      { id: "welcome", title: "welcome", content: "Bienvenido al grupo" },
    ]);
  });

  it("is case-insensitive", () => {
    expect(buildInlineResults(notes, "WeLcOmE")).toEqual([
      { id: "welcome", title: "welcome", content: "Bienvenido al grupo" },
    ]);
  });

  it("caps the number of results at the default limit of 10", () => {
    const many: InlineNote[] = Array.from({ length: 25 }, (_, index) => ({
      name: `note-${index}`,
      content: `content ${index}`,
    }));

    const result = buildInlineResults(many, "");
    expect(result).toHaveLength(10);
    expect(result[0]).toEqual({
      id: "note-0",
      title: "note-0",
      content: "content 0",
    });
    expect(result[9]?.id).toBe("note-9");
  });

  it("respects a custom limit", () => {
    expect(buildInlineResults(notes, "", 2)).toEqual([
      { id: "rules", title: "rules", content: "Se amable con todos" },
      { id: "welcome", title: "welcome", content: "Bienvenido al grupo" },
    ]);
  });

  it("returns fewer results than the limit when fewer match", () => {
    expect(buildInlineResults(notes, "welcome", 10)).toHaveLength(1);
  });

  it("returns an empty array when nothing matches", () => {
    expect(buildInlineResults(notes, "zzz")).toEqual([]);
  });

  it("preserves input order in the mapped results", () => {
    expect(buildInlineResults(notes, "e").map((result) => result.id)).toEqual([
      "rules",
      "welcome",
      "links",
    ]);
  });
});

describe("buildInlineHelpResult", () => {
  it("points to /ai for an empty query", () => {
    const result = buildInlineHelpResult("");
    expect(result.id).toBe("help:empty");
    expect(result.title).toBe("Modryva");
    expect(result.content).toBe(
      "🤖 Modryva listo. Usa /ai <pregunta> para IA.",
    );
  });

  it("points to /ai with the query text", () => {
    const result = buildInlineHelpResult("hola que tal");
    expect(result.title).toBe("Preguntar a Modryva: hola que tal");
    expect(result.content).toBe(
      "🤖 Para preguntar a Modryva con IA usa: /ai hola que tal",
    );
  });

  it("produces a stable, non-empty id for the same query", () => {
    const first = buildInlineHelpResult("hola");
    const second = buildInlineHelpResult("hola");
    expect(first.id).toBe(second.id);
    expect(first.id).not.toBe("help:empty");
  });

  it("produces different ids for different queries", () => {
    expect(buildInlineHelpResult("hola").id).not.toBe(
      buildInlineHelpResult("adios").id,
    );
  });
});
