import { describe, expect, it } from "vitest";
import { decideMandatoryReread } from "./mandatory-reread.js";

describe("decideMandatoryReread", () => {
  it("requires a reread when total changes reach the default threshold", () => {
    expect(decideMandatoryReread({ added: 2, removed: 1, changed: 0 })).toEqual(
      {
        required: true,
        totalChanges: 3,
      },
    );
  });

  it("does not require a reread below the default threshold", () => {
    expect(decideMandatoryReread({ added: 1, removed: 1, changed: 0 })).toEqual(
      {
        required: false,
        totalChanges: 2,
      },
    );
  });

  it("treats a no-op edit as not requiring a reread", () => {
    expect(decideMandatoryReread({ added: 0, removed: 0, changed: 0 })).toEqual(
      {
        required: false,
        totalChanges: 0,
      },
    );
  });

  it("sums all three diff kinds", () => {
    expect(decideMandatoryReread({ added: 4, removed: 3, changed: 5 })).toEqual(
      {
        required: true,
        totalChanges: 12,
      },
    );
  });

  it("respects a higher custom threshold", () => {
    expect(
      decideMandatoryReread(
        { added: 1, removed: 1, changed: 1 },
        { bigChangeThreshold: 5 },
      ),
    ).toEqual({ required: false, totalChanges: 3 });
  });

  it("requires a reread exactly at a custom threshold boundary", () => {
    expect(
      decideMandatoryReread(
        { added: 3, removed: 1, changed: 1 },
        { bigChangeThreshold: 5 },
      ),
    ).toEqual({ required: true, totalChanges: 5 });
  });

  it("always requires a reread with a zero threshold", () => {
    expect(
      decideMandatoryReread(
        { added: 0, removed: 0, changed: 0 },
        { bigChangeThreshold: 0 },
      ),
    ).toEqual({ required: true, totalChanges: 0 });
  });

  it("falls back to the default when options is provided without a threshold", () => {
    expect(
      decideMandatoryReread({ added: 1, removed: 1, changed: 1 }, {}),
    ).toEqual({
      required: true,
      totalChanges: 3,
    });
  });

  it("is deterministic for repeated identical calls", () => {
    const input = { added: 2, removed: 2, changed: 2 };
    const first = decideMandatoryReread(input);
    const second = decideMandatoryReread(input);
    expect(first).toEqual(second);
    expect(first).toEqual({ required: true, totalChanges: 6 });
  });
});
