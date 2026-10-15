import { describe, expect, it } from "vitest";
import { detectHighLatency } from "./latency-monitor.js";

describe("detectHighLatency", () => {
  it("returns modules over the default threshold sorted by latency desc", () => {
    expect(
      detectHighLatency([
        { name: "a", latencyMs: 500 },
        { name: "b", latencyMs: 1500 },
        { name: "c", latencyMs: 2000 },
      ]),
    ).toEqual([
      { name: "c", latencyMs: 2000 },
      { name: "b", latencyMs: 1500 },
    ]);
  });

  it("breaks latency ties by name ascending", () => {
    expect(
      detectHighLatency([
        { name: "z", latencyMs: 1500 },
        { name: "a", latencyMs: 1500 },
      ]),
    ).toEqual([
      { name: "a", latencyMs: 1500 },
      { name: "z", latencyMs: 1500 },
    ]);
  });

  it("honors a custom threshold", () => {
    expect(
      detectHighLatency([{ name: "a", latencyMs: 200 }], { thresholdMs: 100 }),
    ).toEqual([{ name: "a", latencyMs: 200 }]);
  });

  it("excludes modules at or below the threshold", () => {
    expect(detectHighLatency([{ name: "a", latencyMs: 1000 }])).toEqual([]);
  });

  it("returns empty for empty input", () => {
    expect(detectHighLatency([])).toEqual([]);
  });

  it("does not mutate the input", () => {
    const input = [
      { name: "b", latencyMs: 1500 },
      { name: "a", latencyMs: 2000 },
    ];
    const snapshot = JSON.parse(JSON.stringify(input));
    detectHighLatency(input);
    expect(input).toEqual(snapshot);
  });
});
