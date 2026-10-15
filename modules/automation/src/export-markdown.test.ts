import { describe, expect, it } from "vitest";
import {
  casesToMarkdown,
  EXPORT_CASE_HEADERS,
  type ExportCase,
  exportEscapeCell,
  exportFormatTimestamp,
  rulesToMarkdown,
} from "./export-markdown.js";

const makeCase = (overrides: Partial<ExportCase> = {}): ExportCase => ({
  id: "c1",
  user: "ana",
  action: "ban",
  reason: "spam",
  ms: 0,
  ...overrides,
});

describe("exportEscapeCell", () => {
  it("escapes pipe characters", () => {
    expect(exportEscapeCell("a|b|c")).toBe("a\\|b\\|c");
  });

  it("collapses newlines to a single space", () => {
    expect(exportEscapeCell("line1\nline2\r\nline3")).toBe("line1 line2 line3");
  });

  it("escapes backslashes before pipes", () => {
    expect(exportEscapeCell("a\\b")).toBe("a\\\\b");
  });

  it("leaves plain text untouched", () => {
    expect(exportEscapeCell("hola mundo")).toBe("hola mundo");
  });

  it("returns empty for empty input", () => {
    expect(exportEscapeCell("")).toBe("");
  });
});

describe("exportFormatTimestamp", () => {
  it("formats epoch zero as the ISO unix epoch", () => {
    expect(exportFormatTimestamp(0)).toBe("1970-01-01T00:00:00.000Z");
  });

  it("formats a known millisecond timestamp deterministically", () => {
    expect(exportFormatTimestamp(1_700_000_000_000)).toBe(
      "2023-11-14T22:13:20.000Z",
    );
  });

  it("returns empty string for non-finite input", () => {
    expect(exportFormatTimestamp(Number.NaN)).toBe("");
    expect(exportFormatTimestamp(Number.POSITIVE_INFINITY)).toBe("");
  });

  it("is deterministic across calls", () => {
    expect(exportFormatTimestamp(123_456)).toBe(exportFormatTimestamp(123_456));
  });
});

describe("casesToMarkdown", () => {
  it("renders header and separator for an empty list", () => {
    expect(casesToMarkdown([])).toBe(
      "| id | user | action | reason | when |\n| --- | --- | --- | --- | --- |",
    );
  });

  it("uses the exported header labels", () => {
    const firstLine = casesToMarkdown([]).split("\n")[0] ?? "";
    for (const label of EXPORT_CASE_HEADERS) {
      expect(firstLine).toContain(label);
    }
  });

  it("renders a single case row with formatted timestamp", () => {
    const out = casesToMarkdown([makeCase({ ms: 0 })]);
    const lines = out.split("\n");
    expect(lines[2]).toBe(
      "| c1 | ana | ban | spam | 1970-01-01T00:00:00.000Z |",
    );
  });

  it("escapes pipes inside cell values", () => {
    const out = casesToMarkdown([makeCase({ reason: "a|b" })]);
    const lines = out.split("\n");
    expect(lines[2]).toContain("a\\|b");
  });

  it("collapses newlines in reason to keep one row per case", () => {
    const out = casesToMarkdown([makeCase({ reason: "l1\nl2" })]);
    expect(out.split("\n")).toHaveLength(3);
    expect(out).toContain("l1 l2");
  });

  it("renders multiple cases in order", () => {
    const out = casesToMarkdown([
      makeCase({ id: "a" }),
      makeCase({ id: "b" }),
      makeCase({ id: "c" }),
    ]);
    const lines = out.split("\n");
    expect(lines).toHaveLength(5);
    expect(lines[2]).toContain("| a |");
    expect(lines[3]).toContain("| b |");
    expect(lines[4]).toContain("| c |");
  });

  it("is deterministic for identical inputs", () => {
    const cases = [makeCase({ id: "x", ms: 42 })];
    expect(casesToMarkdown(cases)).toBe(casesToMarkdown(cases));
  });
});

describe("rulesToMarkdown", () => {
  it("returns empty string for no rules", () => {
    expect(rulesToMarkdown([])).toBe("");
  });

  it("numbers a single rule starting at 1", () => {
    expect(rulesToMarkdown(["no spam"])).toBe("1. no spam");
  });

  it("numbers multiple rules sequentially", () => {
    expect(rulesToMarkdown(["a", "b", "c"])).toBe("1. a\n2. b\n3. c");
  });

  it("collapses newlines within a rule", () => {
    expect(rulesToMarkdown(["linea1\nlinea2"])).toBe("1. linea1 linea2");
  });

  it("is deterministic for identical inputs", () => {
    const rules = ["uno", "dos"];
    expect(rulesToMarkdown(rules)).toBe(rulesToMarkdown(rules));
  });
});
