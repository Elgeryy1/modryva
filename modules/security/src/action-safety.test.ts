import { describe, expect, it } from "vitest";
import { classifyActionSafety } from "./action-safety.js";

describe("classifyActionSafety", () => {
  it("marks ban as red and irreversible", () => {
    expect(classifyActionSafety("ban")).toEqual({
      level: "rojo",
      reversible: false,
    });
  });

  it("marks purge and delete_all as red", () => {
    expect(classifyActionSafety("purge").level).toBe("rojo");
    expect(classifyActionSafety("delete_all").level).toBe("rojo");
  });

  it("marks mute and kick as yellow and reversible", () => {
    expect(classifyActionSafety("mute")).toEqual({
      level: "amarillo",
      reversible: true,
    });
    expect(classifyActionSafety("kick")).toEqual({
      level: "amarillo",
      reversible: true,
    });
  });

  it("marks warn and note as green and reversible", () => {
    expect(classifyActionSafety("warn")).toEqual({
      level: "verde",
      reversible: true,
    });
    expect(classifyActionSafety("note")).toEqual({
      level: "verde",
      reversible: true,
    });
  });

  it("is case and whitespace insensitive", () => {
    expect(classifyActionSafety("  BAN ").level).toBe("rojo");
  });

  it("defaults an unknown action to yellow reversible", () => {
    expect(classifyActionSafety("frobnicate")).toEqual({
      level: "amarillo",
      reversible: true,
    });
  });

  it("is deterministic", () => {
    expect(classifyActionSafety("ban")).toEqual(classifyActionSafety("ban"));
  });
});
