import { describe, expect, it } from "vitest";
import type { IncidentEvent, IncidentStatus } from "./incident-status.js";
import { nextIncidentStatus } from "./incident-status.js";

describe("nextIncidentStatus", () => {
  it("moves an open incident to esperando when asking the user for info", () => {
    expect(nextIncidentStatus("abierto", "pedir_info")).toEqual({
      next: "esperando",
      changed: true,
    });
  });

  it("returns to abierto when the user responds while waiting", () => {
    expect(nextIncidentStatus("esperando", "responder")).toEqual({
      next: "abierto",
      changed: true,
    });
  });

  it("resolves an open incident", () => {
    expect(nextIncidentStatus("abierto", "resolver")).toEqual({
      next: "resuelto",
      changed: true,
    });
  });

  it("closes a resolved incident", () => {
    expect(nextIncidentStatus("resuelto", "cerrar")).toEqual({
      next: "cerrado",
      changed: true,
    });
  });

  it("reopens a closed incident back to abierto", () => {
    expect(nextIncidentStatus("cerrado", "reabrir")).toEqual({
      next: "abierto",
      changed: true,
    });
  });

  it("keeps the state when the event is not applicable", () => {
    expect(nextIncidentStatus("cerrado", "resolver")).toEqual({
      next: "cerrado",
      changed: false,
    });
  });

  it("does not change when reopening an already open incident", () => {
    expect(nextIncidentStatus("abierto", "reabrir")).toEqual({
      next: "abierto",
      changed: false,
    });
  });

  it("treats a repeated pedir_info while waiting as a no-op", () => {
    expect(nextIncidentStatus("esperando", "pedir_info")).toEqual({
      next: "esperando",
      changed: false,
    });
  });

  it("is deterministic for repeated identical calls", () => {
    const first = nextIncidentStatus("abierto", "resolver");
    const second = nextIncidentStatus("abierto", "resolver");
    expect(first).toEqual(second);
    expect(first).toEqual({ next: "resuelto", changed: true });
  });

  it("walks a full lifecycle in order to cerrado", () => {
    const events: readonly IncidentEvent[] = [
      "pedir_info",
      "responder",
      "resolver",
      "cerrar",
    ];
    const final = events.reduce<IncidentStatus>(
      (state, event) => nextIncidentStatus(state, event).next,
      "abierto",
    );
    expect(final).toBe("cerrado");
  });

  it("ignores non-applicable events in the middle of a sequence", () => {
    const events: readonly IncidentEvent[] = [
      "pedir_info",
      "pedir_info",
      "responder",
    ];
    const final = events.reduce<IncidentStatus>(
      (state, event) => nextIncidentStatus(state, event).next,
      "abierto",
    );
    expect(final).toBe("abierto");
  });
});
