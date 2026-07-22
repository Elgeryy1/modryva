import { describe, expect, it } from "vitest";
import {
  buildAiMemorySystemHint,
  describeMemory,
  extractAiMemoryFacts,
  memoryKeyForNote,
  parseRememberCommand,
  renderMemoryList,
} from "./memory.js";

describe("extractAiMemoryFacts", () => {
  it("extracts stable user facts conservatively", () => {
    expect(extractAiMemoryFacts("me llamo Alex")).toEqual([
      { scope: "user", key: "preferred_name", value: "Alex" },
    ]);
    expect(extractAiMemoryFacts("vivo en Madrid")[0]).toEqual({
      scope: "user",
      key: "location",
      value: "Madrid",
    });
  });

  it("extracts chat purpose facts", () => {
    expect(
      extractAiMemoryFacts("este grupo es para soporte premium")[0],
    ).toEqual({
      scope: "chat",
      key: "group_purpose",
      value: "soporte premium",
    });
  });
});

describe("buildAiMemorySystemHint", () => {
  it("builds a system hint with user, chat and memory facts", () => {
    const hint = buildAiMemorySystemHint({
      userId: "42",
      username: "demouser",
      firstName: "Alex",
      chatTitle: "Modryva",
      chatType: "supergroup",
      facts: [{ scope: "user", key: "location", value: "Madrid" }],
    });

    expect(hint).toContain("Nombre visible del usuario: Alex");
    expect(hint).toContain("Username del usuario: @demouser");
    expect(hint).toContain("Chat/grupo actual: Modryva");
    expect(hint).toContain("Memoria del usuario: location = Madrid");
  });
});

describe("parseRememberCommand", () => {
  // "Mil millones de formas": every one of these must capture the fact.
  const SAVES: Array<[string, string]> = [
    ["Modryva recuerda que me llamo Alex", "me llamo Alex"],
    [
      "Modryva, recuérdame que soy alérgico al marisco",
      "soy alérgico al marisco",
    ],
    ["recuérdame que tengo reunión los lunes", "tengo reunión los lunes"],
    ["no olvides que prefiero respuestas cortas", "prefiero respuestas cortas"],
    ["no te olvides de que soy vegetariano", "soy vegetariano"],
    ["modryva: recuerda: cumpleaños el 3 de mayo", "cumpleaños el 3 de mayo"],
    ["recuerda: soy Alex", "soy Alex"],
    ["acuérdate de que trabajo de noche", "trabajo de noche"],
    ["acuerdate que odio el cilantro", "odio el cilantro"],
    ["apunta que mi color favorito es el azul", "mi color favorito es el azul"],
    ["anota mi cumpleaños es el 3 de mayo", "mi cumpleaños es el 3 de mayo"],
    ["memoriza que vivo en Madrid", "vivo en Madrid"],
    ["guarda que hablo español e inglés", "hablo español e inglés"],
    ["ten en cuenta que soy zurdo", "soy zurdo"],
    ["ten presente que trabajo remoto", "trabajo remoto"],
    ["que sepas que soy de Madrid", "soy de Madrid"],
    ["quiero que recuerdes que me llamo Alex", "me llamo Alex"],
    ["necesito que sepas que soy celíaco", "soy celíaco"],
  ];
  it.each(SAVES)("captures the fact from %j", (input, expected) => {
    expect(parseRememberCommand(input)).toEqual({ value: expected });
  });

  it("does NOT hijack normal messages or leave a lone filler", () => {
    for (const noise of [
      "hola qué tal",
      "qué recuerdas de mí",
      "no sé qué decir",
      "recuerda que", // no actual fact
      "acuérdate de eso", // lone filler
      "recuerda que <script>", // markup rejected
      "¿me recuerdas el nombre?",
    ]) {
      expect(parseRememberCommand(noise)).toBeNull();
    }
  });

  it("dedups identical notes to the same key, differs for different notes", () => {
    const a = memoryKeyForNote("Me llamo Alex");
    const b = memoryKeyForNote("me   llamo gerard "); // whitespace/case-insensitive
    const c = memoryKeyForNote("soy de Madrid");
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a.startsWith("note:")).toBe(true);
  });
});

describe("describeMemory / renderMemoryList", () => {
  it("shows explicit notes verbatim and labels structured facts", () => {
    expect(
      describeMemory({
        key: "note:abc",
        value: "soy alérgico al marisco",
        source: "explicit",
      }),
    ).toBe("soy alérgico al marisco");
    expect(describeMemory({ key: "preferred_name", value: "Alex" })).toBe(
      "Te llamas Alex",
    );
    expect(describeMemory({ key: "location", value: "Madrid" })).toBe(
      "Eres de / estás en Madrid",
    );
  });

  it("renders a numbered manage-memory list with controls", () => {
    const out = renderMemoryList([
      { key: "preferred_name", value: "Alex" },
      {
        key: "note:x",
        value: "prefiero respuestas cortas",
        source: "explicit",
      },
    ]);
    expect(out).toContain("1. Te llamas Alex");
    expect(out).toContain("2. prefiero respuestas cortas");
    expect(out).toContain("/olvida");
    expect(out).toContain("/olvidatodo");
  });

  it("has a friendly empty state", () => {
    expect(renderMemoryList([])).toContain("Todavía no recuerdo nada de ti");
  });
});
