import { describe, expect, it } from "vitest";
import {
  DOGPILE_MIN_ATTACKERS,
  type DogpileEvent,
  detectDogpiling,
  dogpileAttackers,
} from "./dogpiling.js";

const ev = (fromId: string, toId: string, ms: number): DogpileEvent => ({
  fromId,
  toId,
  ms,
});

const SECOND = 1_000;
const MINUTE = 60 * SECOND;

describe("dogpileAttackers", () => {
  it("collects distinct attackers targeting the victim in window", () => {
    const recent = [
      ev("a", "victim", 1_000),
      ev("b", "victim", 2_000),
      ev("c", "victim", 3_000),
    ];
    expect(dogpileAttackers("victim", recent, MINUTE, 60_000)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("deduplicates repeated attackers keeping first appearance order", () => {
    const recent = [
      ev("a", "victim", 1_000),
      ev("b", "victim", 2_000),
      ev("a", "victim", 3_000),
    ];
    expect(dogpileAttackers("victim", recent, MINUTE, 60_000)).toEqual([
      "a",
      "b",
    ]);
  });

  it("ignores events aimed at other targets", () => {
    const recent = [
      ev("a", "victim", 1_000),
      ev("b", "other", 2_000),
      ev("c", "victim", 3_000),
    ];
    expect(dogpileAttackers("victim", recent, MINUTE, 60_000)).toEqual([
      "a",
      "c",
    ]);
  });

  it("excludes the target messaging itself", () => {
    const recent = [ev("victim", "victim", 1_000), ev("a", "victim", 2_000)];
    expect(dogpileAttackers("victim", recent, MINUTE, 60_000)).toEqual(["a"]);
  });

  it("excludes events older than the window", () => {
    const recent = [ev("a", "victim", 1_000), ev("b", "victim", 55_000)];
    // window 60s ending at 60000 => start 0; both inside.
    expect(dogpileAttackers("victim", recent, MINUTE, 60_000)).toEqual([
      "a",
      "b",
    ]);
    // window 10s ending at 60000 => start 50000; only "b" inside.
    expect(dogpileAttackers("victim", recent, 10 * SECOND, 60_000)).toEqual([
      "b",
    ]);
  });

  it("includes events exactly at window boundaries", () => {
    const recent = [ev("a", "victim", 50_000), ev("b", "victim", 60_000)];
    expect(dogpileAttackers("victim", recent, 10 * SECOND, 60_000)).toEqual([
      "a",
      "b",
    ]);
  });

  it("excludes events in the future relative to nowMs", () => {
    const recent = [ev("a", "victim", 61_000), ev("b", "victim", 60_000)];
    expect(dogpileAttackers("victim", recent, MINUTE, 60_000)).toEqual(["b"]);
  });

  it("returns empty for a non-positive window", () => {
    const recent = [ev("a", "victim", 60_000)];
    expect(dogpileAttackers("victim", recent, 0, 60_000)).toEqual([]);
    expect(dogpileAttackers("victim", recent, -5, 60_000)).toEqual([]);
  });

  it("returns empty when there are no events", () => {
    expect(dogpileAttackers("victim", [], MINUTE, 60_000)).toEqual([]);
  });
});

describe("detectDogpiling", () => {
  it("flags piling when distinct attackers reach the threshold", () => {
    const recent = [
      ev("a", "victim", 1_000),
      ev("b", "victim", 2_000),
      ev("c", "victim", 3_000),
    ];
    const result = detectDogpiling("victim", recent, MINUTE, 60_000);
    expect(result.piling).toBe(true);
    expect(result.attackers).toBe(3);
    expect(result.reason).toContain("3 usuarios distintos");
  });

  it("does not flag piling below the threshold", () => {
    const recent = [ev("a", "victim", 1_000), ev("b", "victim", 2_000)];
    const result = detectDogpiling("victim", recent, MINUTE, 60_000);
    expect(result.piling).toBe(false);
    expect(result.attackers).toBe(2);
    expect(result.reason).toContain("umbral");
  });

  it("counts many messages from few users as few attackers", () => {
    const recent = [
      ev("a", "victim", 1_000),
      ev("a", "victim", 2_000),
      ev("a", "victim", 3_000),
      ev("b", "victim", 4_000),
    ];
    const result = detectDogpiling("victim", recent, MINUTE, 60_000);
    expect(result.attackers).toBe(2);
    expect(result.piling).toBe(false);
  });

  it("uses DOGPILE_MIN_ATTACKERS as the boundary", () => {
    const many: DogpileEvent[] = [];
    for (let i = 0; i < DOGPILE_MIN_ATTACKERS; i += 1) {
      many.push(ev(`u${i}`, "victim", 1_000 + i));
    }
    expect(detectDogpiling("victim", many, MINUTE, 60_000).piling).toBe(true);
    const oneFewer = many.slice(0, DOGPILE_MIN_ATTACKERS - 1);
    expect(detectDogpiling("victim", oneFewer, MINUTE, 60_000).piling).toBe(
      false,
    );
  });

  it("reports zero attackers with an empty event list", () => {
    const result = detectDogpiling("victim", [], MINUTE, 60_000);
    expect(result.attackers).toBe(0);
    expect(result.piling).toBe(false);
  });

  it("is deterministic for identical inputs", () => {
    const recent = [
      ev("a", "victim", 1_000),
      ev("b", "victim", 2_000),
      ev("c", "victim", 3_000),
    ];
    const first = detectDogpiling("victim", recent, MINUTE, 60_000);
    const second = detectDogpiling("victim", recent, MINUTE, 60_000);
    expect(first).toEqual(second);
  });

  it("does not count out-of-window attackers toward piling", () => {
    const recent = [
      ev("a", "victim", 10_000),
      ev("b", "victim", 20_000),
      ev("c", "victim", 59_000),
    ];
    // 5s window ending at 60000 => start 55000; only "c" qualifies.
    const result = detectDogpiling("victim", recent, 5 * SECOND, 60_000);
    expect(result.attackers).toBe(1);
    expect(result.piling).toBe(false);
  });
});
