import { describe, expect, it } from "vitest";
import { adjustSanction, type Sanction } from "./sanction-adjust.js";

describe("adjustSanction", () => {
  it("hardens one step up the ladder", () => {
    expect(adjustSanction("silencio", "endurecer")).toEqual({
      next: "expulsion",
      changed: true,
      message: "Sanción ajustada: silencio → expulsión.",
    });
  });

  it("softens one step down the ladder", () => {
    expect(adjustSanction("expulsion", "suavizar")).toEqual({
      next: "silencio",
      changed: true,
      message: "Sanción ajustada: expulsión → silencio.",
    });
  });

  it("clamps at the lightest level when softening 'aviso'", () => {
    expect(adjustSanction("aviso", "suavizar")).toEqual({
      next: "aviso",
      changed: false,
      message:
        "La sanción ya está en el mínimo (aviso); no se puede suavizar más.",
    });
  });

  it("clamps at the harshest level when hardening 'ban'", () => {
    expect(adjustSanction("ban", "endurecer")).toEqual({
      next: "ban",
      changed: false,
      message:
        "La sanción ya está en el máximo (ban); no se puede endurecer más.",
    });
  });

  it("hardens from the lightest level", () => {
    const result = adjustSanction("aviso", "endurecer");
    expect(result.next).toBe("silencio");
    expect(result.changed).toBe(true);
  });

  it("softens from the harshest level", () => {
    const result = adjustSanction("ban", "suavizar");
    expect(result.next).toBe("expulsion");
    expect(result.changed).toBe(true);
  });

  it("hardening then softening returns to the original level", () => {
    const hardened = adjustSanction("silencio", "endurecer");
    const restored = adjustSanction(hardened.next, "suavizar");
    expect(restored.next).toBe("silencio");
  });

  it("walks the full ladder upward without skipping steps", () => {
    const steps: readonly Sanction[] = [
      "aviso",
      "silencio",
      "expulsion",
      "ban",
    ];
    for (let i = 0; i < steps.length - 1; i += 1) {
      const from = steps[i] ?? "aviso";
      const to = steps[i + 1] ?? "ban";
      expect(adjustSanction(from, "endurecer").next).toBe(to);
    }
  });

  it("is deterministic for repeated identical calls", () => {
    const a = adjustSanction("expulsion", "endurecer");
    const b = adjustSanction("expulsion", "endurecer");
    expect(a).toEqual(b);
    expect(a).toEqual({
      next: "ban",
      changed: true,
      message: "Sanción ajustada: expulsión → ban.",
    });
  });

  it("uses accented Spanish labels in confirmation messages", () => {
    expect(adjustSanction("silencio", "endurecer").message).toContain(
      "expulsión",
    );
  });
});
