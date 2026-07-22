import { describe, expect, it } from "vitest";
import { grantEmergencyPermission } from "./emergency-perms.js";

describe("grantEmergencyPermission", () => {
  it("grants a helper temporary powers only while a raid is active", () => {
    expect(
      grantEmergencyPermission({ role: "helper", raidActive: true }),
    ).toEqual({
      granted: true,
      scope: "🛡️ Permisos temporales de emergencia durante el raid",
    });
  });

  it("denies a helper when no raid is active", () => {
    expect(
      grantEmergencyPermission({ role: "helper", raidActive: false }),
    ).toEqual({
      granted: false,
      scope: "Sin permisos: no hay ningun raid activo ahora mismo",
    });
  });

  it("always grants a mod moderation scope during a raid", () => {
    expect(grantEmergencyPermission({ role: "mod", raidActive: true })).toEqual(
      {
        granted: true,
        scope: "Permisos permanentes de moderacion",
      },
    );
  });

  it("always grants a mod moderation scope with no raid", () => {
    expect(
      grantEmergencyPermission({ role: "mod", raidActive: false }),
    ).toEqual({
      granted: true,
      scope: "Permisos permanentes de moderacion",
    });
  });

  it("always grants an admin administration scope during a raid", () => {
    expect(
      grantEmergencyPermission({ role: "admin", raidActive: true }),
    ).toEqual({
      granted: true,
      scope: "Permisos permanentes de administracion",
    });
  });

  it("always grants an admin administration scope with no raid", () => {
    expect(
      grantEmergencyPermission({ role: "admin", raidActive: false }),
    ).toEqual({
      granted: true,
      scope: "Permisos permanentes de administracion",
    });
  });

  it("differentiates helper outcome by the raid flag", () => {
    const during = grantEmergencyPermission({
      role: "helper",
      raidActive: true,
    });
    const idle = grantEmergencyPermission({
      role: "helper",
      raidActive: false,
    });
    expect(during.granted).toBe(true);
    expect(idle.granted).toBe(false);
    expect(during.scope).not.toBe(idle.scope);
  });

  it("is deterministic for repeated identical input", () => {
    const first = grantEmergencyPermission({
      role: "helper",
      raidActive: true,
    });
    const second = grantEmergencyPermission({
      role: "helper",
      raidActive: true,
    });
    expect(first).toEqual(second);
  });

  it("never returns an empty scope for any role and raid combination", () => {
    const roles = ["helper", "mod", "admin"] as const;
    for (const role of roles) {
      for (const raidActive of [true, false]) {
        expect(
          grantEmergencyPermission({ role, raidActive }).scope.length,
        ).toBeGreaterThan(0);
      }
    }
  });
});
