import { describe, expect, it } from "vitest";
import {
  findOrphanConfigs,
  isAbandonedGroup,
  type OrphanConfigEntry,
  type OrphanGroupStats,
} from "./orphan-config.js";

const entry = (
  overrides: Partial<OrphanConfigEntry> = {},
): OrphanConfigEntry => ({
  chatId: "-100",
  botInChat: true,
  ...overrides,
});

const stats = (
  overrides: Partial<OrphanGroupStats> = {},
): OrphanGroupStats => ({
  lastActivityMs: 0,
  members: 10,
  ...overrides,
});

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe("findOrphanConfigs", () => {
  it("returns chatIds where the bot is no longer in the chat", () => {
    expect(
      findOrphanConfigs([
        entry({ chatId: "a", botInChat: false }),
        entry({ chatId: "b", botInChat: true }),
        entry({ chatId: "c", botInChat: false }),
      ]),
    ).toEqual(["a", "c"]);
  });

  it("returns empty when the bot is in every chat", () => {
    expect(
      findOrphanConfigs([
        entry({ chatId: "a", botInChat: true }),
        entry({ chatId: "b", botInChat: true }),
      ]),
    ).toEqual([]);
  });

  it("returns empty for an empty input", () => {
    expect(findOrphanConfigs([])).toEqual([]);
  });

  it("returns every chatId when the bot is in none", () => {
    expect(
      findOrphanConfigs([
        entry({ chatId: "x", botInChat: false }),
        entry({ chatId: "y", botInChat: false }),
      ]),
    ).toEqual(["x", "y"]);
  });

  it("preserves input order", () => {
    expect(
      findOrphanConfigs([
        entry({ chatId: "3", botInChat: false }),
        entry({ chatId: "1", botInChat: false }),
        entry({ chatId: "2", botInChat: false }),
      ]),
    ).toEqual(["3", "1", "2"]);
  });

  it("deduplicates repeated orphan chatIds keeping first appearance", () => {
    expect(
      findOrphanConfigs([
        entry({ chatId: "dup", botInChat: false }),
        entry({ chatId: "other", botInChat: true }),
        entry({ chatId: "dup", botInChat: false }),
      ]),
    ).toEqual(["dup"]);
  });

  it("is deterministic for identical inputs", () => {
    const input = [
      entry({ chatId: "a", botInChat: false }),
      entry({ chatId: "b", botInChat: true }),
    ];
    expect(findOrphanConfigs(input)).toEqual(findOrphanConfigs(input));
  });
});

describe("isAbandonedGroup", () => {
  it("is abandoned when idle for exactly idleMs", () => {
    expect(
      isAbandonedGroup(stats({ lastActivityMs: 0 }), 7 * DAY, 7 * DAY),
    ).toBe(true);
  });

  it("is abandoned when idle beyond idleMs", () => {
    expect(
      isAbandonedGroup(stats({ lastActivityMs: 0 }), 10 * DAY, 7 * DAY),
    ).toBe(true);
  });

  it("is not abandoned when still within the idle window", () => {
    expect(
      isAbandonedGroup(stats({ lastActivityMs: 5 * DAY }), 6 * DAY, 7 * DAY),
    ).toBe(false);
  });

  it("treats a group with zero members as abandoned regardless of activity", () => {
    expect(
      isAbandonedGroup(
        stats({ members: 0, lastActivityMs: 10 * DAY }),
        10 * DAY,
        7 * DAY,
      ),
    ).toBe(true);
  });

  it("treats negative member counts as abandoned", () => {
    expect(
      isAbandonedGroup(
        stats({ members: -1, lastActivityMs: 10 * DAY }),
        10 * DAY,
        7 * DAY,
      ),
    ).toBe(true);
  });

  it("is not abandoned for future activity when members remain", () => {
    expect(
      isAbandonedGroup(
        stats({ members: 3, lastActivityMs: 100 * DAY }),
        10 * DAY,
        7 * DAY,
      ),
    ).toBe(false);
  });

  it("with non-positive idleMs any non-future activity counts as abandoned", () => {
    expect(
      isAbandonedGroup(stats({ lastActivityMs: 10 * DAY }), 10 * DAY, 0),
    ).toBe(true);
    expect(
      isAbandonedGroup(stats({ lastActivityMs: 10 * DAY }), 12 * DAY, -HOUR),
    ).toBe(true);
  });

  it("just under the threshold is not abandoned", () => {
    expect(
      isAbandonedGroup(stats({ lastActivityMs: 0 }), 7 * DAY - 1, 7 * DAY),
    ).toBe(false);
  });

  it("is deterministic for identical inputs", () => {
    const s = stats({ lastActivityMs: DAY, members: 5 });
    expect(isAbandonedGroup(s, 9 * DAY, 7 * DAY)).toBe(
      isAbandonedGroup(s, 9 * DAY, 7 * DAY),
    );
  });

  it("handles the exact now === lastActivity boundary", () => {
    expect(
      isAbandonedGroup(stats({ lastActivityMs: 5 * DAY }), 5 * DAY, 0),
    ).toBe(true);
    expect(
      isAbandonedGroup(stats({ lastActivityMs: 5 * DAY }), 5 * DAY, MINUTE),
    ).toBe(false);
  });
});
