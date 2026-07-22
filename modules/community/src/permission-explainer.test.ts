import { describe, expect, it } from "vitest";
import {
  explainPermission,
  listKnownPermissions,
} from "./permission-explainer.js";

describe("explainPermission", () => {
  it("explains can_delete_messages with a real example", () => {
    const result = explainPermission("can_delete_messages");
    expect(result.known).toBe(true);
    expect(result.title).toBe("🗑️ Eliminar mensajes");
    expect(result.explanation).toContain("borrar cualquier mensaje");
  });

  it("explains can_restrict_members", () => {
    const result = explainPermission("can_restrict_members");
    expect(result.known).toBe(true);
    expect(result.title).toBe("🔇 Restringir miembros");
  });

  it("is case-insensitive and trims whitespace", () => {
    expect(explainPermission("  CAN_PIN_MESSAGES  ")).toEqual({
      known: true,
      title: "📌 Fijar mensajes",
      explanation:
        "Permite anclar un mensaje en la parte superior del chat para que todos lo vean. Ejemplo: se fijan las reglas del grupo para que nadie las pase por alto.",
    });
  });

  it("accepts a key without the can_ prefix", () => {
    expect(explainPermission("invite_users")).toEqual(
      explainPermission("can_invite_users"),
    );
  });

  it("explains can_change_info", () => {
    const result = explainPermission("can_change_info");
    expect(result.known).toBe(true);
    expect(result.title).toBe("✏️ Cambiar informacion");
  });

  it("returns a generic result for an unknown permission", () => {
    const result = explainPermission("can_do_magic");
    expect(result.known).toBe(false);
    expect(result.title).toBe("❓ Permiso desconocido");
  });

  it("handles undefined input", () => {
    const result = explainPermission(undefined);
    expect(result.known).toBe(false);
    expect(result.title).toBe("❓ Permiso desconocido");
  });

  it("handles empty and whitespace-only input", () => {
    expect(explainPermission("").known).toBe(false);
    expect(explainPermission("   ").known).toBe(false);
  });

  it("is deterministic for repeated calls", () => {
    expect(explainPermission("can_pin_messages")).toEqual(
      explainPermission("can_pin_messages"),
    );
  });

  it("lists all known permissions in alphabetical order", () => {
    expect(listKnownPermissions()).toEqual([
      "can_change_info",
      "can_delete_messages",
      "can_invite_users",
      "can_pin_messages",
      "can_restrict_members",
    ]);
  });

  it("only returns known: true for keys in the list", () => {
    for (const key of listKnownPermissions()) {
      expect(explainPermission(key).known).toBe(true);
    }
  });
});
