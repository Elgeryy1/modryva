import { describe, expect, it } from "vitest";
import { validateRoleMenu } from "./role-menu-validation.js";

const menu = [
  { command: "start", allowedRoles: [] },
  { command: "ban", allowedRoles: ["admin"] },
  { command: "note", allowedRoles: ["admin", "helper"] },
];

describe("validateRoleMenu", () => {
  it("shows public and role-matching commands to a helper", () => {
    expect(validateRoleMenu(menu, "helper")).toEqual({
      visible: ["start", "note"],
      hidden: ["ban"],
    });
  });

  it("shows all admin commands to an admin", () => {
    expect(validateRoleMenu(menu, "admin")).toEqual({
      visible: ["start", "ban", "note"],
      hidden: [],
    });
  });

  it("shows only public commands to an unknown role", () => {
    expect(validateRoleMenu(menu, "member")).toEqual({
      visible: ["start"],
      hidden: ["ban", "note"],
    });
  });

  it("handles an empty menu", () => {
    expect(validateRoleMenu([], "admin")).toEqual({ visible: [], hidden: [] });
  });
});
