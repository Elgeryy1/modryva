import { describe, expect, it } from "vitest";
import { detectCopyPaste } from "./copypaste-detector.js";

describe("detectCopyPaste", () => {
  it("flags text reused across distinct accounts, keeping first sample", () => {
    const result = detectCopyPaste([
      { authorId: 1, text: "Compra ahora GRATIS" },
      { authorId: 2, text: "compra ahora gratis" },
      { authorId: 1, text: "compra ahora gratis" },
    ]);
    expect(result).toEqual({
      matched: true,
      clusters: [{ sample: "Compra ahora GRATIS", authors: [1, 2] }],
    });
  });

  it("does not flag repeats from a single account", () => {
    const result = detectCopyPaste([
      { authorId: 7, text: "hola" },
      { authorId: 7, text: "hola" },
    ]);
    expect(result).toEqual({ matched: false, clusters: [] });
  });

  it("returns an empty report for no messages", () => {
    expect(detectCopyPaste([])).toEqual({ matched: false, clusters: [] });
  });

  it("normalizes whitespace and casing before grouping", () => {
    const result = detectCopyPaste([
      { authorId: 1, text: "  Hola   Mundo  " },
      { authorId: 2, text: "hola mundo" },
    ]);
    expect(result).toEqual({
      matched: true,
      clusters: [{ sample: "  Hola   Mundo  ", authors: [1, 2] }],
    });
  });

  it("ignores blank and whitespace-only messages", () => {
    const result = detectCopyPaste([
      { authorId: 1, text: "   " },
      { authorId: 2, text: "" },
    ]);
    expect(result).toEqual({ matched: false, clusters: [] });
  });

  it("sorts clusters by distinct-author count descending", () => {
    const result = detectCopyPaste([
      { authorId: 1, text: "zeta" },
      { authorId: 2, text: "zeta" },
      { authorId: 3, text: "zeta" },
      { authorId: 4, text: "alfa" },
      { authorId: 5, text: "alfa" },
    ]);
    expect(result.clusters).toEqual([
      { sample: "zeta", authors: [1, 2, 3] },
      { sample: "alfa", authors: [4, 5] },
    ]);
  });

  it("breaks count ties by sample text ascending", () => {
    const result = detectCopyPaste([
      { authorId: 1, text: "banana" },
      { authorId: 2, text: "banana" },
      { authorId: 3, text: "apple" },
      { authorId: 4, text: "apple" },
    ]);
    expect(result.clusters).toEqual([
      { sample: "apple", authors: [3, 4] },
      { sample: "banana", authors: [1, 2] },
    ]);
  });

  it("sorts authors ascending regardless of arrival order", () => {
    const result = detectCopyPaste([
      { authorId: 5, text: "hey" },
      { authorId: 1, text: "hey" },
      { authorId: 5, text: "hey" },
    ]);
    expect(result).toEqual({
      matched: true,
      clusters: [{ sample: "hey", authors: [1, 5] }],
    });
  });

  it("respects a higher minAccounts threshold", () => {
    const messages = [
      { authorId: 1, text: "x" },
      { authorId: 2, text: "x" },
    ];
    expect(detectCopyPaste(messages, { minAccounts: 3 })).toEqual({
      matched: false,
      clusters: [],
    });
    expect(detectCopyPaste(messages, { minAccounts: 2 })).toEqual({
      matched: true,
      clusters: [{ sample: "x", authors: [1, 2] }],
    });
  });

  it("keeps distinct normalized texts in separate clusters", () => {
    const result = detectCopyPaste([
      { authorId: 1, text: "uno" },
      { authorId: 2, text: "uno" },
      { authorId: 3, text: "dos" },
      { authorId: 4, text: "dos" },
    ]);
    expect(result.matched).toBe(true);
    expect(result.clusters).toHaveLength(2);
    expect(result.clusters).toEqual([
      { sample: "dos", authors: [3, 4] },
      { sample: "uno", authors: [1, 2] },
    ]);
  });

  it("is deterministic across repeated calls", () => {
    const messages = [
      { authorId: 9, text: "Ping" },
      { authorId: 2, text: "ping" },
      { authorId: 5, text: "PING" },
    ];
    const first = detectCopyPaste(messages);
    const second = detectCopyPaste(messages);
    expect(first).toEqual(second);
    expect(first).toEqual({
      matched: true,
      clusters: [{ sample: "Ping", authors: [2, 5, 9] }],
    });
  });
});
