import { describe, expect, it } from "vitest";
import {
  type MediationState,
  mediationStateLabel,
  nextMediationStep,
} from "./async-mediation.js";

describe("nextMediationStep", () => {
  it("moves from abierta to esperando_b when party A submits first", () => {
    expect(nextMediationStep("abierta", "version_a")).toEqual({
      next: "esperando_b",
      changed: true,
    });
  });

  it("moves from abierta to esperando_a when party B submits first", () => {
    expect(nextMediationStep("abierta", "version_b")).toEqual({
      next: "esperando_a",
      changed: true,
    });
  });

  it("reaches lista_revision only after both versions arrive", () => {
    const afterA = nextMediationStep("abierta", "version_a");
    expect(afterA.next).toBe("esperando_b");
    const afterB = nextMediationStep(afterA.next, "version_b");
    expect(afterB).toEqual({ next: "lista_revision", changed: true });
  });

  it("ignores a duplicate version from the same party", () => {
    expect(nextMediationStep("esperando_b", "version_a")).toEqual({
      next: "esperando_b",
      changed: false,
    });
  });

  it("cannot be reviewed before both versions are in", () => {
    expect(nextMediationStep("abierta", "revisar")).toEqual({
      next: "abierta",
      changed: false,
    });
    expect(nextMediationStep("esperando_a", "revisar")).toEqual({
      next: "esperando_a",
      changed: false,
    });
  });

  it("closes from lista_revision when staff reviews", () => {
    expect(nextMediationStep("lista_revision", "revisar")).toEqual({
      next: "cerrada",
      changed: true,
    });
  });

  it("can be closed early from any open state", () => {
    expect(nextMediationStep("abierta", "cerrar")).toEqual({
      next: "cerrada",
      changed: true,
    });
    expect(nextMediationStep("esperando_b", "cerrar")).toEqual({
      next: "cerrada",
      changed: true,
    });
  });

  it("treats a closed case as terminal for every event", () => {
    const events = ["version_a", "version_b", "revisar", "cerrar"] as const;
    for (const event of events) {
      expect(nextMediationStep("cerrada", event)).toEqual({
        next: "cerrada",
        changed: false,
      });
    }
  });

  it("is deterministic for repeated identical calls", () => {
    const first = nextMediationStep("esperando_a", "version_a");
    const second = nextMediationStep("esperando_a", "version_a");
    expect(first).toEqual(second);
    expect(first).toEqual({ next: "lista_revision", changed: true });
  });

  it("runs a full happy-path flow end to end", () => {
    let state: MediationState = "abierta";
    state = nextMediationStep(state, "version_a").next;
    state = nextMediationStep(state, "version_b").next;
    state = nextMediationStep(state, "revisar").next;
    expect(state).toBe("cerrada");
  });
});

describe("mediationStateLabel", () => {
  it("returns accented Spanish labels for each state", () => {
    expect(mediationStateLabel("abierta")).toContain("Mediación");
    expect(mediationStateLabel("lista_revision")).toContain("revisión");
    expect(mediationStateLabel("cerrada")).toBe("✅ Mediación cerrada");
  });
});
