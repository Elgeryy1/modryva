import { describe, expect, it } from "vitest";
import {
  distinctRoles,
  filterRulesByRole,
  type RoleRule,
} from "./role-rules-view.js";

const RULES: readonly RoleRule[] = [
  { text: "🚫 No hagas spam", roles: [] },
  { text: "🤝 Ayuda a los nuevos miembros", roles: ["staff", "helper"] },
  { text: "🛡️ Modera los reportes", roles: ["staff"] },
  { text: "📖 Lee la guía de bienvenida", roles: ["nuevo"] },
];

describe("filterRulesByRole", () => {
  it("returns universal plus staff-specific rules for staff", () => {
    expect(filterRulesByRole(RULES, "staff")).toEqual([
      "🚫 No hagas spam",
      "🤝 Ayuda a los nuevos miembros",
      "🛡️ Modera los reportes",
    ]);
  });

  it("returns universal plus role-specific rules for a newcomer", () => {
    expect(filterRulesByRole(RULES, "nuevo")).toEqual([
      "🚫 No hagas spam",
      "📖 Lee la guía de bienvenida",
    ]);
  });

  it("returns only universal rules for an unknown role", () => {
    expect(filterRulesByRole(RULES, "miembro")).toEqual(["🚫 No hagas spam"]);
  });

  it("matches roles case-insensitively", () => {
    expect(filterRulesByRole(RULES, "STAFF")).toEqual([
      "🚫 No hagas spam",
      "🤝 Ayuda a los nuevos miembros",
      "🛡️ Modera los reportes",
    ]);
  });

  it("trims surrounding whitespace in the queried role", () => {
    expect(filterRulesByRole(RULES, "  helper  ")).toEqual([
      "🚫 No hagas spam",
      "🤝 Ayuda a los nuevos miembros",
    ]);
  });

  it("returns an empty array when there are no rules", () => {
    expect(filterRulesByRole([], "staff")).toEqual([]);
  });

  it("still returns universal rules for an empty queried role", () => {
    expect(filterRulesByRole(RULES, "")).toEqual(["🚫 No hagas spam"]);
  });

  it("is deterministic and does not mutate its inputs", () => {
    const first = filterRulesByRole(RULES, "staff");
    const second = filterRulesByRole(RULES, "staff");
    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    expect(RULES).toHaveLength(4);
  });
});

describe("distinctRoles", () => {
  it("lists normalized roles in first-seen order without duplicates", () => {
    const rules: readonly RoleRule[] = [
      { text: "a", roles: ["Staff", " STAFF ", "Helper"] },
      { text: "b", roles: ["helper", "Nuevo"] },
    ];
    expect(distinctRoles(rules)).toEqual(["staff", "helper", "nuevo"]);
  });

  it("ignores blank and whitespace-only role tags", () => {
    const rules: readonly RoleRule[] = [
      { text: "x", roles: ["", "   ", "vip"] },
    ];
    expect(distinctRoles(rules)).toEqual(["vip"]);
  });

  it("returns an empty array for no rules or only universal rules", () => {
    expect(distinctRoles([])).toEqual([]);
    expect(distinctRoles([{ text: "todos", roles: [] }])).toEqual([]);
  });
});
