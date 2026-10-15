import { describe, expect, it } from "vitest";
import { canPerformAction } from "./role-action-guard.js";

describe("canPerformAction", () => {
  it("lets the owner perform a global ban", () => {
    expect(canPerformAction("owner", "global_ban")).toEqual({
      allowed: true,
      reason: "✅ El rol «owner» puede ejecutar «global_ban».",
      requiredRole: "owner",
    });
  });

  it("blocks a junior mod from a global ban", () => {
    expect(canPerformAction("junior", "global_ban")).toEqual({
      allowed: false,
      reason:
        "⛔ El rol «junior» no puede ejecutar «global_ban»; se requiere «owner» o superior.",
      requiredRole: "owner",
    });
  });

  it("allows a role at exactly the required rank", () => {
    expect(canPerformAction("mod", "mute")).toEqual({
      allowed: true,
      reason: "✅ El rol «mod» puede ejecutar «mute».",
      requiredRole: "mod",
    });
  });

  it("allows a higher role to run a lower action", () => {
    expect(canPerformAction("owner", "warn").allowed).toBe(true);
  });

  it("blocks a mod from a senior-only ban", () => {
    expect(canPerformAction("mod", "ban")).toEqual({
      allowed: false,
      reason:
        "⛔ El rol «mod» no puede ejecutar «ban»; se requiere «senior» o superior.",
      requiredRole: "senior",
    });
  });

  it("lets the junior run the lowest action", () => {
    expect(canPerformAction("junior", "warn")).toEqual({
      allowed: true,
      reason: "✅ El rol «junior» puede ejecutar «warn».",
      requiredRole: "junior",
    });
  });

  it("denies unknown actions for safety", () => {
    expect(canPerformAction("owner", "nuke")).toEqual({
      allowed: false,
      reason: "⛔ Acción desconocida «nuke»: bloqueada por seguridad.",
      requiredRole: undefined,
    });
  });

  it("normalizes whitespace and casing before lookup", () => {
    expect(canPerformAction("senior", "  BaN  ")).toEqual({
      allowed: true,
      reason: "✅ El rol «senior» puede ejecutar «ban».",
      requiredRole: "senior",
    });
  });

  it("treats an empty action as unknown", () => {
    expect(canPerformAction("owner", "   ")).toEqual({
      allowed: false,
      reason: "⛔ Acción desconocida «»: bloqueada por seguridad.",
      requiredRole: undefined,
    });
  });

  it("is deterministic across repeated calls", () => {
    const first = canPerformAction("senior", "ban");
    const second = canPerformAction("senior", "ban");
    expect(first).toEqual(second);
  });
});
