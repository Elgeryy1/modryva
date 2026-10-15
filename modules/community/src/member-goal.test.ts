import { describe, expect, it } from "vitest";
import { mapMemberGoalToOnboarding } from "./member-goal.js";

describe("mapMemberGoalToOnboarding", () => {
  it("maps the aprender goal to a learning focus", () => {
    const result = mapMemberGoalToOnboarding("aprender");
    expect(result.focus).toBe("Aprender");
    expect(result.tips.length).toBeGreaterThan(0);
  });

  it("maps the vender goal to a selling focus", () => {
    expect(mapMemberGoalToOnboarding("vender").focus).toBe("Vender");
  });

  it("maps otro to a general focus", () => {
    expect(mapMemberGoalToOnboarding("otro").focus).toBe("General");
  });

  it("is deterministic", () => {
    expect(mapMemberGoalToOnboarding("soporte")).toEqual(
      mapMemberGoalToOnboarding("soporte"),
    );
  });
});
