import { describe, expect, it } from "vitest";
import { type ExternalDep, summarizeExternalDeps } from "./external-deps.js";

describe("summarizeExternalDeps", () => {
  it("reports all healthy for an empty input", () => {
    expect(summarizeExternalDeps([])).toEqual({
      total: 0,
      downCount: 0,
      down: [],
      allHealthy: true,
    });
  });

  it("reports all healthy when every dependency is up", () => {
    const deps: readonly ExternalDep[] = [
      { name: "Telegram API", healthy: true },
      { name: "PostgreSQL", healthy: true },
    ];
    expect(summarizeExternalDeps(deps)).toEqual({
      total: 2,
      downCount: 0,
      down: [],
      allHealthy: true,
    });
  });

  it("collects names of unhealthy dependencies", () => {
    const deps: readonly ExternalDep[] = [
      { name: "Telegram API", healthy: true },
      { name: "Redis", healthy: false },
      { name: "PostgreSQL", healthy: true },
    ];
    expect(summarizeExternalDeps(deps)).toEqual({
      total: 3,
      downCount: 1,
      down: ["Redis"],
      allHealthy: false,
    });
  });

  it("preserves input order in the down list", () => {
    const deps: readonly ExternalDep[] = [
      { name: "Cache", healthy: false },
      { name: "API", healthy: true },
      { name: "Queue", healthy: false },
      { name: "Storage", healthy: false },
    ];
    expect(summarizeExternalDeps(deps).down).toEqual([
      "Cache",
      "Queue",
      "Storage",
    ]);
  });

  it("reports all down when no dependency is healthy", () => {
    const deps: readonly ExternalDep[] = [
      { name: "A", healthy: false },
      { name: "B", healthy: false },
    ];
    expect(summarizeExternalDeps(deps)).toEqual({
      total: 2,
      downCount: 2,
      down: ["A", "B"],
      allHealthy: false,
    });
  });

  it("keeps duplicate names of down dependencies", () => {
    const deps: readonly ExternalDep[] = [
      { name: "Webhook", healthy: false },
      { name: "Webhook", healthy: false },
    ];
    expect(summarizeExternalDeps(deps).down).toEqual(["Webhook", "Webhook"]);
    expect(summarizeExternalDeps(deps).downCount).toBe(2);
  });

  it("counts total independent of health", () => {
    const deps: readonly ExternalDep[] = [
      { name: "A", healthy: true },
      { name: "B", healthy: false },
      { name: "C", healthy: true },
    ];
    expect(summarizeExternalDeps(deps).total).toBe(3);
  });

  it("is deterministic across repeated calls", () => {
    const deps: readonly ExternalDep[] = [
      { name: "X", healthy: false },
      { name: "Y", healthy: true },
    ];
    const first = summarizeExternalDeps(deps);
    const second = summarizeExternalDeps(deps);
    expect(first).toEqual(second);
  });
});
