import { describe, expect, it } from "vitest";
import { suggestPrivilegeReduction } from "./least-privilege.js";

describe("suggestPrivilegeReduction", () => {
  it("flags granted permissions that are never used, in granted order", () => {
    expect(
      suggestPrivilegeReduction(
        ["ban", "mute", "pin", "delete"],
        ["ban", "pin"],
      ),
    ).toEqual({
      unused: ["mute", "delete"],
      advice:
        "⚠️ Se recomienda quitar 2 permisos sin usar: mute, delete. Aplica el principio de mínimos privilegios para reducir la superficie de ataque.",
    });
  });

  it("returns no suggestion when every granted permission is used", () => {
    expect(
      suggestPrivilegeReduction(["ban", "pin"], ["ban", "pin", "extra"]),
    ).toEqual({
      unused: [],
      advice:
        "✅ No hay permisos sin usar; ya se aplica el principio de mínimos privilegios.",
    });
  });

  it("uses the singular noun for a single unused permission", () => {
    expect(suggestPrivilegeReduction(["ban"], [])).toEqual({
      unused: ["ban"],
      advice:
        "⚠️ Se recomienda quitar 1 permiso sin usar: ban. Aplica el principio de mínimos privilegios para reducir la superficie de ataque.",
    });
  });

  it("deduplicates repeated granted permissions", () => {
    expect(suggestPrivilegeReduction(["a", "a", "b"], [])).toEqual({
      unused: ["a", "b"],
      advice:
        "⚠️ Se recomienda quitar 2 permisos sin usar: a, b. Aplica el principio de mínimos privilegios para reducir la superficie de ataque.",
    });
  });

  it("skips duplicates that are covered by the used list", () => {
    expect(suggestPrivilegeReduction(["ban", "ban", "mute"], ["ban"])).toEqual({
      unused: ["mute"],
      advice:
        "⚠️ Se recomienda quitar 1 permiso sin usar: mute. Aplica el principio de mínimos privilegios para reducir la superficie de ataque.",
    });
  });

  it("handles empty granted input", () => {
    expect(suggestPrivilegeReduction([], ["ban"])).toEqual({
      unused: [],
      advice:
        "✅ No hay permisos sin usar; ya se aplica el principio de mínimos privilegios.",
    });
  });

  it("handles undefined granted input", () => {
    expect(suggestPrivilegeReduction(undefined, ["ban"])).toEqual({
      unused: [],
      advice:
        "✅ No hay permisos sin usar; ya se aplica el principio de mínimos privilegios.",
    });
  });

  it("handles undefined used input by treating all granted as unused", () => {
    expect(suggestPrivilegeReduction(["ban", "mute"], undefined)).toEqual({
      unused: ["ban", "mute"],
      advice:
        "⚠️ Se recomienda quitar 2 permisos sin usar: ban, mute. Aplica el principio de mínimos privilegios para reducir la superficie de ataque.",
    });
  });

  it("treats permission tokens case-sensitively", () => {
    expect(suggestPrivilegeReduction(["Ban"], ["ban"])).toEqual({
      unused: ["Ban"],
      advice:
        "⚠️ Se recomienda quitar 1 permiso sin usar: Ban. Aplica el principio de mínimos privilegios para reducir la superficie de ataque.",
    });
  });

  it("is deterministic across repeated calls with the same inputs", () => {
    const granted = ["read", "write", "admin"];
    const used = ["read"];
    const first = suggestPrivilegeReduction(granted, used);
    const second = suggestPrivilegeReduction(granted, used);
    expect(first).toEqual(second);
    expect(first.unused).toEqual(["write", "admin"]);
  });
});
