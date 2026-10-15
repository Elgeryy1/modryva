import { describe, expect, it } from "vitest";
import type { BotMessageAuditEntry } from "./bot-message-audit.js";
import { summarizeBotMessages } from "./bot-message-audit.js";

describe("summarizeBotMessages", () => {
  it("tallies by kind and sorts by count desc then kind asc", () => {
    const messages: readonly BotMessageAuditEntry[] = [
      { kind: "text" },
      { kind: "photo" },
      { kind: "text" },
      { kind: "sticker" },
    ];
    expect(summarizeBotMessages(messages)).toEqual({
      total: 4,
      byKind: [
        { kind: "text", count: 2 },
        { kind: "photo", count: 1 },
        { kind: "sticker", count: 1 },
      ],
    });
  });

  it("returns zero total and empty breakdown for an empty input", () => {
    expect(summarizeBotMessages([])).toEqual({ total: 0, byKind: [] });
  });

  it("counts a single message", () => {
    expect(summarizeBotMessages([{ kind: "text" }])).toEqual({
      total: 1,
      byKind: [{ kind: "text", count: 1 }],
    });
  });

  it("keeps a single-kind repeated input as one entry", () => {
    const messages: readonly BotMessageAuditEntry[] = [
      { kind: "poll" },
      { kind: "poll" },
      { kind: "poll" },
    ];
    expect(summarizeBotMessages(messages)).toEqual({
      total: 3,
      byKind: [{ kind: "poll", count: 3 }],
    });
  });

  it("breaks count ties by kind ascending", () => {
    const messages: readonly BotMessageAuditEntry[] = [
      { kind: "video" },
      { kind: "audio" },
      { kind: "photo" },
    ];
    expect(summarizeBotMessages(messages)).toEqual({
      total: 3,
      byKind: [
        { kind: "audio", count: 1 },
        { kind: "photo", count: 1 },
        { kind: "video", count: 1 },
      ],
    });
  });

  it("treats distinct kinds case-sensitively", () => {
    const messages: readonly BotMessageAuditEntry[] = [
      { kind: "Text" },
      { kind: "text" },
    ];
    expect(summarizeBotMessages(messages)).toEqual({
      total: 2,
      byKind: [
        { kind: "Text", count: 1 },
        { kind: "text", count: 1 },
      ],
    });
  });

  it("counts empty-string kinds as their own group", () => {
    const messages: readonly BotMessageAuditEntry[] = [
      { kind: "" },
      { kind: "" },
      { kind: "text" },
    ];
    expect(summarizeBotMessages(messages)).toEqual({
      total: 3,
      byKind: [
        { kind: "", count: 2 },
        { kind: "text", count: 1 },
      ],
    });
  });

  it("is deterministic regardless of input ordering", () => {
    const orderA: readonly BotMessageAuditEntry[] = [
      { kind: "photo" },
      { kind: "text" },
      { kind: "photo" },
      { kind: "text" },
      { kind: "text" },
    ];
    const orderB: readonly BotMessageAuditEntry[] = [
      { kind: "text" },
      { kind: "photo" },
      { kind: "text" },
      { kind: "text" },
      { kind: "photo" },
    ];
    const expected = {
      total: 5,
      byKind: [
        { kind: "text", count: 3 },
        { kind: "photo", count: 2 },
      ],
    };
    expect(summarizeBotMessages(orderA)).toEqual(expected);
    expect(summarizeBotMessages(orderB)).toEqual(expected);
  });
});
