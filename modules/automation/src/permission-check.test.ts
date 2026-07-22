import { describe, expect, it } from "vitest";
import {
  checkBotPermissions,
  formatPermissionNotice,
} from "./permission-check.js";

describe("checkBotPermissions", () => {
  it("reports ok when every required permission is held", () => {
    expect(
      checkBotPermissions(
        ["can_delete_messages", "can_restrict_members"],
        ["can_delete_messages"],
      ),
    ).toEqual({ ok: true, missing: [] });
  });

  it("lists missing permissions in required order", () => {
    expect(
      checkBotPermissions(
        ["can_delete_messages"],
        ["can_restrict_members", "can_delete_messages", "can_pin_messages"],
      ),
    ).toEqual({
      ok: false,
      missing: ["can_restrict_members", "can_pin_messages"],
    });
  });

  it("returns ok for an empty required list", () => {
    expect(checkBotPermissions([], [])).toEqual({ ok: true, missing: [] });
  });

  it("marks all required missing when current is empty", () => {
    expect(
      checkBotPermissions([], ["can_pin_messages", "can_invite_users"]),
    ).toEqual({
      ok: false,
      missing: ["can_pin_messages", "can_invite_users"],
    });
  });

  it("deduplicates repeated missing permissions", () => {
    expect(
      checkBotPermissions(
        [],
        ["can_pin_messages", "can_pin_messages", "can_invite_users"],
      ),
    ).toEqual({ ok: false, missing: ["can_pin_messages", "can_invite_users"] });
  });

  it("ignores blank and whitespace-only required entries", () => {
    expect(
      checkBotPermissions(
        ["can_delete_messages"],
        ["", "   ", "can_delete_messages"],
      ),
    ).toEqual({
      ok: true,
      missing: [],
    });
  });

  it("is case-sensitive when matching permission names", () => {
    expect(
      checkBotPermissions(["Can_Delete_Messages"], ["can_delete_messages"]),
    ).toEqual({
      ok: false,
      missing: ["can_delete_messages"],
    });
  });

  it("preserves order deterministically regardless of current order", () => {
    const required = ["a", "b", "c"];
    const first = checkBotPermissions(["c", "a"], required);
    const second = checkBotPermissions(["a", "c"], required);
    expect(first).toEqual({ ok: false, missing: ["b"] });
    expect(second).toEqual(first);
  });
});

describe("formatPermissionNotice", () => {
  it("formats a success notice with accents", () => {
    expect(formatPermissionNotice({ ok: true, missing: [] })).toBe(
      "✅ Verificacion diaria: el bot tiene todos los permisos necesarios.",
    );
  });

  it("formats a warning notice listing missing permissions", () => {
    expect(
      formatPermissionNotice({
        ok: false,
        missing: ["can_pin_messages", "can_invite_users"],
      }),
    ).toBe(
      "⚠️ Verificacion diaria: faltan 2 permiso(s): can_pin_messages, can_invite_users.",
    );
  });
});
