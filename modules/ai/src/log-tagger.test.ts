import { describe, expect, it } from "vitest";
import { LOG_TAGS, tagLog } from "./log-tagger.js";

describe("tagLog", () => {
  it("tags a spam line", () => {
    expect(tagLog("Se detecto spam con un enlace")).toContain("spam");
  });

  it("tags a moderation line", () => {
    expect(tagLog("Usuario baneado por warn 3/3")).toContain("moderacion");
  });

  it("tags a casino line", () => {
    expect(tagLog("Ganó el jackpot en la ruleta")).toContain("casino");
  });

  it("tags a bug line", () => {
    expect(tagLog("Excepción: timeout al llamar a la API")).toContain("bugs");
  });

  it("returns multiple tags in fixed order", () => {
    const tags = tagLog("El admin baneó al spammer del casino");
    // orden fijo: spam, permisos, staff, casino, bugs, moderacion
    expect(tags).toEqual(["spam", "permisos", "casino", "moderacion"]);
  });

  it("is accent- and case-insensitive", () => {
    expect(tagLog("SANCIÓN aplicada")).toContain("moderacion");
  });

  it("returns empty for a neutral line", () => {
    expect(tagLog("buenos dias equipo")).toEqual([]);
  });

  it("does not duplicate a tag", () => {
    const tags = tagLog("spam spam spam enlace link");
    expect(tags.filter((t) => t === "spam")).toHaveLength(1);
  });

  it("only returns known tags", () => {
    for (const tag of tagLog("admin ban casino error spam staff")) {
      expect(LOG_TAGS).toContain(tag);
    }
  });

  it("is deterministic", () => {
    const line = "el moderador degradó a un admin";
    expect(tagLog(line)).toEqual(tagLog(line));
  });
});
