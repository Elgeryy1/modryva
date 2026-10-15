import { describe, expect, it } from "vitest";
import { buildRoleAnnouncements } from "./role-announcements.js";

describe("buildRoleAnnouncements", () => {
  it("tunes the greeting per known role and appends the base", () => {
    expect(
      buildRoleAnnouncements("Evento hoy", ["owner", "staff", "nuevos", "vip"]),
    ).toEqual([
      { role: "owner", text: "👑 Hola, dueño del grupo. Evento hoy" },
      { role: "staff", text: "🛡️ Hola, equipo de moderación. Evento hoy" },
      { role: "nuevos", text: "👋 ¡Bienvenido al grupo! Evento hoy" },
      { role: "vip", text: "⭐ Hola, miembro VIP. Evento hoy" },
    ]);
  });

  it("uses a neutral greeting for unknown roles", () => {
    expect(buildRoleAnnouncements("Aviso", ["random"])).toEqual([
      { role: "random", text: "📣 Atención. Aviso" },
    ]);
  });

  it("matches roles case-insensitively and trimming whitespace", () => {
    expect(buildRoleAnnouncements("X", ["  OWNER  "])).toEqual([
      { role: "  OWNER  ", text: "👑 Hola, dueño del grupo. X" },
    ]);
  });

  it("returns an empty list when no roles are given", () => {
    expect(buildRoleAnnouncements("Hola a todos", [])).toEqual([]);
  });

  it("emits only the greeting when the base is empty", () => {
    expect(buildRoleAnnouncements("", ["vip"])).toEqual([
      { role: "vip", text: "⭐ Hola, miembro VIP." },
    ]);
  });

  it("treats a whitespace-only base as blank", () => {
    expect(buildRoleAnnouncements("   ", ["owner"])).toEqual([
      { role: "owner", text: "👑 Hola, dueño del grupo." },
    ]);
  });

  it("preserves input order and keeps duplicate roles", () => {
    const result = buildRoleAnnouncements("Nota", ["vip", "owner", "vip"]);
    expect(result.map((v) => v.role)).toEqual(["vip", "owner", "vip"]);
    expect(result[0]).toEqual({
      role: "vip",
      text: "⭐ Hola, miembro VIP. Nota",
    });
    expect(result[2]).toEqual({
      role: "vip",
      text: "⭐ Hola, miembro VIP. Nota",
    });
  });

  it("accepts role aliases for the same audience", () => {
    expect(
      buildRoleAnnouncements("Bienvenida", ["new", "moderadores"]),
    ).toEqual([
      { role: "new", text: "👋 ¡Bienvenido al grupo! Bienvenida" },
      { role: "moderadores", text: "🛡️ Hola, equipo de moderación. Bienvenida" },
    ]);
  });

  it("keeps the base message verbatim after the greeting", () => {
    const base = "Recuerden leer las reglas del grupo";
    const [variant] = buildRoleAnnouncements(base, ["staff"]);
    expect(variant?.text).toBe(`🛡️ Hola, equipo de moderación. ${base}`);
  });
});
