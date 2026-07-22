import { describe, expect, it } from "vitest";
import { hasPermission } from "./rbac.js";

describe("rbac", () => {
  it("lets owners write config", () => {
    expect(hasPermission("owner", "config.write")).toBe(true);
  });

  it("does not give members moderation permissions", () => {
    expect(hasPermission("member", "moderation.write")).toBe(false);
  });
});
