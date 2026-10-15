import { describe, expect, it } from "vitest";
import {
  computePulseTension,
  computeSocialPulse,
  describePulse,
  PULSE_ACTIVITY_ACTIVE,
  PULSE_ACTIVITY_HIGH,
  PULSE_TENSION_THRESHOLD,
  type PulseWindow,
} from "./social-pulse.js";

const win = (overrides: Partial<PulseWindow> = {}): PulseWindow => ({
  messages: 0,
  deletions: 0,
  cases: 0,
  uniqueUsers: 0,
  replies: 0,
  ...overrides,
});

describe("computePulseTension", () => {
  it("is 0 when there are no messages", () => {
    expect(computePulseTension(win({ deletions: 3, cases: 2 }))).toBe(0);
  });

  it("combines deletions and cases relative to messages", () => {
    expect(
      computePulseTension(win({ messages: 100, deletions: 15, cases: 10 })),
    ).toBe(0.25);
  });

  it("clamps tension to a maximum of 1", () => {
    expect(
      computePulseTension(win({ messages: 4, deletions: 10, cases: 10 })),
    ).toBe(1);
  });

  it("treats negative counts as zero", () => {
    expect(
      computePulseTension(win({ messages: 20, deletions: -5, cases: -3 })),
    ).toBe(0);
  });

  it("rounds to 4 decimals for stable output", () => {
    expect(
      computePulseTension(win({ messages: 3, deletions: 1, cases: 0 })),
    ).toBe(0.3333);
  });

  it("returns 0 for non-finite message counts", () => {
    expect(
      computePulseTension(
        win({ messages: Number.NaN, deletions: 5, cases: 5 }),
      ),
    ).toBe(0);
  });
});

describe("computeSocialPulse", () => {
  it("reports tranquilo with an empty window", () => {
    const pulse = computeSocialPulse(win());
    expect(pulse.state).toBe("tranquilo");
    expect(pulse.tensionScore).toBe(0);
  });

  it("reports tranquilo for low activity with low tension", () => {
    const pulse = computeSocialPulse(
      win({ messages: PULSE_ACTIVITY_ACTIVE - 1, uniqueUsers: 3 }),
    );
    expect(pulse.state).toBe("tranquilo");
  });

  it("reports activo for moderate activity and low tension", () => {
    const pulse = computeSocialPulse(
      win({ messages: PULSE_ACTIVITY_ACTIVE, deletions: 0, uniqueUsers: 5 }),
    );
    expect(pulse.state).toBe("activo");
  });

  it("reports saturado for high activity with low tension", () => {
    const pulse = computeSocialPulse(
      win({ messages: PULSE_ACTIVITY_HIGH, deletions: 1, cases: 0 }),
    );
    expect(pulse.state).toBe("saturado");
    expect(pulse.tensionScore).toBeLessThan(PULSE_TENSION_THRESHOLD);
  });

  it("reports tenso for high tension with low activity", () => {
    const pulse = computeSocialPulse(
      win({ messages: 8, deletions: 3, cases: 1 }),
    );
    expect(pulse.state).toBe("tenso");
    expect(pulse.tensionScore).toBeGreaterThanOrEqual(PULSE_TENSION_THRESHOLD);
  });

  it("reports caotico for high tension and high activity together", () => {
    const pulse = computeSocialPulse(
      win({ messages: 80, deletions: 20, cases: 10, uniqueUsers: 30 }),
    );
    expect(pulse.state).toBe("caotico");
    expect(pulse.tensionScore).toBeGreaterThanOrEqual(PULSE_TENSION_THRESHOLD);
  });

  it("uses the tension threshold as an inclusive boundary", () => {
    const pulse = computeSocialPulse(
      win({ messages: 100, deletions: 25, cases: 0 }),
    );
    expect(pulse.tensionScore).toBe(PULSE_TENSION_THRESHOLD);
    expect(pulse.state).toBe("tenso");
  });

  it("includes the tension percentage in the label", () => {
    const pulse = computeSocialPulse(
      win({ messages: 80, deletions: 20, cases: 10 }),
    );
    expect(pulse.label).toContain("Caotico");
    expect(pulse.label).toContain("%");
  });

  it("is deterministic for identical inputs", () => {
    const w = win({ messages: 40, deletions: 5, cases: 2, uniqueUsers: 12 });
    expect(computeSocialPulse(w)).toEqual(computeSocialPulse(w));
  });
});

describe("describePulse", () => {
  it("describes every known state distinctly", () => {
    const states = ["tranquilo", "activo", "saturado", "tenso", "caotico"];
    const texts = states.map((s) => describePulse(s));
    expect(new Set(texts).size).toBe(states.length);
    for (const text of texts) {
      expect(text.length).toBeGreaterThan(0);
    }
  });

  it("returns a generic text for an unknown state", () => {
    expect(describePulse("desconocido")).toBe("Estado de pulso desconocido.");
  });
});
