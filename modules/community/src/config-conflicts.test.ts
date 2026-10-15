import { describe, expect, it } from "vitest";
import {
  detectConfigConflicts,
  hasConfigConflict,
} from "./config-conflicts.js";

describe("detectConfigConflicts", () => {
  it("flags a single pair when both flags are true", () => {
    expect(
      detectConfigConflicts({ allowLinks: true, blockLinks: true }),
    ).toEqual([
      {
        a: "allowLinks",
        b: "blockLinks",
        explanation:
          "Permites y bloqueas enlaces al mismo tiempo. Deja activa solo una de las dos opciones. 🔗",
      },
    ]);
  });

  it("returns empty for an empty config", () => {
    expect(detectConfigConflicts({})).toEqual([]);
  });

  it("returns empty when only one flag of a pair is enabled", () => {
    expect(detectConfigConflicts({ allowLinks: true })).toEqual([]);
  });

  it("does not flag a pair when the partner flag is false", () => {
    expect(
      detectConfigConflicts({ allowLinks: true, blockLinks: false }),
    ).toEqual([]);
  });

  it("preserves catalog order across multiple conflicts", () => {
    const result = detectConfigConflicts({
      silentMode: true,
      announceAll: true,
      allowMedia: true,
      blockMedia: true,
    });
    expect(result.map((c) => c.a)).toEqual(["allowMedia", "silentMode"]);
  });

  it("supports a flag that participates in more than one rule", () => {
    const result = detectConfigConflicts({
      captchaEnabled: true,
      instantEntry: true,
      autoApproveMembers: true,
    });
    expect(result.map((c) => [c.a, c.b])).toEqual([
      ["captchaEnabled", "instantEntry"],
      ["autoApproveMembers", "captchaEnabled"],
    ]);
  });

  it("ignores unrelated extra keys", () => {
    const result = detectConfigConflicts({
      foo: true,
      bar: true,
      allowLinks: true,
      blockLinks: true,
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.a).toBe("allowLinks");
  });

  it("detects every conflict when all flags are enabled", () => {
    const result = detectConfigConflicts({
      allowLinks: true,
      blockLinks: true,
      allowMedia: true,
      blockMedia: true,
      captchaEnabled: true,
      instantEntry: true,
      silentMode: true,
      announceAll: true,
      autoApproveMembers: true,
    });
    expect(result.map((c) => c.a)).toEqual([
      "allowLinks",
      "allowMedia",
      "captchaEnabled",
      "silentMode",
      "autoApproveMembers",
    ]);
  });

  it("is deterministic across repeated calls", () => {
    const config = {
      allowLinks: true,
      blockLinks: true,
      allowMedia: true,
      blockMedia: true,
    };
    expect(detectConfigConflicts(config)).toEqual(
      detectConfigConflicts(config),
    );
  });

  it("provides accented Spanish explanations", () => {
    const result = detectConfigConflicts({
      captchaEnabled: true,
      instantEntry: true,
    });
    expect(result[0]?.explanation).toContain("verificación");
  });
});

describe("hasConfigConflict", () => {
  it("returns true when a conflict exists", () => {
    expect(hasConfigConflict({ allowLinks: true, blockLinks: true })).toBe(
      true,
    );
  });

  it("returns false for a clean or empty config", () => {
    expect(hasConfigConflict({ allowLinks: true })).toBe(false);
    expect(hasConfigConflict({})).toBe(false);
  });
});
