import { describe, expect, it } from "vitest";
import {
  applyRestoration,
  proposeRestoration,
  RESTORATIVE_TASKS,
  type RestorativeOffense,
} from "./restorative.js";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

describe("RESTORATIVE_TASKS", () => {
  it("exposes the three tasks in escalating order", () => {
    expect(RESTORATIVE_TASKS).toEqual([
      "leer-reglas",
      "disculpa-publica",
      "ayudar-a-otro",
    ]);
  });

  it("has no duplicate tasks", () => {
    expect(new Set(RESTORATIVE_TASKS).size).toBe(RESTORATIVE_TASKS.length);
  });
});

describe("proposeRestoration", () => {
  it("makes a leve offense eligible with leer-reglas", () => {
    expect(proposeRestoration("leve")).toEqual({
      eligible: true,
      task: "leer-reglas",
      reduceMsBy: 30 * MINUTE,
    });
  });

  it("makes a media offense eligible with disculpa-publica", () => {
    expect(proposeRestoration("media")).toEqual({
      eligible: true,
      task: "disculpa-publica",
      reduceMsBy: 15 * MINUTE,
    });
  });

  it("makes a grave offense non-eligible without task or reduceMsBy", () => {
    const proposal = proposeRestoration("grave");
    expect(proposal).toEqual({ eligible: false });
    expect(proposal.task).toBeUndefined();
    expect(proposal.reduceMsBy).toBeUndefined();
  });

  it("gives a larger discount to leve than to media", () => {
    const leve = proposeRestoration("leve");
    const media = proposeRestoration("media");
    const leveReduce = leve.reduceMsBy ?? 0;
    const mediaReduce = media.reduceMsBy ?? 0;
    expect(leveReduce).toBeGreaterThan(mediaReduce);
  });

  it("only proposes tasks from the catalogue for eligible offenses", () => {
    const eligible: readonly RestorativeOffense[] = ["leve", "media"];
    for (const offense of eligible) {
      const proposal = proposeRestoration(offense);
      const task = proposal.task;
      expect(task).toBeDefined();
      if (task !== undefined) {
        expect(RESTORATIVE_TASKS).toContain(task);
      }
    }
  });

  it("is deterministic for identical inputs", () => {
    expect(proposeRestoration("leve")).toEqual(proposeRestoration("leve"));
    expect(proposeRestoration("grave")).toEqual(proposeRestoration("grave"));
  });
});

describe("applyRestoration", () => {
  it("subtracts the reduction from the remaining time", () => {
    expect(applyRestoration(HOUR, 30 * MINUTE)).toBe(30 * MINUTE);
  });

  it("never returns a negative remaining time", () => {
    expect(applyRestoration(10 * MINUTE, 30 * MINUTE)).toBe(0);
  });

  it("returns zero when the reduction exactly matches the remaining", () => {
    expect(applyRestoration(30 * MINUTE, 30 * MINUTE)).toBe(0);
  });

  it("treats a negative remaining as zero", () => {
    expect(applyRestoration(-5 * MINUTE, 10 * MINUTE)).toBe(0);
  });

  it("treats a negative reduction as zero (no penalty added)", () => {
    expect(applyRestoration(HOUR, -20 * MINUTE)).toBe(HOUR);
  });

  it("leaves the remaining unchanged with a zero reduction", () => {
    expect(applyRestoration(45 * MINUTE, 0)).toBe(45 * MINUTE);
  });

  it("returns zero when both inputs are zero", () => {
    expect(applyRestoration(0, 0)).toBe(0);
  });

  it("composes with proposeRestoration for a leve offense", () => {
    const proposal = proposeRestoration("leve");
    const reduce = proposal.reduceMsBy ?? 0;
    expect(applyRestoration(HOUR, reduce)).toBe(30 * MINUTE);
  });

  it("composes with a grave offense (no reduction applied)", () => {
    const proposal = proposeRestoration("grave");
    const reduce = proposal.reduceMsBy ?? 0;
    expect(applyRestoration(HOUR, reduce)).toBe(HOUR);
  });

  it("is deterministic for identical inputs", () => {
    expect(applyRestoration(HOUR, 15 * MINUTE)).toBe(
      applyRestoration(HOUR, 15 * MINUTE),
    );
  });
});
