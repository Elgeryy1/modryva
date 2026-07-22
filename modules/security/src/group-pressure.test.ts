import { describe, expect, it } from "vitest";
import { detectGroupPressure } from "./group-pressure.js";

describe("detectGroupPressure", () => {
  it("flags three distinct pressurers, ids sorted ascending and deduped", () => {
    expect(
      detectGroupPressure({
        targetUserId: 100,
        recentMessages: [
          { authorId: 3, mentionsTarget: true, isDemand: true },
          { authorId: 1, mentionsTarget: true, isDemand: true },
          { authorId: 2, mentionsTarget: true, isDemand: true },
        ],
      }),
    ).toEqual({
      underPressure: true,
      pressurerCount: 3,
      pressurers: [1, 2, 3],
    });
  });

  it("ignores the target's own demanding messages", () => {
    expect(
      detectGroupPressure({
        targetUserId: 5,
        recentMessages: [
          { authorId: 5, mentionsTarget: true, isDemand: true },
          { authorId: 1, mentionsTarget: true, isDemand: true },
          { authorId: 2, mentionsTarget: true, isDemand: true },
        ],
      }),
    ).toEqual({ underPressure: false, pressurerCount: 2, pressurers: [1, 2] });
  });

  it("deduplicates a repeated pressurer across many messages", () => {
    expect(
      detectGroupPressure({
        targetUserId: 9,
        recentMessages: [
          { authorId: 1, mentionsTarget: true, isDemand: true },
          { authorId: 1, mentionsTarget: true, isDemand: true },
          { authorId: 1, mentionsTarget: true, isDemand: true },
        ],
      }),
    ).toEqual({ underPressure: false, pressurerCount: 1, pressurers: [1] });
  });

  it("ignores messages that only mention or only demand", () => {
    expect(
      detectGroupPressure({
        targetUserId: 0,
        recentMessages: [
          { authorId: 1, mentionsTarget: true, isDemand: false },
          { authorId: 2, mentionsTarget: false, isDemand: true },
          { authorId: 3, mentionsTarget: false, isDemand: false },
        ],
      }),
    ).toEqual({ underPressure: false, pressurerCount: 0, pressurers: [] });
  });

  it("handles an empty message window", () => {
    expect(
      detectGroupPressure({ targetUserId: 42, recentMessages: [] }),
    ).toEqual({
      underPressure: false,
      pressurerCount: 0,
      pressurers: [],
    });
  });

  it("respects a lower custom minPressurers threshold", () => {
    expect(
      detectGroupPressure(
        {
          targetUserId: 100,
          recentMessages: [
            { authorId: 1, mentionsTarget: true, isDemand: true },
            { authorId: 2, mentionsTarget: true, isDemand: true },
          ],
        },
        { minPressurers: 2 },
      ),
    ).toEqual({ underPressure: true, pressurerCount: 2, pressurers: [1, 2] });
  });

  it("stays below the default threshold with only two pressurers", () => {
    expect(
      detectGroupPressure({
        targetUserId: 100,
        recentMessages: [
          { authorId: 8, mentionsTarget: true, isDemand: true },
          { authorId: 4, mentionsTarget: true, isDemand: true },
        ],
      }),
    ).toEqual({ underPressure: false, pressurerCount: 2, pressurers: [4, 8] });
  });

  it("sorts ascending regardless of order and is deterministic across calls", () => {
    const input = {
      targetUserId: 100,
      recentMessages: [
        { authorId: 10, mentionsTarget: true, isDemand: true },
        { authorId: 2, mentionsTarget: true, isDemand: true },
        { authorId: 7, mentionsTarget: true, isDemand: true },
        { authorId: 2, mentionsTarget: true, isDemand: true },
      ],
    } as const;
    const first = detectGroupPressure(input);
    const second = detectGroupPressure(input);
    expect(first).toEqual({
      underPressure: true,
      pressurerCount: 3,
      pressurers: [2, 7, 10],
    });
    expect(second).toEqual(first);
  });

  it("treats a minPressurers below 1 as 1", () => {
    expect(
      detectGroupPressure(
        {
          targetUserId: 100,
          recentMessages: [
            { authorId: 1, mentionsTarget: true, isDemand: true },
          ],
        },
        { minPressurers: 0 },
      ),
    ).toEqual({ underPressure: true, pressurerCount: 1, pressurers: [1] });
  });
});
