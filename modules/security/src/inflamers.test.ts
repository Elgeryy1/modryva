import { describe, expect, it } from "vitest";
import { detectInflamers } from "./inflamers.js";

describe("detectInflamers", () => {
  it("marks users meeting default thresholds sorted by rate desc", () => {
    const result = detectInflamers([
      { userId: 1, threadsJoined: 10, threadsEscalated: 8 },
      { userId: 2, threadsJoined: 4, threadsEscalated: 2 },
      { userId: 4, threadsJoined: 6, threadsEscalated: 5 },
    ]);
    expect(result).toEqual([
      { userId: 4, escalationRate: 0.83 },
      { userId: 1, escalationRate: 0.8 },
      { userId: 2, escalationRate: 0.5 },
    ]);
  });

  it("excludes users below the default minThreads even with high rate", () => {
    const result = detectInflamers([
      { userId: 3, threadsJoined: 2, threadsEscalated: 2 },
    ]);
    expect(result).toEqual([]);
  });

  it("excludes users below the default minRate", () => {
    const result = detectInflamers([
      { userId: 5, threadsJoined: 10, threadsEscalated: 4 },
    ]);
    expect(result).toEqual([]);
  });

  it("includes a user exactly at the minRate boundary", () => {
    const result = detectInflamers([
      { userId: 7, threadsJoined: 4, threadsEscalated: 2 },
    ]);
    expect(result).toEqual([{ userId: 7, escalationRate: 0.5 }]);
  });

  it("breaks rate ties by userId ascending", () => {
    const result = detectInflamers([
      { userId: 9, threadsJoined: 5, threadsEscalated: 4 },
      { userId: 2, threadsJoined: 5, threadsEscalated: 4 },
    ]);
    expect(result).toEqual([
      { userId: 2, escalationRate: 0.8 },
      { userId: 9, escalationRate: 0.8 },
    ]);
  });

  it("respects custom minThreads and minRate options", () => {
    const result = detectInflamers(
      [
        { userId: 1, threadsJoined: 2, threadsEscalated: 2 },
        { userId: 2, threadsJoined: 3, threadsEscalated: 2 },
      ],
      { minThreads: 2, minRate: 0.9 },
    );
    expect(result).toEqual([{ userId: 1, escalationRate: 1 }]);
  });

  it("rounds the escalation rate to two decimals", () => {
    const result = detectInflamers([
      { userId: 8, threadsJoined: 3, threadsEscalated: 2 },
    ]);
    expect(result).toEqual([{ userId: 8, escalationRate: 0.67 }]);
  });

  it("returns an empty array for empty input", () => {
    expect(detectInflamers([])).toEqual([]);
  });

  it("discards non-positive threadsJoined even when minThreads is zero", () => {
    const result = detectInflamers(
      [{ userId: 4, threadsJoined: 0, threadsEscalated: 0 }],
      { minThreads: 0, minRate: 0 },
    );
    expect(result).toEqual([]);
  });

  it("is deterministic across repeated calls", () => {
    const users = [
      { userId: 1, threadsJoined: 8, threadsEscalated: 7 },
      { userId: 2, threadsJoined: 8, threadsEscalated: 6 },
    ];
    const first = detectInflamers(users);
    const second = detectInflamers(users);
    expect(first).toEqual(second);
    expect(first).toEqual([
      { userId: 1, escalationRate: 0.88 },
      { userId: 2, escalationRate: 0.75 },
    ]);
  });
});
