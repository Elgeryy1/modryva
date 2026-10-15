import { describe, expect, it } from "vitest";
import { detectAppealSpam } from "./appeal-spam.js";

const HOUR = 60 * 60 * 1000;

describe("detectAppealSpam", () => {
  it("blocks when appeals reach the window limit", () => {
    const now = 100 * HOUR;
    expect(
      detectAppealSpam([now - HOUR, now - 2 * HOUR, now - 3 * HOUR], now),
    ).toEqual({ blocked: true, countInWindow: 3 });
  });

  it("does not block below the limit", () => {
    const now = 100 * HOUR;
    expect(detectAppealSpam([now - HOUR, now - 2 * HOUR], now)).toEqual({
      blocked: false,
      countInWindow: 2,
    });
  });

  it("ignores appeals older than the window", () => {
    const now = 100 * HOUR;
    expect(
      detectAppealSpam([now - 30 * HOUR, now - HOUR], now).countInWindow,
    ).toBe(1);
  });

  it("honors custom window and max", () => {
    const now = 1000;
    expect(
      detectAppealSpam([now - 10, now - 20], now, {
        windowMs: 100,
        maxInWindow: 2,
      }).blocked,
    ).toBe(true);
  });

  it("returns zero for no appeals", () => {
    expect(detectAppealSpam([], 1000)).toEqual({
      blocked: false,
      countInWindow: 0,
    });
  });
});
