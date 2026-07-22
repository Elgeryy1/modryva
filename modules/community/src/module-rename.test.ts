import { describe, expect, it } from "vitest";
import {
  DEFAULT_MODULE_NAMES,
  MODULE_NAME_MAX_LENGTH,
  resolveModuleName,
  sanitizeModuleName,
} from "./module-rename.js";

describe("DEFAULT_MODULE_NAMES", () => {
  it("maps known module keys to non-empty default names", () => {
    for (const [key, value] of Object.entries(DEFAULT_MODULE_NAMES)) {
      expect(key.length).toBeGreaterThan(0);
      expect(value.length).toBeGreaterThan(0);
    }
  });

  it("includes the inbox default used by the spec example", () => {
    expect(DEFAULT_MODULE_NAMES.inbox).toBe("Bandeja de entrada");
  });
});

describe("sanitizeModuleName", () => {
  it("trims leading and trailing whitespace", () => {
    expect(sanitizeModuleName("  Mesa de staff  ")).toBe("Mesa de staff");
  });

  it("collapses internal runs of whitespace to single spaces", () => {
    expect(sanitizeModuleName("Mesa   de\t\tstaff")).toBe("Mesa de staff");
  });

  it("returns an empty string for blank input", () => {
    expect(sanitizeModuleName("   ")).toBe("");
    expect(sanitizeModuleName("")).toBe("");
  });

  it("leaves names at the max length untouched", () => {
    const name = "a".repeat(MODULE_NAME_MAX_LENGTH);
    expect(sanitizeModuleName(name)).toBe(name);
    expect(sanitizeModuleName(name).length).toBe(MODULE_NAME_MAX_LENGTH);
  });

  it("truncates names longer than the max length", () => {
    const name = "b".repeat(MODULE_NAME_MAX_LENGTH + 10);
    const result = sanitizeModuleName(name);
    expect(result.length).toBe(MODULE_NAME_MAX_LENGTH);
    expect(result).toBe("b".repeat(MODULE_NAME_MAX_LENGTH));
  });

  it("re-trims after truncation when the cut lands on a space", () => {
    const name = `${"c".repeat(MODULE_NAME_MAX_LENGTH - 1)}   extra`;
    const result = sanitizeModuleName(name);
    expect(result).toBe("c".repeat(MODULE_NAME_MAX_LENGTH - 1));
    expect(result.endsWith(" ")).toBe(false);
  });

  it("preserves accented user-facing characters", () => {
    expect(sanitizeModuleName("Moderación")).toBe("Moderación");
  });

  it("is deterministic for identical inputs", () => {
    expect(sanitizeModuleName("  hola  mundo ")).toBe(
      sanitizeModuleName("  hola  mundo "),
    );
  });
});

describe("resolveModuleName", () => {
  it("uses a sanitized override when present", () => {
    expect(resolveModuleName("inbox", { inbox: "  Mesa de staff  " })).toBe(
      "Mesa de staff",
    );
  });

  it("falls back to the default when there is no override", () => {
    expect(resolveModuleName("inbox", {})).toBe("Bandeja de entrada");
  });

  it("falls back to the default when the override is blank", () => {
    expect(resolveModuleName("inbox", { inbox: "   " })).toBe(
      "Bandeja de entrada",
    );
  });

  it("falls back to the key when neither override nor default exist", () => {
    expect(resolveModuleName("unknown_module", {})).toBe("unknown_module");
  });

  it("prefers a blank-override fallback to key when no default exists", () => {
    expect(resolveModuleName("unknown_module", { unknown_module: "  " })).toBe(
      "unknown_module",
    );
  });

  it("only applies the override matching the requested key", () => {
    expect(resolveModuleName("moderation", { inbox: "Mesa de staff" })).toBe(
      "Moderacion",
    );
  });

  it("truncates an overly long override", () => {
    const long = "z".repeat(MODULE_NAME_MAX_LENGTH + 5);
    const result = resolveModuleName("inbox", { inbox: long });
    expect(result.length).toBe(MODULE_NAME_MAX_LENGTH);
  });

  it("is deterministic for identical inputs", () => {
    const overrides = { inbox: "Mesa de staff" };
    expect(resolveModuleName("inbox", overrides)).toBe(
      resolveModuleName("inbox", overrides),
    );
  });

  it("does not mutate the overrides map", () => {
    const overrides = { inbox: "  Mesa  " };
    resolveModuleName("inbox", overrides);
    expect(overrides).toEqual({ inbox: "  Mesa  " });
  });
});
