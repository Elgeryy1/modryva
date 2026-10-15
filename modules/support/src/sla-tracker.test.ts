import { describe, expect, it } from "vitest";
import {
  evaluateSla,
  SLA_DEFAULT_TARGETS,
  SLA_ESCALATION_FACTOR,
  type SlaItem,
  type SlaSeverity,
} from "./sla-tracker.js";

const MINUTE = 60_000;

const item = (overrides: Partial<SlaItem> = {}): SlaItem => ({
  openedMs: 0,
  severity: "media",
  ...overrides,
});

describe("SLA_DEFAULT_TARGETS", () => {
  it("orders targets by urgency (alta < media < baja)", () => {
    const alta = SLA_DEFAULT_TARGETS.alta ?? 0;
    const media = SLA_DEFAULT_TARGETS.media ?? 0;
    const baja = SLA_DEFAULT_TARGETS.baja ?? 0;
    expect(alta).toBeLessThan(media);
    expect(media).toBeLessThan(baja);
  });

  it("is frozen to be safe as a shared fallback", () => {
    expect(Object.isFrozen(SLA_DEFAULT_TARGETS)).toBe(true);
  });
});

describe("evaluateSla with unresponded items", () => {
  it("does not breach while within the target", () => {
    const result = evaluateSla(
      item({ severity: "media", openedMs: 0 }),
      30 * MINUTE,
      SLA_DEFAULT_TARGETS,
    );
    expect(result.breached).toBe(false);
    expect(result.escalate).toBe(false);
    expect(result.reason).toContain("dentro del objetivo");
  });

  it("breaches without escalating when past the target but under escalation", () => {
    const result = evaluateSla(
      item({ severity: "media", openedMs: 0 }),
      90 * MINUTE,
      SLA_DEFAULT_TARGETS,
    );
    expect(result.breached).toBe(true);
    expect(result.escalate).toBe(false);
    expect(result.reason).toContain("superando el objetivo");
  });

  it("escalates when the wait exceeds target * factor", () => {
    const result = evaluateSla(
      item({ severity: "media", openedMs: 0 }),
      3 * 60 * MINUTE,
      SLA_DEFAULT_TARGETS,
    );
    expect(result.breached).toBe(true);
    expect(result.escalate).toBe(true);
    expect(result.reason).toContain("umbral de escalado");
  });

  it("uses the stricter target for alta severity", () => {
    const alta = evaluateSla(
      item({ severity: "alta", openedMs: 0 }),
      20 * MINUTE,
      SLA_DEFAULT_TARGETS,
    );
    // 20m > 15m target for alta -> breached; 20m < 30m escalation -> no escalate
    expect(alta.breached).toBe(true);
    expect(alta.escalate).toBe(false);
  });

  it("does not breach exactly at the target boundary", () => {
    const target = SLA_DEFAULT_TARGETS.media ?? 0;
    const result = evaluateSla(
      item({ severity: "media", openedMs: 0 }),
      target,
      SLA_DEFAULT_TARGETS,
    );
    expect(result.breached).toBe(false);
  });

  it("does not escalate exactly at the escalation boundary", () => {
    const target = SLA_DEFAULT_TARGETS.media ?? 0;
    const result = evaluateSla(
      item({ severity: "media", openedMs: 0 }),
      target * SLA_ESCALATION_FACTOR,
      SLA_DEFAULT_TARGETS,
    );
    expect(result.breached).toBe(true);
    expect(result.escalate).toBe(false);
  });

  it("treats a not-yet-opened item (negative wait) as within target", () => {
    const result = evaluateSla(
      item({ severity: "baja", openedMs: 10 * MINUTE }),
      5 * MINUTE,
      SLA_DEFAULT_TARGETS,
    );
    expect(result.breached).toBe(false);
    expect(result.escalate).toBe(false);
  });
});

describe("evaluateSla with responded items", () => {
  it("never escalates an already responded item", () => {
    const result = evaluateSla(
      item({
        severity: "alta",
        openedMs: 0,
        firstResponseMs: 10 * 60 * MINUTE,
      }),
      100 * 60 * MINUTE,
      SLA_DEFAULT_TARGETS,
    );
    expect(result.escalate).toBe(false);
    expect(result.breached).toBe(true);
  });

  it("does not breach when responded within the target", () => {
    const result = evaluateSla(
      item({ severity: "media", openedMs: 0, firstResponseMs: 10 * MINUTE }),
      999 * MINUTE,
      SLA_DEFAULT_TARGETS,
    );
    expect(result.breached).toBe(false);
    expect(result.reason).toContain("dentro del objetivo");
  });

  it("breaches when the response time exceeds the target", () => {
    const result = evaluateSla(
      item({ severity: "media", openedMs: 0, firstResponseMs: 90 * MINUTE }),
      0,
      SLA_DEFAULT_TARGETS,
    );
    expect(result.breached).toBe(true);
    expect(result.escalate).toBe(false);
    expect(result.reason).toContain("Respondido en");
  });

  it("ignores nowMs entirely once responded (uses response time only)", () => {
    const responded = item({
      severity: "media",
      openedMs: 0,
      firstResponseMs: 10 * MINUTE,
    });
    const early = evaluateSla(responded, 0, SLA_DEFAULT_TARGETS);
    const late = evaluateSla(responded, 10 * 60 * MINUTE, SLA_DEFAULT_TARGETS);
    expect(early).toEqual(late);
  });
});

describe("evaluateSla with missing or invalid targets", () => {
  it("does not breach when the severity has no target", () => {
    const result = evaluateSla(
      item({ severity: "media", openedMs: 0 }),
      999 * MINUTE,
      { alta: 10 * MINUTE },
    );
    expect(result.breached).toBe(false);
    expect(result.escalate).toBe(false);
    expect(result.reason).toContain("Sin objetivo SLA definido");
  });

  it("does not breach for a negative or non-finite target", () => {
    const negative = evaluateSla(
      item({ severity: "media", openedMs: 0 }),
      999 * MINUTE,
      { media: -1 },
    );
    const infinite = evaluateSla(
      item({ severity: "media", openedMs: 0 }),
      999 * MINUTE,
      { media: Number.POSITIVE_INFINITY },
    );
    expect(negative.breached).toBe(false);
    expect(infinite.breached).toBe(false);
  });

  it("honors a custom targets map over the defaults", () => {
    const result = evaluateSla(
      item({ severity: "baja", openedMs: 0 }),
      5 * MINUTE,
      { baja: MINUTE },
    );
    expect(result.breached).toBe(true);
  });
});

describe("evaluateSla determinism", () => {
  it("returns identical results for identical inputs", () => {
    const sample = item({
      severity: "alta",
      openedMs: 1_000,
      firstResponseMs: 2_000,
    });
    expect(evaluateSla(sample, 5_000, SLA_DEFAULT_TARGETS)).toEqual(
      evaluateSla(sample, 5_000, SLA_DEFAULT_TARGETS),
    );
  });

  it("evaluates every severity without throwing", () => {
    const severities: readonly SlaSeverity[] = ["baja", "media", "alta"];
    for (const severity of severities) {
      const result = evaluateSla(
        item({ severity, openedMs: 0 }),
        10 * MINUTE,
        SLA_DEFAULT_TARGETS,
      );
      expect(typeof result.reason).toBe("string");
      expect(typeof result.breached).toBe("boolean");
      expect(typeof result.escalate).toBe("boolean");
    }
  });
});
