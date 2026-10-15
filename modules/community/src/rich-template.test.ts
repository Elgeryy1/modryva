import { describe, expect, it } from "vitest";
import {
  buildTemplateReply,
  parseButtons,
  pickVariant,
  renderFillings,
} from "./rich-template.js";

describe("parseButtons", () => {
  it("extracts a single button and removes it from the text", () => {
    const result = parseButtons(
      "Bienvenido al grupo\n[Reglas](buttonurl://https://t.me/x)",
    );
    expect(result.text).toBe("Bienvenido al grupo");
    expect(result.buttons).toEqual([
      [{ text: "Reglas", url: "https://t.me/x" }],
    ]);
  });

  it("places consecutive buttons on separate rows by default", () => {
    const result = parseButtons(
      "[Web](buttonurl://https://a.com)\n[Chat](buttonurl://https://b.com)",
    );
    expect(result.buttons).toEqual([
      [{ text: "Web", url: "https://a.com" }],
      [{ text: "Chat", url: "https://b.com" }],
    ]);
  });

  it("keeps a :same button on the same row as the previous one", () => {
    const result = parseButtons(
      "[Web](buttonurl://https://a.com)  [Chat](buttonurl://https://b.com:same)",
    );
    expect(result.buttons).toEqual([
      [
        { text: "Web", url: "https://a.com" },
        { text: "Chat", url: "https://b.com" },
      ],
    ]);
  });

  it("accepts urls without the buttonurl:// prefix", () => {
    const result = parseButtons("[Sitio](https://ejemplo.com)");
    expect(result.buttons).toEqual([
      [{ text: "Sitio", url: "https://ejemplo.com" }],
    ]);
  });

  it("mixes prefixed and unprefixed urls with :same rows", () => {
    const result = parseButtons(
      "Menu\n[Uno](https://a.com)  [Dos](buttonurl://https://b.com:same)\n[Tres](https://c.com)",
    );
    expect(result.text).toBe("Menu");
    expect(result.buttons).toEqual([
      [
        { text: "Uno", url: "https://a.com" },
        { text: "Dos", url: "https://b.com" },
      ],
      [{ text: "Tres", url: "https://c.com" }],
    ]);
  });

  it("returns no buttons and the trimmed raw text when none are present", () => {
    const result = parseButtons("  Solo texto sin botones  ");
    expect(result.buttons).toEqual([]);
    expect(result.text).toBe("Solo texto sin botones");
  });

  it("preserves multiline text around the buttons", () => {
    const result = parseButtons(
      "Linea uno\nLinea dos\n[Ir](buttonurl://https://x.com)",
    );
    expect(result.text).toBe("Linea uno\nLinea dos");
    expect(result.buttons).toEqual([[{ text: "Ir", url: "https://x.com" }]]);
  });

  it("leaves the surrounding markdown intact", () => {
    const result = parseButtons(
      "*Negrita* y _cursiva_\n[Link](buttonurl://https://m.com)",
    );
    expect(result.text).toBe("*Negrita* y _cursiva_");
  });

  it("ignores a :same button with no previous button by starting a new row", () => {
    const result = parseButtons("[Solo](buttonurl://https://s.com:same)");
    expect(result.buttons).toEqual([[{ text: "Solo", url: "https://s.com" }]]);
  });
});

describe("pickVariant", () => {
  it("returns the raw text unchanged when there is no %%% separator", () => {
    const raw = "Un solo mensaje sin variantes";
    expect(pickVariant(raw, 0)).toBe(raw);
    expect(pickVariant(raw, 99)).toBe(raw);
  });

  it("chooses one of the variants and trims it", () => {
    const raw = "  Hola  \n%%%\n  Que tal  ";
    const chosen = pickVariant(raw, 1);
    expect(["Hola", "Que tal"]).toContain(chosen);
  });

  it("is deterministic for the same seed", () => {
    const raw = "Uno\n%%%\nDos\n%%%\nTres";
    expect(pickVariant(raw, 7)).toBe(pickVariant(raw, 7));
    expect(pickVariant(raw, 42)).toBe(pickVariant(raw, 42));
  });

  it("can select different variants for different seeds", () => {
    const raw = "A\n%%%\nB\n%%%\nC\n%%%\nD";
    const seen = new Set<string>();
    for (let seed = 0; seed < 40; seed += 1) {
      seen.add(pickVariant(raw, seed));
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it("always returns one of the declared variants", () => {
    const raw = "Primera\n%%%\nSegunda\n%%%\nTercera";
    for (const seed of [0, 1, 2, 3, 10, 500, 7919]) {
      expect(["Primera", "Segunda", "Tercera"]).toContain(
        pickVariant(raw, seed),
      );
    }
  });
});

describe("renderFillings", () => {
  it("substitutes known keys with their values", () => {
    expect(
      renderFillings("Hola {first_name} en {chat_title}", {
        first_name: "Ana",
        chat_title: "Superbot",
      }),
    ).toBe("Hola Ana en Superbot");
  });

  it("replaces unknown keys with an empty string", () => {
    expect(renderFillings("Hola {desconocida}!", {})).toBe("Hola !");
  });

  it("only matches lower case and underscore keys", () => {
    expect(renderFillings("{First_Name} {a1}", { First_Name: "x" })).toBe(
      "{First_Name} {a1}",
    );
  });
});

describe("buildTemplateReply", () => {
  it("integrates variant, fillings and buttons with a replyMarkup", () => {
    const raw = "Bienvenido {first_name}\n[Reglas](buttonurl://https://t.me/x)";
    const result = buildTemplateReply(raw, { first_name: "Ana" }, 0);
    expect(result.text).toBe("Bienvenido Ana");
    expect(result.replyMarkup).toEqual({
      inline_keyboard: [[{ text: "Reglas", url: "https://t.me/x" }]],
    });
  });

  it("omits replyMarkup when there are no buttons", () => {
    const result = buildTemplateReply(
      "Hola {first_name}",
      { first_name: "Ana" },
      0,
    );
    expect(result.text).toBe("Hola Ana");
    expect(result).not.toHaveProperty("replyMarkup");
    expect(Object.hasOwn(result, "replyMarkup")).toBe(false);
  });

  it("picks a variant before rendering and parsing", () => {
    const raw = "Hola {name}\n%%%\nBienvenido {name}\n[Web](https://a.com)";
    const result = buildTemplateReply(raw, { name: "Leo" }, 3);
    expect(["Hola Leo", "Bienvenido Leo"]).toContain(result.text);
  });

  it("builds :same buttons into a single inline_keyboard row", () => {
    const raw =
      "Menu\n[Uno](https://a.com)  [Dos](buttonurl://https://b.com:same)";
    const result = buildTemplateReply(raw, {}, 0);
    expect(result.replyMarkup).toEqual({
      inline_keyboard: [
        [
          { text: "Uno", url: "https://a.com" },
          { text: "Dos", url: "https://b.com" },
        ],
      ],
    });
  });

  it("is deterministic across calls with the same seed", () => {
    const raw = "A {v}\n%%%\nB {v}\n%%%\nC {v}\n[Ir](https://x.com)";
    const first = buildTemplateReply(raw, { v: "1" }, 11);
    const second = buildTemplateReply(raw, { v: "1" }, 11);
    expect(first).toEqual(second);
  });
});
