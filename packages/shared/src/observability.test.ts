import { describe, expect, it } from "vitest";
import {
  computeChecksum,
  evaluateReadiness,
  formatPrometheusMetrics,
  MetricsRegistry,
  verifyChecksum,
} from "./observability.js";

describe("formatPrometheusMetrics", () => {
  it("renders HELP/TYPE/value lines", () => {
    const text = formatPrometheusMetrics([
      { name: "superbot_updates_total", help: "Updates", value: 7 },
    ]);
    expect(text).toContain("# HELP superbot_updates_total Updates");
    expect(text).toContain("# TYPE superbot_updates_total counter");
    expect(text).toContain("superbot_updates_total 7");
  });
});

describe("MetricsRegistry", () => {
  it("increments and snapshots counters", () => {
    const registry = new MetricsRegistry();
    registry.increment("a");
    registry.increment("a", 4);
    registry.increment("b");
    expect(registry.get("a")).toBe(5);
    const snapshot = registry.snapshot({ a: "A counter" });
    expect(snapshot).toContainEqual({ name: "a", help: "A counter", value: 5 });
  });
});

describe("evaluateReadiness", () => {
  it("is ready only when all checks pass", () => {
    expect(
      evaluateReadiness([
        { name: "db", ok: true },
        { name: "token", ok: true },
      ]).ready,
    ).toBe(true);
    expect(
      evaluateReadiness([
        { name: "db", ok: true },
        { name: "token", ok: false },
      ]).ready,
    ).toBe(false);
  });
});

describe("checksums", () => {
  it("computes and verifies a stable checksum", () => {
    const checksum = computeChecksum("backup-content");
    expect(verifyChecksum("backup-content", checksum)).toBe(true);
    expect(verifyChecksum("tampered", checksum)).toBe(false);
  });
});
