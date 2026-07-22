import { describe, expect, it } from "vitest";
import {
  describeEscalation,
  ESCALATION_LADDER,
  type EscalationStep,
  nextEscalation,
} from "./escalation-ladder.js";

const MINUTE_MS = 60_000;

describe("ESCALATION_LADDER", () => {
  it("has the three steps aviso -> mute -> ban in order", () => {
    expect(ESCALATION_LADDER.map((step) => step.action)).toEqual([
      "aviso",
      "mute",
      "ban",
    ]);
  });

  it("only the mute step carries a durationMs", () => {
    const withDuration = ESCALATION_LADDER.filter(
      (step) => step.durationMs !== undefined,
    );
    expect(withDuration).toHaveLength(1);
    const mute = withDuration[0] ?? { action: "aviso" as const };
    expect(mute.action).toBe("mute");
  });

  it("uses a positive mute duration", () => {
    const mute = ESCALATION_LADDER[1] ?? { action: "mute" as const };
    expect(mute.durationMs).toBe(60 * MINUTE_MS);
  });
});

describe("nextEscalation", () => {
  it("returns aviso for the first offense (0 priors)", () => {
    expect(nextEscalation(0)).toEqual({ action: "aviso" });
  });

  it("returns a temporary mute for the second offense (1 prior)", () => {
    expect(nextEscalation(1)).toEqual({
      action: "mute",
      durationMs: 60 * MINUTE_MS,
    });
  });

  it("returns ban for the third offense (2 priors)", () => {
    expect(nextEscalation(2)).toEqual({ action: "ban" });
  });

  it("keeps banning for any further offenses", () => {
    expect(nextEscalation(3)).toEqual({ action: "ban" });
    expect(nextEscalation(50)).toEqual({ action: "ban" });
  });

  it("never leaks durationMs on aviso or ban steps", () => {
    expect("durationMs" in nextEscalation(0)).toBe(false);
    expect("durationMs" in nextEscalation(2)).toBe(false);
  });

  it("treats negative priors as the first offense", () => {
    expect(nextEscalation(-1)).toEqual({ action: "aviso" });
    expect(nextEscalation(-999)).toEqual({ action: "aviso" });
  });

  it("floors non-integer priors", () => {
    expect(nextEscalation(1.9)).toEqual({
      action: "mute",
      durationMs: 60 * MINUTE_MS,
    });
    expect(nextEscalation(2.1)).toEqual({ action: "ban" });
  });

  it("treats NaN and Infinity as the first offense or last step safely", () => {
    expect(nextEscalation(Number.NaN)).toEqual({ action: "aviso" });
    expect(nextEscalation(Number.POSITIVE_INFINITY)).toEqual({ action: "ban" });
  });

  it("is deterministic for identical inputs", () => {
    expect(nextEscalation(1)).toEqual(nextEscalation(1));
    expect(nextEscalation(7)).toEqual(nextEscalation(7));
  });

  it("returns fresh objects that do not alias ladder steps", () => {
    const result: EscalationStep = nextEscalation(1);
    const ladderMute = ESCALATION_LADDER[1] ?? { action: "mute" as const };
    expect(result).not.toBe(ladderMute);
    expect(result).toEqual(ladderMute);
  });
});

describe("describeEscalation", () => {
  it("describes aviso", () => {
    expect(describeEscalation("aviso")).toBe(
      "Aviso: primera infraccion, sin sancion.",
    );
  });

  it("describes mute", () => {
    expect(describeEscalation("mute")).toBe(
      "Silenciado temporalmente por reincidencia.",
    );
  });

  it("describes ban", () => {
    expect(describeEscalation("ban")).toBe(
      "Expulsado por reincidencia repetida.",
    );
  });

  it("falls back to a generic text for unknown actions", () => {
    expect(describeEscalation("nuke")).toBe("Accion de escalada desconocida.");
    expect(describeEscalation("")).toBe("Accion de escalada desconocida.");
  });

  it("describes the action returned by nextEscalation", () => {
    expect(describeEscalation(nextEscalation(0).action)).toBe(
      "Aviso: primera infraccion, sin sancion.",
    );
    expect(describeEscalation(nextEscalation(2).action)).toBe(
      "Expulsado por reincidencia repetida.",
    );
  });
});
