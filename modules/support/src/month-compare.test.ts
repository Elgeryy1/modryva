import { describe, expect, it } from "vitest";
import { compareMonths } from "./month-compare.js";

describe("compareMonths", () => {
  it("computes deltas and directions per metric", () => {
    expect(
      compareMonths({ spam: 10, retencion: 5 }, { spam: 20, retencion: 3 }),
    ).toEqual([
      { metric: "retencion", delta: 2, direction: "sube" },
      { metric: "spam", delta: -10, direction: "baja" },
    ]);
  });

  it("sorts results by metric name ascending", () => {
    const result = compareMonths(
      { zzz: 1, aaa: 1, mmm: 1 },
      { zzz: 0, aaa: 0, mmm: 0 },
    );
    expect(result.map((c) => c.metric)).toEqual(["aaa", "mmm", "zzz"]);
  });

  it("treats a missing previous value as 0", () => {
    expect(compareMonths({ nuevos: 4 }, {})).toEqual([
      { metric: "nuevos", delta: 4, direction: "sube" },
    ]);
  });

  it("marks an unchanged metric as igual with delta 0", () => {
    expect(compareMonths({ activos: 5 }, { activos: 5 })).toEqual([
      { metric: "activos", delta: 0, direction: "igual" },
    ]);
  });

  it("marks a decrease as baja", () => {
    expect(compareMonths({ bans: 2 }, { bans: 9 })).toEqual([
      { metric: "bans", delta: -7, direction: "baja" },
    ]);
  });

  it("ignores metrics only present in previous", () => {
    const result = compareMonths({ spam: 3 }, { spam: 1, retencion: 8 });
    expect(result.map((c) => c.metric)).toEqual(["spam"]);
  });

  it("handles negative values crossing zero", () => {
    expect(compareMonths({ saldo: 5 }, { saldo: -5 })).toEqual([
      { metric: "saldo", delta: 10, direction: "sube" },
    ]);
  });

  it("returns an empty array for empty current input", () => {
    expect(compareMonths({}, { spam: 4 })).toEqual([]);
  });

  it("is deterministic for equal inputs regardless of key insertion order", () => {
    const a = compareMonths({ b: 2, a: 1 }, { a: 0, b: 0 });
    const b = compareMonths({ a: 1, b: 2 }, { b: 0, a: 0 });
    expect(a).toEqual(b);
  });
});
