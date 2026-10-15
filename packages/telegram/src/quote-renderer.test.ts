import { describe, expect, it } from "vitest";
import { HttpQuoteRenderer } from "./quote-renderer.js";

const jsonResponse = (body: unknown, ok = true): Response =>
  ({
    ok,
    json: async () => body,
  }) as unknown as Response;

describe("HttpQuoteRenderer", () => {
  it("posts to the configured endpoint and returns the image", async () => {
    let calledUrl = "";
    let sentBody = "";
    const fetcher = (async (url: string, init?: { body?: string }) => {
      calledUrl = url;
      sentBody = init?.body ?? "";
      return jsonResponse({
        ok: true,
        result: { image: "aW1n", type: "quote" },
      });
    }) as unknown as typeof fetch;

    const renderer = new HttpQuoteRenderer(
      "https://example.test/generate",
      fetcher,
    );
    const result = await renderer.renderQuote({ format: "webp", text: "hi" });

    expect(calledUrl).toBe("https://example.test/generate");
    expect(sentBody).toContain('"format":"webp"');
    expect(result).toEqual({ imageBase64: "aW1n", type: "webp" });
  });

  it("derives the type from the requested format, not the response", async () => {
    const fetcher = (async () =>
      jsonResponse({
        ok: true,
        result: { image: "cG5n", type: "quote" },
      })) as unknown as typeof fetch;

    const renderer = new HttpQuoteRenderer(
      "https://example.test/generate",
      fetcher,
    );
    const result = await renderer.renderQuote({ format: "png" });

    expect(result?.type).toBe("png");
  });

  it("returns null on a non-ok response or a missing image", async () => {
    const failing = (async () =>
      jsonResponse({}, false)) as unknown as typeof fetch;
    const empty = (async () =>
      jsonResponse({ ok: true, result: {} })) as unknown as typeof fetch;

    expect(
      await new HttpQuoteRenderer("https://x.test", failing).renderQuote({}),
    ).toBeNull();
    expect(
      await new HttpQuoteRenderer("https://x.test", empty).renderQuote({}),
    ).toBeNull();
  });
});
