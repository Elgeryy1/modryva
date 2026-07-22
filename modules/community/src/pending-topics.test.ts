import { describe, expect, it } from "vitest";
import {
  extractPendingTopics,
  formatPendingReminder,
} from "./pending-topics.js";

describe("extractPendingTopics", () => {
  it("returns distinct pending topics in first-appearance order", () => {
    expect(
      extractPendingTopics([
        { topic: "deploy", resolved: false },
        { topic: "backup", resolved: true },
        { topic: "deploy", resolved: false },
        { topic: "dns", resolved: false },
      ]),
    ).toEqual(["deploy", "dns"]);
  });

  it("excludes a topic that has any resolved item (unresolved seen first)", () => {
    expect(
      extractPendingTopics([
        { topic: "A", resolved: false },
        { topic: "A", resolved: true },
      ]),
    ).toEqual([]);
  });

  it("excludes a topic that has any resolved item (resolved seen first)", () => {
    expect(
      extractPendingTopics([
        { topic: "A", resolved: true },
        { topic: "A", resolved: false },
      ]),
    ).toEqual([]);
  });

  it("returns empty when every topic is fully resolved", () => {
    expect(
      extractPendingTopics([
        { topic: "x", resolved: true },
        { topic: "y", resolved: true },
      ]),
    ).toEqual([]);
  });

  it("returns empty for an empty list", () => {
    expect(extractPendingTopics([])).toEqual([]);
  });

  it("ignores blank and whitespace-only topics", () => {
    expect(
      extractPendingTopics([
        { topic: "", resolved: false },
        { topic: "   ", resolved: false },
        { topic: "real", resolved: false },
      ]),
    ).toEqual(["real"]);
  });

  it("preserves insertion order instead of sorting alphabetically", () => {
    expect(
      extractPendingTopics([
        { topic: "c", resolved: false },
        { topic: "a", resolved: false },
        { topic: "b", resolved: false },
      ]),
    ).toEqual(["c", "a", "b"]);
  });

  it("is deterministic across repeated calls with the same input", () => {
    const items = [
      { topic: "one", resolved: false },
      { topic: "two", resolved: true },
      { topic: "one", resolved: false },
    ] as const;
    const first = extractPendingTopics(items);
    const second = extractPendingTopics(items);
    expect(first).toEqual(second);
    expect(first).toEqual(["one"]);
  });
});

describe("formatPendingReminder", () => {
  it("reports when nothing is pending", () => {
    expect(formatPendingReminder([])).toBe(
      "✅ No quedaron temas pendientes de ayer.",
    );
  });

  it("uses the singular form for a single pending topic", () => {
    expect(formatPendingReminder(["deploy"])).toBe(
      "⏳ Ayer quedó sin resolver: deploy",
    );
  });

  it("uses a bulleted plural form for several pending topics", () => {
    expect(formatPendingReminder(["deploy", "dns"])).toBe(
      "📌 Ayer quedaron sin resolver estos temas:\n• deploy\n• dns",
    );
  });

  it("composes with extractPendingTopics end to end", () => {
    const pending = extractPendingTopics([
      { topic: "deploy", resolved: false },
      { topic: "backup", resolved: true },
      { topic: "dns", resolved: false },
    ]);
    expect(formatPendingReminder(pending)).toBe(
      "📌 Ayer quedaron sin resolver estos temas:\n• deploy\n• dns",
    );
  });
});
