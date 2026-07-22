import { describe, expect, it } from "vitest";
import { rulesForManualEvent } from "./event-mode.js";

describe("rulesForManualEvent", () => {
  it("tightens rules during a raid", () => {
    expect(rulesForManualEvent("raid").strict).toBe(true);
  });

  it("keeps normal mode relaxed", () => {
    expect(rulesForManualEvent("normal").strict).toBe(false);
  });

  it("echoes the event and includes a note", () => {
    const result = rulesForManualEvent("sorteo");
    expect(result.event).toBe("sorteo");
    expect(result.note.length).toBeGreaterThan(0);
  });

  it("tightens rules during a class", () => {
    expect(rulesForManualEvent("clase").strict).toBe(true);
  });
});
