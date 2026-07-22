import { describe, expect, it } from "vitest";
import { detectOutdatedCommands } from "./outdated-commands.js";

describe("detectOutdatedCommands", () => {
  it("reports missing and stale commands preserving source order", () => {
    expect(
      detectOutdatedCommands(
        ["start", "help", "old"],
        ["start", "help", "new"],
      ),
    ).toEqual({ missing: ["new"], stale: ["old"], inSync: false });
  });

  it("is in sync when registered exactly matches expected", () => {
    expect(
      detectOutdatedCommands(["start", "help"], ["start", "help"]),
    ).toEqual({
      missing: [],
      stale: [],
      inSync: true,
    });
  });

  it("is in sync for two empty lists", () => {
    expect(detectOutdatedCommands([], [])).toEqual({
      missing: [],
      stale: [],
      inSync: true,
    });
  });

  it("marks every expected command missing when nothing is registered", () => {
    expect(detectOutdatedCommands([], ["start", "help"])).toEqual({
      missing: ["start", "help"],
      stale: [],
      inSync: false,
    });
  });

  it("marks every registered command stale when nothing is expected", () => {
    expect(detectOutdatedCommands(["start", "help"], [])).toEqual({
      missing: [],
      stale: ["start", "help"],
      inSync: false,
    });
  });

  it("ignores registration order and keeps expected order for missing", () => {
    expect(
      detectOutdatedCommands(["help", "start"], ["start", "help", "reglas"]),
    ).toEqual({ missing: ["reglas"], stale: [], inSync: false });
  });

  it("deduplicates registered commands", () => {
    expect(
      detectOutdatedCommands(["start", "start", "help"], ["start", "help"]),
    ).toEqual({ missing: [], stale: [], inSync: true });
  });

  it("deduplicates expected commands", () => {
    expect(
      detectOutdatedCommands(["start"], ["start", "start", "help"]),
    ).toEqual({ missing: ["help"], stale: [], inSync: false });
  });

  it("treats comparison as case-sensitive", () => {
    expect(detectOutdatedCommands(["Start"], ["start"])).toEqual({
      missing: ["start"],
      stale: ["Start"],
      inSync: false,
    });
  });

  it("is deterministic across repeated calls with the same inputs", () => {
    const registered = ["a", "b", "c"];
    const expected = ["b", "d"];
    const first = detectOutdatedCommands(registered, expected);
    const second = detectOutdatedCommands(registered, expected);
    expect(first).toEqual(second);
    expect(first).toEqual({ missing: ["d"], stale: ["a", "c"], inSync: false });
  });
});
