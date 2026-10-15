import { describe, expect, it } from "vitest";
import {
  type SoftCleanupMessage,
  suggestSoftCleanup,
} from "./soft-cleanup-suggest.js";

const HOUR = 3_600_000;
const DAY = 86_400_000;

describe("suggestSoftCleanup", () => {
  it("suggests only spam older than the default 24h threshold", () => {
    const messages: readonly SoftCleanupMessage[] = [
      { id: "a", isSpam: true, ageMs: 25 * HOUR },
      { id: "b", isSpam: true, ageMs: 1 * HOUR },
      { id: "c", isSpam: false, ageMs: 30 * HOUR },
    ];
    expect(suggestSoftCleanup(messages)).toEqual(["a"]);
  });

  it("preserves the input order of the suggested ids", () => {
    const messages: readonly SoftCleanupMessage[] = [
      { id: "x", isSpam: true, ageMs: 48 * HOUR },
      { id: "y", isSpam: true, ageMs: 26 * HOUR },
      { id: "z", isSpam: true, ageMs: 25 * HOUR },
    ];
    expect(suggestSoftCleanup(messages)).toEqual(["x", "y", "z"]);
  });

  it("returns an empty list for empty input", () => {
    expect(suggestSoftCleanup([])).toEqual([]);
  });

  it("returns an empty list when nothing is spam", () => {
    const messages: readonly SoftCleanupMessage[] = [
      { id: "a", isSpam: false, ageMs: 100 * HOUR },
      { id: "b", isSpam: false, ageMs: 200 * HOUR },
    ];
    expect(suggestSoftCleanup(messages)).toEqual([]);
  });

  it("excludes spam that is exactly at the threshold (strictly older only)", () => {
    const messages: readonly SoftCleanupMessage[] = [
      { id: "edge", isSpam: true, ageMs: DAY },
    ];
    expect(suggestSoftCleanup(messages)).toEqual([]);
  });

  it("honours a custom minAgeMs from options", () => {
    const messages: readonly SoftCleanupMessage[] = [
      { id: "a", isSpam: true, ageMs: 3 * HOUR },
      { id: "b", isSpam: true, ageMs: 1 * HOUR },
    ];
    expect(
      suggestSoftCleanup(messages, undefined, { minAgeMs: 2 * HOUR }),
    ).toEqual(["a"]);
  });

  it("ignores the unused nowMs parameter", () => {
    const messages: readonly SoftCleanupMessage[] = [
      { id: "a", isSpam: true, ageMs: 30 * HOUR },
    ];
    expect(suggestSoftCleanup(messages, 1_000)).toEqual(
      suggestSoftCleanup(messages, 999_999_999),
    );
  });

  it("suggests every spam message when minAgeMs is zero", () => {
    const messages: readonly SoftCleanupMessage[] = [
      { id: "a", isSpam: true, ageMs: 1 },
      { id: "b", isSpam: false, ageMs: 5 },
      { id: "c", isSpam: true, ageMs: 10 },
    ];
    expect(suggestSoftCleanup(messages, undefined, { minAgeMs: 0 })).toEqual([
      "a",
      "c",
    ]);
  });

  it("is deterministic across repeated calls", () => {
    const messages: readonly SoftCleanupMessage[] = [
      { id: "a", isSpam: true, ageMs: 50 * HOUR },
      { id: "b", isSpam: true, ageMs: 2 * HOUR },
      { id: "c", isSpam: true, ageMs: 40 * HOUR },
    ];
    const first = suggestSoftCleanup(messages);
    const second = suggestSoftCleanup(messages);
    expect(first).toEqual(second);
    expect(first).toEqual(["a", "c"]);
  });
});
