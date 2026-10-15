import { describe, expect, it } from "vitest";
import { detectSilentSpam } from "./silent-spam.js";

describe("detectSilentSpam", () => {
  it("flags a low-activity user whose messages are all links/mentions", () => {
    expect(
      detectSilentSpam({ messageCount: 5, linkCount: 3, mentionCount: 2 }),
    ).toEqual({
      suspicious: true,
      ratio: 1,
    });
  });

  it("does not flag a chatty user even with many links", () => {
    expect(
      detectSilentSpam({ messageCount: 20, linkCount: 18, mentionCount: 2 }),
    ).toEqual({
      suspicious: false,
      ratio: 1,
    });
  });

  it("guards messageCount 0 to ratio 0 and not suspicious", () => {
    expect(
      detectSilentSpam({ messageCount: 0, linkCount: 4, mentionCount: 1 }),
    ).toEqual({
      suspicious: false,
      ratio: 0,
    });
  });

  it("treats negative messageCount like empty activity", () => {
    expect(
      detectSilentSpam({ messageCount: -3, linkCount: 2, mentionCount: 2 }),
    ).toEqual({
      suspicious: false,
      ratio: 0,
    });
  });

  it("rounds the ratio to 2 decimals", () => {
    expect(
      detectSilentSpam({ messageCount: 3, linkCount: 2, mentionCount: 0 }),
    ).toEqual({
      suspicious: false,
      ratio: 0.67,
    });
  });

  it("flags at the exact minRatio boundary", () => {
    expect(
      detectSilentSpam({ messageCount: 10, linkCount: 7, mentionCount: 0 }),
    ).toEqual({
      suspicious: true,
      ratio: 0.7,
    });
  });

  it("does not flag just above the maxMessages boundary", () => {
    expect(
      detectSilentSpam({ messageCount: 11, linkCount: 11, mentionCount: 0 }),
    ).toEqual({
      suspicious: false,
      ratio: 1,
    });
  });

  it("honors custom maxMessages and minRatio options", () => {
    expect(
      detectSilentSpam(
        { messageCount: 4, linkCount: 2, mentionCount: 0 },
        { maxMessages: 5, minRatio: 0.5 },
      ),
    ).toEqual({ suspicious: true, ratio: 0.5 });
  });

  it("does not flag a clean low-activity user with no signals", () => {
    expect(
      detectSilentSpam({ messageCount: 4, linkCount: 0, mentionCount: 0 }),
    ).toEqual({
      suspicious: false,
      ratio: 0,
    });
  });

  it("is deterministic across repeated calls with the same input", () => {
    const input = { messageCount: 6, linkCount: 4, mentionCount: 1 } as const;
    const first = detectSilentSpam(input);
    const second = detectSilentSpam(input);
    expect(first).toEqual(second);
    expect(first).toEqual({ suspicious: true, ratio: 0.83 });
  });
});
